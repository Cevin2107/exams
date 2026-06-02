# Gia sư Đào Bá Anh Quân – Giao bài tập

Next.js (App Router) + TypeScript + Tailwind, dự kiến deploy Vercel, dùng Supabase (DB + Storage). Kiến trúc mở để tích hợp AI OCR và trích xuất câu hỏi.

## Yêu cầu môi trường
- Node.js 18+
- npm (hoặc pnpm/yarn nếu chỉnh lại scripts)

## Cấu hình môi trường
Tạo `.env.local` từ file mẫu:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
OPENROUTER_API_KEY=
MATH_EXTRACT_MODEL=openrouter/owl-alpha
PASSKEY_RP_ID=
PASSKEY_RP_ORIGIN=
PASSKEY_RP_NAME=
```

### API Keys cần thiết cho AI generation:
- **OPENROUTER_API_KEY**: Dùng để bóc tách câu hỏi trắc nghiệm từ văn bản/OCR
- **MATH_EXTRACT_MODEL** (tuỳ chọn): mặc định `openrouter/owl-alpha`
- OCR sử dụng **Tesseract.js** (hoàn toàn miễn phí, không cần API key)

`ADMIN_PASSWORD` dùng để khởi tạo mật khẩu admin lần đầu (sau đó lưu hash trong database). Bạn có thể đổi trong tab Cài đặt.
`PASSKEY_RP_ID` và `PASSKEY_RP_ORIGIN` chỉ cần set khi deploy domain thật (ví dụ: `example.com`, `https://example.com`).

## Cài đặt
```
npm install
npm run dev
```

## Cấu trúc chính
- `src/app` – App Router pages (học sinh, admin, api/submissions placeholder)
- `src/components` – Header, AssignmentList (lọc/tìm kiếm demo)
- `src/lib` – Supabase clients, sample data, types

## Database Schema & Management

### Bảng dữ liệu (6 bảng chính)
1. **assignments** - Bài tập
2. **questions** - Câu hỏi trong bài tập
3. **submissions** - Bài nộp của học sinh (unique per student per assignment)
4. **answers** - Câu trả lời trong bài nộp
5. **student_sessions** - Phiên làm bài (tracking: active/exited/submitted)
6. **admin_settings** - Cài đặt mật khẩu admin
7. **admin_passkeys** - Thiết bị passkey (vân tay)

### Khởi tạo Database
Chạy file `supabase/schema.sql` trong Supabase SQL Editor để tạo tất cả bảng, indexes, RLS policies và storage bucket.

### Quản lý & Dọn dẹp
- **Kiểm tra database**: `supabase/check_all_tables.sql`
- **Kiểm tra kích thước**: `supabase/check_database_size.sql`
- **Dọn dẹp dữ liệu cũ**: `supabase/cleanup_old_data.sql`
- **Hướng dẫn chi tiết**: Xem [DATABASE_CLEANUP_GUIDE.md](DATABASE_CLEANUP_GUIDE.md)

### Storage Bucket
- `question-images` - Lưu ảnh câu hỏi (public read, service role write)

## Tạo bài bằng AI (OCR + sinh câu hỏi)
- Tab "Tạo bằng AI" trong Admin → Tạo bài tập: dán/upload nhiều ảnh, PDF, hoặc kèm văn bản.
- Pipeline: OCR.space API (auto-optimize ảnh để tăng tốc) → làm sạch text → OpenRouter (`openrouter/owl-alpha`) bóc tách câu hỏi trắc nghiệm JSON → Admin chỉnh sửa và lưu.
- **Yêu cầu biến môi trường**: `OPENROUTER_API_KEY`.
- OCR sử dụng free tier OCR.space API (25k requests/tháng), đã tối ưu hóa bằng cách resize và compress ảnh.
- Xử lý nhiều ảnh song song (parallel) để tăng tốc.
- Câu hỏi chỉ được lưu khi bấm "Lưu bài tập"; dữ liệu AI không lưu tạm.

## Triển khai
- Thiết lập biến môi trường trên Vercel theo `.env.example`.
- Chạy `npm run build` để kiểm tra trước khi deploy.

## Giai đoạn tiếp theo
- Nối API với Supabase, chấm điểm trắc nghiệm tự động.
- Bổ sung dashboard CRUD thực, thống kê thật.
- Thêm route upload PDF → AI extraction → preview câu hỏi trước khi lưu.
