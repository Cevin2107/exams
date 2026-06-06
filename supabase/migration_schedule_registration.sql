-- ============================================
-- Migration: Tính năng Đăng ký lịch học & Lịch rảnh Admin
-- ============================================

-- 1. Thêm cột max_shifts_per_student vào bảng admin_settings
ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS max_shifts_per_student integer not null default 3;

-- 2. Bảng Ca học (shifts)
CREATE TABLE IF NOT EXISTS shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,          -- e.g., "Ca 1", "Ca 2"
  start_time time not null,    -- e.g., '07:00:00'
  end_time time not null,      -- e.g., '09:00:00'
  created_at timestamptz default now()
);

-- 3. Bảng Lịch rảnh Admin đánh dấu (available_schedules)
CREATE TABLE IF NOT EXISTS available_schedules (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 2 and 8), -- 2: Thứ 2, 8: Chủ nhật
  shift_id uuid not null references shifts(id) on delete cascade,
  created_at timestamptz default now(),
  unique(day_of_week, shift_id) -- Mỗi ca trong 1 ngày chỉ có 1 ô rảnh
);

-- 4. Bảng Đăng ký của học sinh (schedule_registrations)
CREATE TABLE IF NOT EXISTS schedule_registrations (
  id uuid primary key default gen_random_uuid(),
  available_schedule_id uuid not null references available_schedules(id) on delete cascade,
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(available_schedule_id) -- Giới hạn 1 học sinh/1 ô (ngày + ca)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_available_schedules_shift_id on available_schedules(shift_id);
CREATE INDEX IF NOT EXISTS idx_available_schedules_day on available_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedule_registrations_schedule on schedule_registrations(available_schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_registrations_student on schedule_registrations(student_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_registrations ENABLE ROW LEVEL SECURITY;

-- Bỏ các policies cũ nếu chạy lại
DROP POLICY IF EXISTS "Public read shifts" on shifts;
DROP POLICY IF EXISTS "Service role manage shifts" on shifts;
DROP POLICY IF EXISTS "Public read available_schedules" on available_schedules;
DROP POLICY IF EXISTS "Service role manage available_schedules" on available_schedules;
DROP POLICY IF EXISTS "Students can view their own schedule_registrations" on schedule_registrations;
DROP POLICY IF EXISTS "Students can insert their own schedule_registrations" on schedule_registrations;
DROP POLICY IF EXISTS "Students can delete their own schedule_registrations" on schedule_registrations;
DROP POLICY IF EXISTS "Public read all schedule_registrations for availability" on schedule_registrations;
DROP POLICY IF EXISTS "Service role manage schedule_registrations" on schedule_registrations;

-- Policies cho shifts
CREATE POLICY "Public read shifts" on shifts
  FOR SELECT USING (true);

CREATE POLICY "Service role manage shifts" on shifts
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

-- Policies cho available_schedules
CREATE POLICY "Public read available_schedules" on available_schedules
  FOR SELECT USING (true);

CREATE POLICY "Service role manage available_schedules" on available_schedules
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

-- Policies cho schedule_registrations
-- Ai cũng có thể xem để biết lịch nào đã bị khóa
CREATE POLICY "Public read all schedule_registrations for availability" on schedule_registrations
  FOR SELECT USING (true);

-- Học sinh chỉ có thể thao tác với đăng ký của chính mình (nhưng chúng ta sẽ dùng service_role ở Backend API cho an toàn hơn)
CREATE POLICY "Service role manage schedule_registrations" on schedule_registrations
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
