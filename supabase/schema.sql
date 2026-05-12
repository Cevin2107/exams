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
drop table if exists assignment_assignments cascade;
drop table if exists student_profiles cascade;
drop table if exists assignments cascade;
drop table if exists admin_settings cascade;

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
-- 9. TABLE: student_profiles - Hồ sơ học sinh (từ migration)
-- ============================================
create table student_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
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
-- 11. INDEXES - Tăng tốc truy vấn
-- ============================================
create index idx_questions_assignment on questions(assignment_id);
create index idx_questions_order on questions("order");
create index idx_submissions_assignment on submissions(assignment_id);
create index idx_submissions_student_name on submissions(student_name);
create index idx_answers_submission on answers(submission_id);
create index idx_answers_question on answers(question_id);
create index idx_student_sessions_assignment on student_sessions(assignment_id);
create index idx_student_sessions_student on student_sessions(student_name);
create index idx_student_sessions_status on student_sessions(status);
create index idx_assignment_assignments_student_id on assignment_assignments(student_id);
create index idx_assignment_assignments_assignment_id on assignment_assignments(assignment_id);

-- ============================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ============================================
alter table assignments enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table answers enable row level security;
alter table admin_settings enable row level security;
alter table student_sessions enable row level security;
alter table student_profiles enable row level security;
alter table assignment_assignments enable row level security;

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

-- Student sessions policies
create policy "Public insert student sessions" on student_sessions
  for insert with check (auth.role() in ('anon','authenticated'));

create policy "Public update student sessions" on student_sessions
  for update using (auth.role() in ('anon','authenticated')) with check (true);

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
