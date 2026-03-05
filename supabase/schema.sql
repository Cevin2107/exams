-- ============================================
-- Supabase Schema - Hệ thống bài tập online
-- ============================================
-- Chạy toàn bộ file này trong Supabase SQL Editor để khởi tạo database
-- Bao gồm: 6 bảng chính + indexes + RLS policies + storage buckets

create extension if not exists "pgcrypto";

-- ============================================
-- TABLE 1: assignments - Bài tập
-- ============================================
create table if not exists assignments (
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
-- TABLE 2: questions - Câu hỏi trong bài tập
-- ============================================
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  "order" integer not null,
  type text not null check (type in ('mcq','essay','section','short_answer','true_false')),
  content text not null,
  choices jsonb,
  answer_key text,
  points numeric not null default 1,
  image_url text,
  sub_questions jsonb
);

-- ============================================
-- TABLE 3: submissions - Bài nộp của học sinh
-- ============================================
create table if not exists submissions (
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
-- TABLE 4: student_sessions - Phiên làm bài
-- ============================================
create table if not exists student_sessions (
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
-- TABLE 5: answers - Câu trả lời trong bài nộp
-- ============================================
create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  answer text,
  answer_image_url text,
  is_correct boolean,
  points_awarded numeric not null default 0
);

-- ============================================
-- TABLE 6: admin_settings - Cài đặt admin
-- ============================================
create table if not exists admin_settings (
  id integer primary key default 1,
  admin_password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint single_admin_row check (id = 1)
);

-- ============================================
-- INDEXES - Tăng tốc truy vấn
-- ============================================
create index if not exists idx_questions_assignment on questions(assignment_id);
create index if not exists idx_submissions_assignment on submissions(assignment_id);
create index if not exists idx_answers_submission on answers(submission_id);
create index if not exists idx_student_sessions_assignment on student_sessions(assignment_id);
create index if not exists idx_student_sessions_student on student_sessions(student_name);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table assignments enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table answers enable row level security;
alter table admin_settings enable row level security;
alter table student_sessions enable row level security;

-- Drop existing policies if any
drop policy if exists "Public read visible assignments" on assignments;
drop policy if exists "Service role manage assignments" on assignments;
drop policy if exists "Public read questions" on questions;
drop policy if exists "Service role manage questions" on questions;
drop policy if exists "Public insert submissions" on submissions;
drop policy if exists "Service role manage submissions" on submissions;
drop policy if exists "Public insert answers" on answers;
drop policy if exists "Service role manage answers" on answers;
drop policy if exists "Service role read admin settings" on admin_settings;
drop policy if exists "Service role update admin settings" on admin_settings;
drop policy if exists "Public insert student sessions" on student_sessions;
drop policy if exists "Public update student sessions" on student_sessions;
drop policy if exists "Service role manage student sessions" on student_sessions;

-- Public can read visible assignments
create policy "Public read visible assignments" on assignments
  for select using (is_hidden = false);

-- Admin (service role) full access to assignments
create policy "Service role manage assignments" on assignments
  for all using (auth.role() = 'service_role') with check (true);

-- Public can read questions of visible assignments
create policy "Public read questions" on questions
  for select using (
    exists (
      select 1 from assignments a
      where a.id = assignment_id and a.is_hidden = false
    )
  );

create policy "Service role manage questions" on questions
  for all using (auth.role() = 'service_role') with check (true);

-- Public can insert submissions (no auth)
create policy "Public insert submissions" on submissions
  for insert with check (auth.role() = 'anon' or auth.role() = 'authenticated');

-- Service role can manage submissions
create policy "Service role manage submissions" on submissions
  for all using (auth.role() = 'service_role') with check (true);

-- Public can insert answers linked to their submission
create policy "Public insert answers" on answers
  for insert with check (auth.role() in ('anon','authenticated'));

create policy "Service role manage answers" on answers
  for all using (auth.role() = 'service_role') with check (true);

-- Only service role can read/update admin settings
create policy "Service role read admin settings" on admin_settings
  for select using (auth.role() = 'service_role');
create policy "Service role update admin settings" on admin_settings
  for update using (auth.role() = 'service_role') with check (true);

-- Public can insert and update student sessions
create policy "Public insert student sessions" on student_sessions
  for insert with check (auth.role() in ('anon','authenticated'));
create policy "Public update student sessions" on student_sessions
  for update using (auth.role() in ('anon','authenticated')) with check (true);
create policy "Service role manage student sessions" on student_sessions
  for all using (auth.role() = 'service_role') with check (true);

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Bucket for question images (admin uploads)
insert into storage.buckets (id, name, public) values ('question-images', 'question-images', true)
  on conflict (id) do nothing;

-- Bucket for essay answer images (student uploads via server-side API)
insert into storage.buckets (id, name, public) values ('answer-images', 'answer-images', true)
  on conflict (id) do nothing;

-- Drop existing storage policies if any
drop policy if exists "Public read question images" on storage.objects;
drop policy if exists "Service role write question images" on storage.objects;
drop policy if exists "Service role update/delete question images" on storage.objects;
drop policy if exists "Public read answer images" on storage.objects;
drop policy if exists "Service role write answer images" on storage.objects;
drop policy if exists "Service role update/delete answer images" on storage.objects;

-- question-images policies
create policy "Public read question images" on storage.objects
  for select using (bucket_id = 'question-images');
create policy "Service role write question images" on storage.objects
  for insert with check (bucket_id = 'question-images' and auth.role() = 'service_role');
create policy "Service role update/delete question images" on storage.objects
  for all using (bucket_id = 'question-images' and auth.role() = 'service_role');

-- answer-images policies (server-side uploads use service_role)
create policy "Public read answer images" on storage.objects
  for select using (bucket_id = 'answer-images');
create policy "Service role write answer images" on storage.objects
  for insert with check (bucket_id = 'answer-images' and auth.role() = 'service_role');
create policy "Service role update/delete answer images" on storage.objects
  for all using (bucket_id = 'answer-images' and auth.role() = 'service_role');

-- ============================================
-- MIGRATION: add answer_image_url if upgrading existing DB
-- ============================================
alter table answers add column if not exists answer_image_url text;
