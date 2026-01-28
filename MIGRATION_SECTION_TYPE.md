# Migration: Add Section Type & Cleanup Corrupted Data

## Lỗi hiện tại

1. **Không thể thêm thông báo** (type='section') vì database constraint chỉ cho phép 'mcq' và 'essay'
2. **Không thể xóa câu hỏi** - Database có câu hỏi bị corrupted với `assignment_id` null
3. **Lỗi cập nhật câu hỏi** - Nhiều câu hỏi không tìm thấy trong database

## Cách khắc phục

### Bước 1: Mở Supabase Dashboard
1. Truy cập: https://app.supabase.com
2. Chọn project của bạn
3. Vào **SQL Editor**

### Bước 2: Cleanup dữ liệu lỗi
Copy và chạy SQL sau để xóa các câu hỏi bị lỗi:

```sql
-- Check corrupted records first
SELECT COUNT(*) as corrupted_count
FROM questions
WHERE assignment_id IS NULL;

-- Delete corrupted records
DELETE FROM questions
WHERE assignment_id IS NULL;
```

### Bước 3: Thêm 'section' type
Copy và chạy SQL sau:

```sql
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_type_check CHECK (type IN ('mcq', 'essay', 'section'));
```

### Bước 4: Verify
```sql
-- Verify no corrupted data remains
SELECT COUNT(*) FROM questions WHERE assignment_id IS NULL;

-- Should return 0
```

## Files đã tạo
- `supabase/migrations/add_section_type.sql` - Migration để thêm section type
- `supabase/migrations/cleanup_corrupted_questions.sql` - Script cleanup dữ liệu lỗi

## Xác nhận
Sau khi chạy cả 2 migrations, reload trang và thử:
1. Thêm thông báo → Sẽ hoạt động
2. Xóa câu hỏi → Không còn lỗi
3. Cập nhật câu hỏi → Không còn lỗi PGRST116
