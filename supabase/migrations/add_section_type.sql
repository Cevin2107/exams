-- Add 'section' type to questions type constraint
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_type_check CHECK (type IN ('mcq', 'essay', 'section'));
