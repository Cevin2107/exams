# Hướng dẫn chạy migration

## Bước 1: Chạy migration trên Supabase

1. Mở Supabase Dashboard: https://supabase.com/dashboard
2. Chọn project của bạn
3. Vào **SQL Editor** (thanh bên trái)
4. Mở file migration: `supabase/migrations/add_draft_answers.sql`
5. Copy toàn bộ nội dung và paste vào SQL Editor
6. Nhấn **Run** hoặc **Ctrl+Enter**

## Nội dung migration:

```sql
-- Add draft_answers column to student_sessions table
ALTER TABLE student_sessions 
ADD COLUMN IF NOT EXISTS draft_answers jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN student_sessions.draft_answers IS 'JSON object storing draft answers: {"question_id": "answer_value", ...}';
```

## Bước 2: Kiểm tra

Sau khi chạy migration, kiểm tra bằng cách:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'student_sessions' 
AND column_name = 'draft_answers';
```

Kết quả phải trả về:
- column_name: draft_answers
- data_type: jsonb

## Tính năng mới

Sau khi chạy migration:

1. **Draft answers được lưu vào database** thay vì localStorage
2. **Có thể truy cập từ nhiều thiết bị** - chỉ cần nhập đúng tên
3. **Tự động sync** mỗi khi thay đổi câu trả lời (debounce 500ms)
4. **Có backup localStorage** - nếu database lỗi vẫn có dữ liệu local

## Test

1. Làm bài trên máy A
2. Nhấn "Lưu lại và thoát"
3. Mở trình duyệt khác hoặc máy B
4. Nhập tên → Nhấn "Tiếp tục làm"
5. Các câu đã làm phải xuất hiện
