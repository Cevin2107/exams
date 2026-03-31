# Gia sư Đào Bá Anh Quân – Giao bài tập

Next.js (App Router) + TypeScript + Tailwind, dự kiến deploy Vercel, dùng Supabase (DB + Storage). Kiến trúc mở để tích hợp AI đa nhà cung cấp qua Puter.

## Yêu cầu môi trường
- Node.js 18+
- npm (hoặc pnpm/yarn nếu chỉnh lại scripts)

## Cấu hình môi trường
Tạo `.env.local` từ file mẫu:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD_HASH=
PUTER_AUTH_TOKEN=
```

### API Keys cần thiết cho AI generation:
- **PUTER_AUTH_TOKEN**: Lấy tại dashboard Puter (Account → Copy auth token)
- API gọi theo OpenAI-compatible endpoint của Puter: `https://api.puter.com/puterai/openai/v1/chat/completions`

`ADMIN_PASSWORD_HASH` nên là bcrypt hash. Mặc định repo đã thêm `.env.local` với hash của mật khẩu: Anhquan210706.

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
- Pipeline mới theo combo đa model:
	- `nvidia/nemotron-nano-12b-v2-vl`: OCR thô từ ảnh
	- `google/gemini-2.5-pro`: chuẩn hóa nội dung và sinh JSON câu hỏi
	- `qwen/qwen-vl-max`: hậu kiểm ký hiệu toán + sửa JSON cuối
- **Yêu cầu biến môi trường**: `PUTER_AUTH_TOKEN`.
- Ảnh được resize/compress tự động trước khi gửi model để ổn định tốc độ và giảm lỗi OCR.
- Câu hỏi chỉ được lưu khi bấm "Lưu bài tập"; dữ liệu AI không lưu tạm.

## Triển khai
- Thiết lập biến môi trường trên Vercel theo `.env.example`.
- Chạy `npm run build` để kiểm tra trước khi deploy.

## Giai đoạn tiếp theo
- Nối API với Supabase, chấm điểm trắc nghiệm tự động.
- Bổ sung dashboard CRUD thực, thống kê thật.
- Thêm route upload PDF → Groq → preview câu hỏi trước khi lưu.
