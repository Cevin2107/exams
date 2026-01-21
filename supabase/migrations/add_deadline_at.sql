-- Migration: Add deadline_at and exit_count columns to student_sessions table
-- Run this in Supabase SQL Editor

-- Add the deadline_at column
ALTER TABLE student_sessions ADD COLUMN IF NOT EXISTS deadline_at timestamptz;

-- Add the exit_count column
ALTER TABLE student_sessions ADD COLUMN IF NOT EXISTS exit_count integer NOT NULL DEFAULT 0;

-- Update existing sessions to calculate deadline_at based on started_at + duration
UPDATE student_sessions ss
SET deadline_at = (
  SELECT 
    CASE 
      WHEN a.duration_minutes IS NOT NULL THEN 
        ss.started_at + (a.duration_minutes || ' minutes')::interval
      WHEN a.due_at IS NOT NULL THEN 
        a.due_at
      ELSE 
        NULL
    END
  FROM assignments a
  WHERE a.id = ss.assignment_id
)
WHERE deadline_at IS NULL AND status = 'active';

-- Verify the update
SELECT 
  ss.id,
  ss.student_name,
  ss.started_at,
  ss.deadline_at,
  ss.status,
  ss.exit_count,
  a.duration_minutes,
  a.due_at
FROM student_sessions ss
JOIN assignments a ON a.id = ss.assignment_id
ORDER BY ss.created_at DESC
LIMIT 10;
