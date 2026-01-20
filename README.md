# Gia sư Đào Bá Anh Quân – Giao bài tập

Next.js (App Router) + TypeScript + Tailwind, dự kiến deploy Vercel, dùng Supabase (DB + Storage). Kiến trúc mở để tích hợp Groq AI ở giai đoạn sau.

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
GROQ_API_KEY=
```

### API Keys cần thiết cho AI generation:
- **GROQ_API_KEY**: Đăng ký miễn phí tại https://console.groq.com - dùng để sinh câu hỏi từ text
- OCR sử dụng **Tesseract.js** (hoàn toàn miễn phí, không cần API key)

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

## Supabase (đề xuất bảng)
- `assignments`, `questions`, `submissions`, `answers`, `admin_settings`
- Bật RLS, anon chỉ được đọc assignments/questions và ghi submissions/answers.

## Tạo bài bằng AI (OCR + sinh câu hỏi)
- Tab "Tạo bằng AI" trong Admin → Tạo bài tập: dán/upload nhiều ảnh, PDF, hoặc kèm văn bản.
- Pipeline: OCR.space API (auto-optimize ảnh để tăng tốc) → làm sạch text → Groq (Llama 3.1) sinh câu hỏi trắc nghiệm JSON → Admin chỉnh sửa và lưu.
- **Yêu cầu biến môi trường**: `GROQ_API_KEY` (miễn phí tại console.groq.com).
- OCR sử dụng free tier OCR.space API (25k requests/tháng), đã tối ưu hóa bằng cách resize và compress ảnh.
- Xử lý nhiều ảnh song song (parallel) để tăng tốc.
- Câu hỏi chỉ được lưu khi bấm "Lưu bài tập"; dữ liệu AI không lưu tạm.

## Triển khai
- Thiết lập biến môi trường trên Vercel theo `.env.example`.
- Chạy `npm run build` để kiểm tra trước khi deploy.

## Giai đoạn tiếp theo
- Nối API với Supabase, chấm điểm trắc nghiệm tự động.
- Bổ sung dashboard CRUD thực, thống kê thật.
- Thêm route upload PDF → Groq → preview câu hỏi trước khi lưu.
