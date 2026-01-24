# Xóa dữ liệu hoàn toàn khi xóa bài tập

## Khi xóa bài tập (Assignment)

Function: `deleteAssignment()` trong `src/lib/supabaseHelpers.ts`

### Các bước xóa:

1. **Xóa ảnh từ Storage**
   - Tìm tất cả ảnh trong các câu hỏi
   - Xóa từng ảnh khỏi bucket `question-images`

2. **Xóa bài tập từ database**
   - Khi xóa `assignments`, cascade tự động xóa:
     - ✅ `questions` - Câu hỏi
     - ✅ `submissions` - Bài nộp
     - ✅ `answers` - Câu trả lời đã nộp
     - ✅ `student_sessions` - Thông tin session
     - ✅ `draft_answers` - Bài làm dở (trong student_sessions)

### Cascade trong database:

```sql
-- student_sessions
assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE

-- questions  
assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE

-- submissions
assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE

-- answers
submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE
```

## Tóm tắt

✅ **Tất cả dữ liệu sẽ bị xóa sạch:**
- Ảnh trong Storage
- Questions
- Submissions  
- Answers
- Student sessions
- Draft answers (bài làm dở)

❌ **KHÔNG thể khôi phục** sau khi xóa!

## Xem log

Khi xóa bài tập, console sẽ hiển thị:
```
Deleting X images from storage
Deleting assignment {id} and all related data
Successfully deleted assignment {id}
```
