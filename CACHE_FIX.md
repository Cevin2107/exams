# Khắc phục vấn đề Cache

## Vấn đề
Web không tự động cập nhật và vẫn hiển thị bài tập cũ mỗi lần vào trang.

## Nguyên nhân
Next.js App Router mặc định cache các Server Components để tối ưu hiệu năng. Điều này khiến dữ liệu không được fetch mới mỗi lần truy cập.

## Giải pháp đã áp dụng

### 1. Cấu hình Next.js (`next.config.js`)
```javascript
experimental: {
  staleTimes: {
    dynamic: 0,
    static: 0
  }
}
```
- Disable cache cho cả dynamic và static routes
- Đảm bảo không có stale data

### 2. Các trang được cập nhật với `force-dynamic`
Thêm vào đầu các file Server Components:
```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

**Các trang đã được cập nhật:**
- ✅ `/src/app/page.tsx` - Trang chủ danh sách bài tập
- ✅ `/src/app/admin/dashboard/page.tsx` - Dashboard admin
- ✅ `/src/app/assignments/[id]/page.tsx` - Trang làm bài
- ✅ `/src/app/assignments/[id]/result/page.tsx` - Trang kết quả

### 3. Cách hoạt động
- `dynamic = 'force-dynamic'`: Bắt buộc render động mỗi request
- `revalidate = 0`: Không cache, luôn fetch data mới
- `staleTimes`: Đặt thời gian stale về 0

## Kiểm tra
1. Khởi động lại dev server: `npm run dev`
2. Hoặc build production: `npm run build && npm start`
3. Mở trang và tải lại - dữ liệu sẽ luôn mới nhất

## Lưu ý
- Điều này có thể làm giảm hiệu năng một chút vì phải fetch data mỗi lần
- Nếu cần tối ưu, có thể dùng `revalidate = 60` (60 giây) thay vì 0
- Client Components ("use client") không cần cấu hình này
