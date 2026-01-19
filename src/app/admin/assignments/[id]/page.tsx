"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SUBJECT_OPTIONS = ["Toán học", "Vật lý", "Hóa học"];
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`);
const CUSTOM_VALUE = "custom";

interface Assignment {
  id: string;
  title: string;
  subject: string;
  grade: string;
  total_score: number;
  due_at?: string | null;
  duration_minutes?: number | null;
  is_hidden?: boolean;
}

interface Question {
  id: string;
  order: number;
  type: string;
  content: string;
  choices?: string[];
  answerKey?: string;
  points: number;
  imageUrl?: string;
}

interface Analytics {
  submissionCount: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  averageDuration: number;
  questionStats: Array<{ questionId: string; content: string; correctRate: number; total: number }>;
}

interface EditQuestionForm {
  content: string;
  type: "mcq" | "essay";
  choices: string[];
  answerKey: string;
  imageUrl: string;
}

export default function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    subject: "",
    grade: "",
    dueAt: "",
    durationMinutes: "",
    totalScore: "",
    isHidden: false,
  });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionForm, setEditQuestionForm] = useState<EditQuestionForm>({
    content: "",
    type: "mcq",
    choices: ["", "", "", ""],
    answerKey: "A",
    imageUrl: "",
  });
  const router = useRouter();
  const subjectSelectValue = SUBJECT_OPTIONS.includes(editForm.subject) ? editForm.subject : CUSTOM_VALUE;
  const gradeSelectValue = GRADE_OPTIONS.includes(editForm.grade) ? editForm.grade : CUSTOM_VALUE;

  const handleSubjectSelectChange = (value: string) => {
    setEditForm((p) => {
      if (value === CUSTOM_VALUE) {
        const carry = SUBJECT_OPTIONS.includes(p.subject) ? "" : p.subject;
        return { ...p, subject: carry };
      }
      return { ...p, subject: value };
    });
  };

  const handleGradeSelectChange = (value: string) => {
    setEditForm((p) => {
      if (value === CUSTOM_VALUE) {
        const carry = GRADE_OPTIONS.includes(p.grade) ? "" : p.grade;
        return { ...p, grade: carry };
      }
      return { ...p, grade: value };
    });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    params.then(p => {
      setAssignmentId(p.id);
      loadData(p.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(id: string) {
    try {
      const res = await fetch(`/api/admin/assignments/${id}`);
      const data = await res.json();
      setAssignment(data.assignment);
      setQuestions(data.questions || []);
      if (data.assignment) {
        setEditForm({
          title: data.assignment.title || "",
          subject: data.assignment.subject || "",
          grade: data.assignment.grade || "",
          dueAt: data.assignment.due_at ? data.assignment.due_at.slice(0, 16) : "",
          durationMinutes: data.assignment.duration_minutes ?? "",
          totalScore: data.assignment.total_score?.toString() ?? "",
          isHidden: Boolean(data.assignment.is_hidden),
        });
      }
      loadAnalytics(id);
    } catch (err) {
      console.error("Lỗi tải dữ liệu:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics(id: string) {
    try {
      setAnalyticsLoading(true);
      const res = await fetch(`/api/admin/assignments/${id}/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Lỗi tải thống kê:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/admin/upload-image", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }

    const data = await res.json();
    return data.url as string;
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;

        setUploading(true);
        try {
          const url = await uploadImage(file);
          setImagePreview(url);
        } catch (error) {
          console.error("Lỗi khi upload ảnh:", error);
        } finally {
          setUploading(false);
        }
        break;
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadImage(file);
      setImagePreview(url);
    } catch (error) {
      console.error("Lỗi khi upload ảnh:", error);
    } finally {
      setUploading(false);
    }
  };

  async function handleAddQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const type = formData.get("type") as string;
    const choices = type === "mcq" 
      ? [
          formData.get("choice0") as string,
          formData.get("choice1") as string,
          formData.get("choice2") as string,
          formData.get("choice3") as string,
        ].filter(Boolean)
      : undefined;

    const data = {
      assignmentId,
      order: questions.length + 1,
      type,
      content: formData.get("content") as string,
      choices,
      answerKey: type === "mcq" ? (formData.get("answerKey") as string) : undefined,
      imageUrl: imagePreview || undefined,
    };

    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setShowAddForm(false);
        setImagePreview("");
        loadData(assignmentId);
      } else {
        console.error("Lỗi thêm câu hỏi");
      }
    } catch (err) {
      console.error("Lỗi kết nối:", err);
    }
  }

  async function handleUpdateAssignment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const payload = {
        title: editForm.title,
        subject: editForm.subject,
        grade: editForm.grade,
        dueAt: editForm.dueAt ? new Date(editForm.dueAt).toISOString() : null,
        durationMinutes: editForm.durationMinutes === "" ? null : Number(editForm.durationMinutes),
        totalScore: editForm.totalScore === "" ? undefined : Number(editForm.totalScore),
        isHidden: editForm.isHidden,
      };

      const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Cập nhật thất bại");
      await loadData(assignmentId);
      setShowEditForm(false);
    } catch (err) {
      console.error("Lỗi cập nhật bài tập:", err);
    }
  }

  async function handleExtendDue(minutes: number) {
    if (!assignment) return;
    const base = assignment.due_at ? new Date(assignment.due_at) : new Date();
    const next = new Date(base.getTime() + minutes * 60 * 1000);
    try {
      const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: next.toISOString() }),
      });
      if (!res.ok) throw new Error("Gia hạn thất bại");
      await loadData(assignmentId);
    } catch (err) {
      console.error("Lỗi gia hạn:", err);
    }
  }

  async function handleDeleteAssignment() {
    if (!assignmentId || deleting) return;
    const confirmed = confirm("Xóa bài tập này? Hành động này sẽ xóa cả câu hỏi và các lần nộp.");
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/assignments/${assignmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xóa thất bại");
      router.push("/admin/dashboard");
    } catch (err) {
      console.error("Lỗi xóa bài tập:", err);
      setDeleting(false);
    }
  }

  function handleExportCsv() {
    window.open(`/api/admin/assignments/${assignmentId}/export`, "_blank");
  }

  function startEditQuestion(q: Question) {
    setEditingQuestionId(q.id);
    setEditQuestionForm({
      content: q.content,
      type: q.type as "mcq" | "essay",
      choices: q.choices || ["", "", "", ""],
      answerKey: q.answerKey || "A",
      imageUrl: q.imageUrl || "",
    });
  }

  async function submitEditQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingQuestionId) return;
    try {
      const payload: {
        type: "mcq" | "essay";
        content: string;
        choices?: string[];
        answerKey?: string | null;
        imageUrl: string | null;
      } = {
        type: editQuestionForm.type,
        content: editQuestionForm.content,
        choices: editQuestionForm.type === "mcq" ? editQuestionForm.choices.filter(Boolean) : undefined,
        answerKey: editQuestionForm.type === "mcq" ? editQuestionForm.answerKey : null,
        imageUrl: editQuestionForm.imageUrl || null,
      };

      const res = await fetch(`/api/admin/questions/${editingQuestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Cập nhật câu hỏi thất bại");
      setEditingQuestionId(null);
      await loadData(assignmentId);
    } catch (err) {
      console.error("Lỗi cập nhật câu hỏi:", err);
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!confirm("Xóa câu hỏi này?")) return;
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xóa thất bại");
      await loadData(assignmentId);
    } catch (err) {
      console.error("Lỗi xóa câu hỏi:", err);
    }
  }

  if (loading) return <div className="p-8 text-center">Đang tải...</div>;
  if (!assignment) return <div className="p-8 text-center">Không tìm thấy bài tập</div>;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{assignment.title}</h1>
            <p className="text-sm text-slate-600">{assignment.subject} · {assignment.grade}</p>
            <p className="text-xs text-slate-500 mt-1">
              Hạn: {assignment.due_at ? new Date(assignment.due_at).toLocaleString("vi-VN") : "Chưa đặt"}
              {assignment.is_hidden ? " · Đang ẩn" : ""}
            </p>
          </div>
          <Link href="/admin/dashboard" className="text-sm text-slate-600 hover:text-slate-800">
            ← Quay lại
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Thông tin bài tập</h2>
              <p className="text-sm text-slate-600">Tổng điểm: {assignment.total_score}</p>
              <p className="text-sm text-slate-600">Thời gian: {assignment.duration_minutes ? `${assignment.duration_minutes} phút` : "Không giới hạn"}</p>
              <p className="text-sm text-slate-600">Hạn nộp: {assignment.due_at ? new Date(assignment.due_at).toLocaleString("vi-VN") : "Chưa đặt"}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setShowEditForm((v) => !v)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400"
              >
                {showEditForm ? "Đóng" : "Chỉnh sửa"}
              </button>
              <button
                onClick={handleDeleteAssignment}
                disabled={deleting}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 disabled:opacity-60"
              >
                {deleting ? "Đang xóa..." : "Xóa bài"}
              </button>
              <button
                onClick={() => handleExtendDue(30)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-slate-400"
              >
                +30 phút
              </button>
              <button
                onClick={() => handleExtendDue(60)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-slate-400"
              >
                +1 giờ
              </button>
              <button
                onClick={handleExportCsv}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
              >
                Xuất CSV
              </button>
            </div>
          </div>
        </div>

        {showEditForm && (
          <form onSubmit={handleUpdateAssignment} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tên bài tập</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Môn học</label>
                <div className="mt-1 flex flex-col gap-2">
                  <select
                    value={subjectSelectValue}
                    onChange={(e) => handleSubjectSelectChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                    required
                  >
                    {SUBJECT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value={CUSTOM_VALUE}>Khác</option>
                  </select>
                  {subjectSelectValue === CUSTOM_VALUE && (
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                      value={editForm.subject}
                      onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
                      required
                      placeholder="Nhập môn khác"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Lớp</label>
                <div className="mt-1 flex flex-col gap-2">
                  <select
                    value={gradeSelectValue}
                    onChange={(e) => handleGradeSelectChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                    required
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                    <option value={CUSTOM_VALUE}>Khác</option>
                  </select>
                  {gradeSelectValue === CUSTOM_VALUE && (
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                      value={editForm.grade}
                      onChange={(e) => setEditForm((p) => ({ ...p, grade: e.target.value }))}
                      required
                      placeholder="Nhập lớp khác (vd: Lớp 10 nâng cao)"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Hạn nộp</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={editForm.dueAt}
                  onChange={(e) => setEditForm((p) => ({ ...p, dueAt: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Thời gian (phút)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={editForm.durationMinutes}
                  onChange={(e) => setEditForm((p) => ({ ...p, durationMinutes: e.target.value }))}
                  placeholder="Ví dụ: 30"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tổng điểm</label>
                <input
                  type="number"
                  step="0.5"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={editForm.totalScore}
                  onChange={(e) => setEditForm((p) => ({ ...p, totalScore: e.target.value }))}
                  required
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.isHidden}
                    onChange={(e) => setEditForm((p) => ({ ...p, isHidden: e.target.checked }))}
                  />
                  Ẩn bài
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Câu hỏi ({questions.length})</h2>
            <p className="text-sm text-slate-600">Tổng điểm: {assignment.total_score}</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
          >
            {showAddForm ? "Hủy" : "+ Thêm câu hỏi"}
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Báo cáo nhanh</h3>
            {analyticsLoading && <span className="text-xs text-slate-500">Đang tải...</span>}
          </div>
          {analytics ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="text-slate-500">Điểm trung bình</p>
                  <p className="text-xl font-semibold text-slate-900">{analytics.averageScore.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="text-slate-500">Cao nhất / Thấp nhất</p>
                  <p className="text-xl font-semibold text-slate-900">{analytics.maxScore.toFixed(2)} / {analytics.minScore.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="text-slate-500">Thời gian TB</p>
                  <p className="text-xl font-semibold text-slate-900">{Math.round((analytics.averageDuration || 0) / 60)} phút</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="text-slate-500">Số lần nộp</p>
                  <p className="text-xl font-semibold text-slate-900">{analytics.submissionCount}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Câu sai nhiều</p>
                {analytics.questionStats.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.questionStats.map((q) => (
                      <div key={q.questionId} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <span className="truncate text-slate-800">{q.content}</span>
                        <span className="text-xs font-semibold text-slate-600">{Math.round(q.correctRate * 100)}% đúng ({q.total} lần)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Chưa có thống kê.</p>
          )}
        </div>

        {showAddForm && (
          <form onSubmit={handleAddQuestion} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-slate-700">Loại câu hỏi</label>
              <select
                name="type"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                onChange={(e) => {
                  const form = e.currentTarget.form;
                  const choicesDiv = form?.querySelector("#choices-section");
                  if (choicesDiv) {
                    (choicesDiv as HTMLElement).style.display = e.target.value === "mcq" ? "block" : "none";
                  }
                }}
              >
                <option value="mcq">Trắc nghiệm</option>
                <option value="essay">Tự luận</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                📷 Ảnh câu hỏi (paste ảnh vào ô dưới hoặc tải lên)
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {uploading ? "Đang tải..." : "📁 Chọn ảnh"}
                </button>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => setImagePreview("")}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    ✕ Xóa ảnh
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {imagePreview && (
                <div className="mt-3 rounded-lg border border-slate-200 p-2">
                  <img src={imagePreview} alt="Preview" className="max-h-64 w-auto rounded" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Nội dung câu hỏi (Ctrl+V để paste ảnh)</label>
              <textarea
                name="content"
                rows={3}
                onPaste={handlePaste}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="Nhập câu hỏi hoặc Ctrl+V để paste ảnh..."
              />
            </div>

            <div id="choices-section">
              <label className="block text-sm font-medium text-slate-700">Đáp án (trắc nghiệm)</label>
              <div className="mt-1 space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    type="text"
                    name={`choice${i}`}
                    placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  />
                ))}
              </div>
              <div className="mt-2">
                <label className="block text-sm font-medium text-slate-700">Đáp án đúng</label>
                <select
                  name="answerKey"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
            </div>

            <p className="text-sm text-slate-600">Điểm sẽ được hệ thống chia đều theo tổng điểm bài tập.</p>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              Thêm câu hỏi
            </button>
          </form>
        )}

        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <p className="text-slate-600">Chưa có câu hỏi nào. Thêm câu hỏi đầu tiên!</p>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Câu {idx + 1} · {q.type === "mcq" ? "Trắc nghiệm" : "Tự luận"} · {Number(q.points ?? 0).toFixed(3)} điểm
                    </p>
                    {q.imageUrl && (
                      <div className="my-3 rounded-lg border border-slate-200 p-2">
                        <img src={q.imageUrl} alt="Câu hỏi" className="max-h-64 w-auto rounded" />
                      </div>
                    )}
                    {q.content && <p className="mt-1 text-base font-medium text-slate-900">{q.content}</p>}
                    {q.choices && (
                      <div className="mt-2 space-y-1 text-sm text-slate-600">
                        {q.choices.map((c, ci) => (
                          <div key={ci}>
                            <span className="font-semibold">{String.fromCharCode(65 + ci)}.</span> {c}
                            {q.answerKey === String.fromCharCode(65 + ci) && (
                              <span className="ml-2 text-emerald-600">✓</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-xs">
                    <button
                      className="rounded border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:border-slate-400"
                      onClick={() => startEditQuestion(q)}
                      type="button"
                    >
                      Sửa
                    </button>
                    <button
                      className="rounded border border-red-200 px-3 py-1 font-semibold text-red-600 hover:border-red-400"
                      onClick={() => handleDeleteQuestion(q.id)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
                {editingQuestionId === q.id && (
                  <form onSubmit={submitEditQuestion} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Loại</label>
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                          value={editQuestionForm.type}
                          onChange={(e) => setEditQuestionForm((p) => ({ ...p, type: e.target.value as "mcq" | "essay" }))}
                        >
                          <option value="mcq">Trắc nghiệm</option>
                          <option value="essay">Tự luận</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Ảnh (URL)</label>
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                          value={editQuestionForm.imageUrl}
                          onChange={(e) => setEditQuestionForm((p) => ({ ...p, imageUrl: e.target.value }))}
                          placeholder="Dán URL ảnh hoặc để trống"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Nội dung</label>
                      <textarea
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                        rows={3}
                        value={editQuestionForm.content}
                        onChange={(e) => setEditQuestionForm((p) => ({ ...p, content: e.target.value }))}
                      />
                    </div>

                    {editQuestionForm.type === "mcq" && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {[0, 1, 2, 3].map((i) => (
                          <input
                            key={i}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                            value={editQuestionForm.choices[i] || ""}
                            onChange={(e) => {
                              const next = [...editQuestionForm.choices];
                              next[i] = e.target.value;
                              setEditQuestionForm((p) => ({ ...p, choices: next }));
                            }}
                            placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                          />
                        ))}
                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                          value={editQuestionForm.answerKey}
                          onChange={(e) => setEditQuestionForm((p) => ({ ...p, answerKey: e.target.value }))}
                        >
                          {"ABCD".split("").map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingQuestionId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                      >
                        Lưu câu hỏi
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
