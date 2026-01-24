-- Add draft_answers column to student_sessions table
-- This allows storing in-progress answers that can be resumed later

ALTER TABLE student_sessions 
ADD COLUMN IF NOT EXISTS draft_answers jsonb DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN student_sessions.draft_answers IS 'JSON object storing draft answers: {"question_id": "answer_value", ...}';
