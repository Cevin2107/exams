-- Xoá khoá ngoại cũ (nếu có) và tạo khoá ngoại mới tham chiếu đúng vào student_profiles

ALTER TABLE IF EXISTS schedule_registrations
  DROP CONSTRAINT IF EXISTS schedule_registrations_student_id_fkey;

ALTER TABLE schedule_registrations
  ADD CONSTRAINT schedule_registrations_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.student_profiles(id) ON DELETE CASCADE;
