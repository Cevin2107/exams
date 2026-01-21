# Hướng dẫn cập nhật Database

## Các tính năng mới đã thêm:

1. **Nhập tên học sinh**: Học sinh phải nhập tên trước khi vào làm bài
2. **Tự động nộp bài**: Bài tập sẽ tự động nộp khi hết thời gian
3. **Tracking trạng thái học sinh**: 
   - "Đang làm" - khi học sinh đang làm bài
   - "Đã thoát" - khi học sinh thoát ra nhưng chưa nộp
   - "Đã nộp" - khi học sinh đã nộp bài
4. **Thống kê học sinh trên Admin**: Hiển thị danh sách học sinh, số lần vào bài, điểm số

## Bước 1: Cập nhật Database Schema

Vào Supabase SQL Editor và chạy các câu lệnh SQL sau:

### 1. Thêm cột student_name vào bảng submissions

```sql
-- Thêm cột student_name (bắt buộc)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS student_name text;

-- Cập nhật giá trị mặc định cho các bản ghi cũ (nếu có)
UPDATE submissions SET student_name = 'Unknown' WHERE student_name IS NULL;

-- Thêm constraint NOT NULL
ALTER TABLE submissions ALTER COLUMN student_name SET NOT NULL;
```

### 2. Tạo bảng student_sessions mới

```sql
-- Tạo bảng tracking trạng thái học sinh
CREATE TABLE IF NOT EXISTS student_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','exited','submitted')),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  submission_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tạo indexes
CREATE INDEX IF NOT EXISTS idx_student_sessions_assignment ON student_sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_student ON student_sessions(student_name);

-- Enable RLS
ALTER TABLE student_sessions ENABLE ROW LEVEL SECURITY;

-- Policies cho student_sessions
DROP POLICY IF EXISTS "Public insert student sessions" ON student_sessions;
DROP POLICY IF EXISTS "Public update student sessions" ON student_sessions;
DROP POLICY IF EXISTS "Service role manage student sessions" ON student_sessions;

CREATE POLICY "Public insert student sessions" ON student_sessions
  FOR INSERT WITH CHECK (auth.role() IN ('anon','authenticated'));

CREATE POLICY "Public update student sessions" ON student_sessions
  FOR UPDATE USING (auth.role() IN ('anon','authenticated')) WITH CHECK (true);

CREATE POLICY "Service role manage student sessions" ON student_sessions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
```

## Bước 2: Test các tính năng

1. **Test nhập tên học sinh**:
   - Truy cập trang chủ và click "Làm bài" trên một bài tập
   - Sẽ chuyển đến trang nhập tên
   - Nhập tên (ví dụ: "Huy") và click "Bắt đầu làm bài"
   - Kiểm tra tên hiển thị trên trang làm bài

2. **Test tự động nộp bài**:
   - Tạo một bài tập có thời gian ngắn (ví dụ: 1 phút)
   - Vào làm bài và đợi hết thời gian
   - Bài sẽ tự động nộp và chuyển đến trang kết quả

3. **Test tracking trạng thái**:
   - Vào trang Admin → chọn một bài tập
   - Xem phần "Danh sách học sinh"
   - Mở một tab mới và nhập tên học sinh khác vào làm bài
   - Quay lại trang admin và click nút "🔄 Làm mới"
   - Kiểm tra trạng thái của học sinh:
     - "Đang làm" - khi đang làm bài
     - "Đã thoát" - khi đóng tab mà chưa nộp
     - "Đã nộp" - khi đã nộp bài

4. **Test thống kê học sinh**:
   - Cho nhiều học sinh cùng vào làm bài
   - Một số học sinh nộp bài, một số không
   - Xem phần "Thống kê theo học sinh" trên trang admin
   - Kiểm tra số lần vào, số lần nộp, điểm trung bình và điểm cao nhất

## Bước 3: Xử lý lỗi (nếu có)

### Lỗi: "column student_name does not exist"
- Chạy lại bước 1.1 để thêm cột student_name

### Lỗi: "relation student_sessions already exists"
- Bảng đã được tạo, bỏ qua bước tạo bảng

### Lỗi: "null value in column student_name violates not-null constraint"
- Chạy câu lệnh UPDATE để cập nhật giá trị mặc định cho các bản ghi cũ

## Lưu ý

- Các tính năng mới hoạt động độc lập với dữ liệu cũ
- Học sinh cần nhập tên mỗi khi vào làm bài (tên được lưu trong localStorage)
- Admin có thể theo dõi real-time trạng thái học sinh bằng nút "Làm mới"
- Thống kê học sinh tự động tính toán từ dữ liệu sessions
