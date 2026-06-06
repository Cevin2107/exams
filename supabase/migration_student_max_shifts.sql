-- Thêm cấu hình số ca tối đa vào bảng student_profiles
ALTER TABLE student_profiles 
ADD COLUMN IF NOT EXISTS max_shifts integer not null default 3;
