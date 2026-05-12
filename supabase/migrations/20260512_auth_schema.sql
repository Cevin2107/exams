-- Reset and create new auth schema for student accounts
-- Run this once in Supabase SQL Editor

-- 1. Drop old tables (if they exist)
drop table if exists assignment_assignments cascade;
drop table if exists student_profiles cascade;
drop table if exists student_sessions cascade;

-- 2. Student profiles table (extends auth.users)
create table student_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Assignment assignments table (which students can see which assignments)
create table assignment_assignments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  student_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(assignment_id, student_id)
);

-- 4. Trigger to auto-create student profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.student_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Student'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Enable RLS
alter table assignment_assignments enable row level security;
alter table student_profiles enable row level security;

-- 6. RLS policies
create policy "Students can view their own assignments"
  on assignment_assignments for select
  using (auth.uid() = student_id);

create policy "Users can view their own profile"
  on student_profiles for select
  using (auth.uid() = id);

-- 7. Indexes for performance
create index idx_assignment_assignments_student_id on assignment_assignments(student_id);
create index idx_assignment_assignments_assignment_id on assignment_assignments(assignment_id);
