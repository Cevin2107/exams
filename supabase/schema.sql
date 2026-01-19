-- Supabase schema for Gia sư Đào Bá Anh Quân
-- Run in Supabase SQL editor

create extension if not exists "pgcrypto";

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  grade text not null,
  due_at timestamptz,
  duration_minutes integer,
  total_score numeric not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  "order" integer not null,
  type text not null check (type in ('mcq','essay')),
  content text not null,
  choices jsonb,
  answer_key text,
  points numeric not null default 1,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_code text,
  submitted_at timestamptz not null default now(),
  score numeric,
  status text not null default 'pending' check (status in ('pending','scored')),
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  answer text,
  is_correct boolean,
  points_awarded numeric,
  created_at timestamptz not null default now()
);

create table if not exists admin_settings (
  id integer primary key default 1,
  admin_password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_questions_assignment on questions(assignment_id);
create index if not exists idx_submissions_assignment on submissions(assignment_id);
create index if not exists idx_answers_submission on answers(submission_id);

-- RLS
alter table assignments enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table answers enable row level security;
alter table admin_settings enable row level security;

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
  for insert with check (
    auth.role() in ('anon','authenticated')
  );

create policy "Service role manage answers" on answers
  for all using (auth.role() = 'service_role') with check (true);

-- Only service role can read admin settings
create policy "Service role read admin settings" on admin_settings
  for select using (auth.role() = 'service_role');
create policy "Service role update admin settings" on admin_settings
  for update using (auth.role() = 'service_role') with check (true);

-- Storage bucket for question images
insert into storage.buckets (id, name, public) values ('question-images', 'question-images', true)
  on conflict (id) do nothing;

-- Drop existing storage policies if any
drop policy if exists "Public read question images" on storage.objects;
drop policy if exists "Service role write question images" on storage.objects;
drop policy if exists "Service role update/delete question images" on storage.objects;

-- Allow public read, service role write for bucket
create policy "Public read question images" on storage.objects
  for select using (bucket_id = 'question-images');
create policy "Service role write question images" on storage.objects
  for insert with check (bucket_id = 'question-images' and auth.role() = 'service_role');
create policy "Service role update/delete question images" on storage.objects
  for all using (bucket_id = 'question-images' and auth.role() = 'service_role');
