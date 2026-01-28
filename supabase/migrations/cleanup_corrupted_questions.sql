-- Clean up corrupted questions with null assignment_id
-- Run this in Supabase SQL Editor

-- First, check how many corrupted records exist
SELECT COUNT(*) as corrupted_count
FROM questions
WHERE assignment_id IS NULL;

-- View the corrupted records
SELECT id, assignment_id, "order", type, content, created_at
FROM questions
WHERE assignment_id IS NULL;

-- Delete corrupted records
DELETE FROM questions
WHERE assignment_id IS NULL;

-- Verify cleanup
SELECT COUNT(*) as remaining_corrupted
FROM questions
WHERE assignment_id IS NULL;
