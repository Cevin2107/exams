# Hướng dẫn Deploy - Fix Lỗ Hổng Thời Gian Làm Bài

## Tổng quan thay đổi
Hệ thống đã được cập nhật để khắc phục lỗ hổng thời gian làm bài khi học sinh chuyển tab:

### 1. **Server-side Time Tracking**
   - Lưu thời gian bắt đầu thực tế (started_at)
   - Tính deadline dựa trên started_at + duration
   - Kiểm tra deadline trên server, không phụ thuộc vào client

### 2. **Đồng hồ thời gian thực**
   - Hiển thị giờ Việt Nam (UTC+7) 
   - Cập nhật mỗi giây để học sinh theo dõi
   - Countdown timer sync với server

### 3. **Fix lỗi timezone**
   - Admin nhập deadline theo giờ Việt Nam
   - Hệ thống tự động convert sang UTC
   - Hiển thị đúng múi giờ cho học sinh

### 4. **Theo dõi hoạt động học sinh**
   - Cột "Cập nhật cuối" hiển thị thời gian chính xác đến giây
   - Tự động cập nhật khi học sinh chọn đáp án
   - Indicator xanh nháy khi học sinh đang hoạt động (trong 2 phút)
   - Hiển thị "X phút trước" để dễ theo dõi

## Các bước deploy

### Bước 1: Cập nhật Database Schema
Chạy migration SQL trong Supabase SQL Editor:

```bash
# File: supabase/migrations/add_deadline_at.sql
```

1. Đăng nhập vào Supabase Dashboard
2. Vào SQL Editor
3. Copy nội dung file `supabase/migrations/add_deadline_at.sql`
4. Run SQL
5. Verify kết quả bằng query cuối cùng trong file

### Bước 2: Deploy Code
```bash
# Build và deploy lên production
npm run build
npm start

# Hoặc nếu dùng Vercel:
git add .
git commit -m "Fix: Server-side time tracking và timezone issues"
git push origin main
```

### Bước 3: Kiểm tra
1. **Test thời gian làm bài:**
   - Tạo bài tập mới với duration 5 phút
   - Bắt đầu làm bài
   - Chuyển sang tab khác
   - Kiểm tra xem thời gian vẫn đếm

2. **Test deadline:**
   - Set deadline trong admin
   - Kiểm tra hiển thị trên trang học sinh
   - Verify giờ hiển thị đúng (giờ Việt Nam)

3. **Test auto-submit:**
   - Để hết thời gian
   - Kiểm tra bài tự động nộp

4. **Test activity tracking:**
   - Admin mở trang chi tiết bài tập
   - Học sinh chọn đáp án
   - Click nút "🔄 Làm mới" để xem cột "Cập nhật cuối" thay đổi
   - Kiểm tra indicator xanh nháy khi học sinh đang làm

## Các thay đổi chi tiết

### Database Schema
```sql
-- student_sessions table
ALTER TABLE student_sessions 
  ADD COLUMN deadline_at timestamptz;
```

### API Endpoints
1. **POST /api/student-sessions**
   - Tính và lưu `deadline_at` khi tạo session
   - Logic: `started_at + duration_minutes`
   - Ưu tiên `due_at` nếu nhỏ hơn

2. **GET /api/student-sessions/check-deadline**
   - Endpoint mới để check deadline
   - Trả về: expired, remainingSeconds, currentTime

3. **PATCH /api/student-sessions/activity**
   - Endpoint mới để cập nhật last_activity_at
   - Gọi mỗi khi học sinh chọn đáp án
   - Admin theo dõi hoạt động real-time

### Frontend Components
1. **AssignmentTaking.tsx**
   - Đồng hồ giờ Việt Nam (phía trên countdown)
   - Countdown sync với server deadline
   - Format: HH:MM:SS (24h)
   - Tự động cập nhật activity mỗi khi chọn đáp án

2. **Admin Pages**
   - Fix timezone conversion khi lưu deadline
   - Hiển thị đúng giờ Việt Nam trong form
   - Cột "Cập nhật cuối" với format đầy đủ (ngày/tháng/giờ/phút/giây)
   - Indicator xanh nháy cho hoạt động gần đây
   - Hiển thị "X phút trước" để dễ tracking

## Lưu ý quan trọng

### ⚠️ Breaking Changes
- **Sessions cũ:** Sessions đang active sẽ được update với `deadline_at = NULL` nếu không có duration
- **Compatibility:** Code mới tương thích ngược với sessions cũ

### 🔒 Security
- Thời gian kiểm tra trên server, không thể hack từ client
- Auto-submit khi hết giờ, không cho học sinh tiếp tục

### 🕐 Timezone
- Tất cả thời gian trong DB: UTC
- Admin input: Giờ Việt Nam (UTC+7)
- Student display: Giờ Việt Nam (UTC+7)
- Conversion tự động ở API layer

## Troubleshooting

### Vấn đề: Thời gian không khớp
```sql
-- Check timezone của server
SHOW timezone;

-- Verify deadline_at được tính đúng
SELECT 
  student_name,
  started_at,
  deadline_at,
  deadline_at - started_at as duration
FROM student_sessions
WHERE status = 'active'
ORDER BY created_at DESC;
```

### Vấn đề: Auto-submit không hoạt động
- Kiểm tra browser console có lỗi API không
- Verify sessionId được lưu trong localStorage
- Check network tab xem API `/api/student-sessions/check-deadline` có được gọi không

### Vấn đề: Deadline không đúng trong admin
- Clear browser cache
- Check múi giờ máy admin
- Verify input datetime-local format

## Testing Checklist
- [ ] Migration SQL chạy thành công
- [ ] Tạo bài tập mới có duration
- [ ] Học sinh bắt đầu làm bài
- [ ] Chuyển tab → thời gian vẫn đếm
- [ ] Hết giờ → tự động nộp
- [ ] Đồng hồ Việt Nam hiển thị đúng
- [ ] Admin set deadline → học sinh thấy đúng
- [ ] Sessions cũ không bị lỗi
- [ ] Học sinh chọn đáp án → "Cập nhật cuối" thay đổi
- [ ] Indicator xanh hiển thị khi hoạt động gần đây
- [ ] Click "🔄 Làm mới" để refresh danh sách

## Rollback Plan
Nếu có vấn đề, rollback bằng cách:

```sql
-- Remove deadline_at column
ALTER TABLE student_sessions DROP COLUMN deadline_at;
```

Sau đó revert code về commit trước:
```bash
git revert HEAD
git push origin main
```

---
**Ngày cập nhật:** 21/01/2025
**Version:** 2.0.0
