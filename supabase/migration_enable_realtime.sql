-- ==============================================================
-- Migration: Enable Realtime for Student Sessions
-- ==============================================================

-- 1. Thêm chính sách cho phép đọc (SELECT) công khai trên bảng student_sessions.
-- Điều này bắt buộc vì Supabase Realtime yêu cầu quyền SELECT để gửi sự kiện đến client.
DROP POLICY IF EXISTS "Public read student sessions" ON student_sessions;
CREATE POLICY "Public read student sessions" ON student_sessions
  FOR SELECT USING (true);

-- 2. Thêm bảng student_sessions vào publication để kích hoạt Supabase Realtime.
-- Nếu publication chưa tồn tại (trường hợp hiếm gặp), lệnh này sẽ lỗi nên ta kiểm tra hoặc chạy trực tiếp.
ALTER PUBLICATION supabase_realtime ADD TABLE student_sessions;
