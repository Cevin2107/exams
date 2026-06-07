-- ============================================
-- Supabase Schema - Hệ thống bài tập online
-- ============================================
-- Chạy toàn bộ file này một lần duy nhất trong Supabase SQL Editor
-- Tự động xóa các bảng cũ, tạo schema hoàn chỉnh + migration integration

-- ============================================
-- 1. DROP OLD TABLES - Xóa sạch dữ liệu cũ
-- ============================================
drop table if exists answers cascade;
drop table if exists submissions cascade;
drop table if exists questions cascade;
drop table if exists student_sessions cascade;
drop table if exists teaching_sessions cascade;
drop table if exists students cascade;
drop table if exists assignment_assignments cascade;
drop table if exists student_profiles cascade;
drop table if exists assignments cascade;
drop table if exists admin_settings cascade;
drop table if exists admin_passkeys cascade;

-- Drop old triggers and functions
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

-- ============================================
-- 2. CREATE EXTENSIONS
-- ============================================
create extension if not exists "pgcrypto";

-- ============================================
-- 3. TABLE: assignments - Bài tập
-- ============================================
create table assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  grade text not null,
  due_at timestamptz,
  duration_minutes integer,
  total_score numeric not null default 0,
  is_hidden boolean not null default false,
  hide_score boolean not null default false,
  point_ranges jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 4. TABLE: questions - Câu hỏi
-- ============================================
create table questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  "order" integer not null,
  type text not null check (type in ('mcq','essay','section','short_answer','true_false')),
  content text not null,
  choices jsonb,
  answer_key text,
  points numeric not null default 1,
  image_url text,
  sub_questions jsonb,
  created_at timestamptz not null default now()
);

-- ============================================
-- 5. TABLE: submissions - Bài nộp
-- ============================================
create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_name text not null,
  student_code text,
  submitted_at timestamptz not null default now(),
  score numeric,
  status text not null default 'pending' check (status in ('pending','scored')),
  duration_seconds integer,
  created_at timestamptz not null default now(),
  constraint unique_student_assignment unique (assignment_id, student_name)
);

-- ============================================
-- 6. TABLE: student_sessions - Phiên làm bài
-- ============================================
create table student_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_name text not null,
  status text not null default 'active' check (status in ('active','exited','submitted')),
  started_at timestamptz not null default now(),
  active_since timestamptz,
  active_duration_seconds integer not null default 0,
  deadline_at timestamptz,
  last_activity_at timestamptz not null default now(),
  exit_count integer not null default 0,
  submission_id uuid references submissions(id) on delete set null,
  draft_answers jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================
-- 7. TABLE: answers - Câu trả lời
-- ============================================
create table answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  answer text,
  answer_image_url text,
  is_correct boolean,
  points_awarded numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================
-- 8. TABLE: admin_settings - Cài đặt admin
-- ============================================
create table admin_settings (
  id integer primary key default 1,
  admin_password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint single_admin_row check (id = 1)
);

-- ============================================
-- 8.1 TABLE: admin_passkeys - Passkey admin
-- ============================================
create table admin_passkeys (
  id uuid primary key default gen_random_uuid(),
  name text,
  credential_id text not null unique,
  public_key text not null,
  counter integer not null default 0,
  transports text[],
  created_at timestamptz not null default now()
);

-- ============================================
-- 9. TABLE: student_profiles - Hồ sơ học sinh (từ migration)
-- ============================================
create table student_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  max_shifts integer not null default 3,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 10. TABLE: assignment_assignments - Gán bài tập cho học sinh (từ migration)
-- ============================================
create table assignment_assignments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  student_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(assignment_id, student_id)
);

-- ============================================
-- 10.1 TABLE: students - Học sinh (lịch dạy)
-- ============================================
create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  salary_per_session integer not null default 200000,
  color text default '#3B82F6',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Default student for teaching sessions
insert into students (name, salary_per_session, color)
values ('Học sinh mặc định', 200000, '#3B82F6')
on conflict do nothing;

-- ============================================
-- 10.2 TABLE: teaching_sessions - Lịch dạy học
-- ============================================
create table teaching_sessions (
  id uuid primary key default gen_random_uuid(),
  teaching_date date not null,
  subject varchar(20) not null check (subject in ('Toan', 'Ly', 'Hoa')),
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz default now()
);

-- ============================================
-- 11. INDEXES - Tăng tốc truy vấn
-- ============================================
create index idx_questions_assignment on questions(assignment_id);
create index idx_questions_order on questions("order");
create index idx_submissions_assignment on submissions(assignment_id);
create index idx_submissions_student_name on submissions(student_name);
create index idx_submissions_submitted_at on submissions(submitted_at desc);
create index idx_answers_submission on answers(submission_id);
create index idx_answers_question on answers(question_id);
create index idx_student_sessions_assignment on student_sessions(assignment_id);
create index idx_student_sessions_student on student_sessions(student_name);
create index idx_student_sessions_status on student_sessions(status);
create index idx_student_sessions_started_at on student_sessions(started_at desc);
create index idx_student_sessions_last_activity on student_sessions(last_activity_at desc);
create index idx_assignment_assignments_student_id on assignment_assignments(student_id);
create index idx_assignment_assignments_assignment_id on assignment_assignments(assignment_id);
create index idx_teaching_sessions_student_id on teaching_sessions(student_id);
create index idx_teaching_sessions_date on teaching_sessions(teaching_date);
create index idx_assignments_created_at on assignments(created_at desc);

-- ============================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ============================================
alter table assignments enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table answers enable row level security;
alter table admin_settings enable row level security;
alter table admin_passkeys enable row level security;
alter table student_sessions enable row level security;
alter table student_profiles enable row level security;
alter table assignment_assignments enable row level security;
alter table students enable row level security;
alter table teaching_sessions enable row level security;

-- ============================================
-- 13. RLS POLICIES
-- ============================================

-- Assignments policies
create policy "Public read visible assignments" on assignments
  for select using (is_hidden = false);

create policy "Service role manage assignments" on assignments
  for all using (auth.role() = 'service_role') with check (true);

-- Questions policies
create policy "Public read questions" on questions
  for select using (
    exists (
      select 1 from assignments a
      where a.id = assignment_id and a.is_hidden = false
    )
  );

create policy "Service role manage questions" on questions
  for all using (auth.role() = 'service_role') with check (true);

-- Submissions policies
create policy "Public insert submissions" on submissions
  for insert with check (auth.role() = 'anon' or auth.role() = 'authenticated');

create policy "Service role manage submissions" on submissions
  for all using (auth.role() = 'service_role') with check (true);

-- Answers policies
create policy "Public insert answers" on answers
  for insert with check (auth.role() in ('anon','authenticated'));

create policy "Service role manage answers" on answers
  for all using (auth.role() = 'service_role') with check (true);

-- Admin settings policies
create policy "Service role read admin settings" on admin_settings
  for select using (auth.role() = 'service_role');

create policy "Service role update admin settings" on admin_settings
  for update using (auth.role() = 'service_role') with check (true);

-- Admin passkeys policies
create policy "Service role read admin passkeys" on admin_passkeys
  for select using (auth.role() = 'service_role');

create policy "Service role manage admin passkeys" on admin_passkeys
  for all using (auth.role() = 'service_role') with check (true);

-- Student sessions policies
create policy "Public insert student sessions" on student_sessions
  for insert with check (auth.role() in ('anon','authenticated'));

create policy "Public update student sessions" on student_sessions
  for update using (auth.role() in ('anon','authenticated')) with check (true);

create policy "Public read student sessions" on student_sessions
  for select using (true);

create policy "Service role manage student sessions" on student_sessions
  for all using (auth.role() = 'service_role') with check (true);

-- Student profiles policies
create policy "Users can view their own profile" on student_profiles
  for select using (auth.uid() = id);

create policy "Service role manage student profiles" on student_profiles
  for all using (auth.role() = 'service_role') with check (true);

-- Assignment assignments policies
create policy "Students can view their own assignments" on assignment_assignments
  for select using (auth.uid() = student_id);

create policy "Service role manage assignment_assignments" on assignment_assignments
  for all using (auth.role() = 'service_role') with check (true);

-- Students policies
create policy "Anyone can view students" on students
  for select to public using (true);

create policy "Anyone can insert students" on students
  for insert to public with check (true);

create policy "Anyone can update students" on students
  for update to public using (true);

create policy "Anyone can delete students" on students
  for delete to public using (true);

-- Teaching sessions policies
create policy "Anyone can view teaching sessions" on teaching_sessions
  for select to public using (true);

create policy "Anyone can insert teaching sessions" on teaching_sessions
  for insert to public with check (true);

create policy "Anyone can delete teaching sessions" on teaching_sessions
  for delete to public using (true);

-- ============================================
-- 14. TRIGGERS & FUNCTIONS
-- ============================================

-- Function: Auto-create student profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.student_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Student'));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: Call function on new auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 15. STORAGE BUCKETS
-- ============================================

-- Bucket for question images (admin uploads)
insert into storage.buckets (id, name, public) values ('question-images', 'question-images', true)
  on conflict (id) do nothing;

-- Bucket for essay answer images (student uploads)
insert into storage.buckets (id, name, public) values ('answer-images', 'answer-images', true)
  on conflict (id) do nothing;

-- ============================================
-- 16. STORAGE POLICIES
-- ============================================

-- Drop existing storage policies if any
drop policy if exists "Public read question images" on storage.objects;
drop policy if exists "Service role write question images" on storage.objects;
drop policy if exists "Service role manage question images" on storage.objects;
drop policy if exists "Public read answer images" on storage.objects;
drop policy if exists "Service role write answer images" on storage.objects;
drop policy if exists "Service role manage answer images" on storage.objects;

-- Question images policies
create policy "Public read question images" on storage.objects
  for select using (bucket_id = 'question-images');

create policy "Service role write question images" on storage.objects
  for insert with check (bucket_id = 'question-images' and auth.role() = 'service_role');

create policy "Service role manage question images" on storage.objects
  for all using (bucket_id = 'question-images' and auth.role() = 'service_role');

-- Answer images policies
create policy "Public read answer images" on storage.objects
  for select using (bucket_id = 'answer-images');

create policy "Service role write answer images" on storage.objects
  for insert with check (bucket_id = 'answer-images' and auth.role() = 'service_role');

create policy "Service role manage answer images" on storage.objects
  for all using (bucket_id = 'answer-images' and auth.role() = 'service_role');

-- ============================================
-- 17. DONE! Tất cả bảng đã được tạo
-- ============================================
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

-- ============================================
-- 14. REALTIME CONFIGURATION
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE student_sessions;

