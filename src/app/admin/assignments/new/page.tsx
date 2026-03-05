"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";

const SUBJECT_OPTIONS = ["Toán học", "Vật lý", "Hóa học"];
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`);
const CUSTOM_VALUE = "custom";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

export default function NewAssignmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [subjectSelect, setSubjectSelect] = useState<string>(SUBJECT_OPTIONS[0]);
  const [subjectCustom, setSubjectCustom] = useState("");
  const [gradeSelect, setGradeSelect] = useState<string>(GRADE_OPTIONS[0]);
  const [gradeCustom, setGradeCustom] = useState("");
  const [hideScore, setHideScore] = useState(false);
  const [pointRanges, setPointRanges] = useState<Array<{ fromQuestion: number; toQuestion: number; totalPoints: number }>>([]);

  const resolveSubjectAndGrade = () => {
    const resolvedSubject = subjectSelect === CUSTOM_VALUE ? subjectCustom.trim() : subjectSelect;
    const resolvedGrade = gradeSelect === CUSTOM_VALUE ? gradeCustom.trim() : gradeSelect;
    if (!resolvedSubject || !resolvedGrade) {
      return null;
    }
    return { resolvedSubject, resolvedGrade };
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const resolved = resolveSubjectAndGrade();
    if (!resolved) {
      setLoading(false);
      setToast({ message: "Vui lòng chọn hoặc nhập môn học và lớp hợp lệ.", type: "error" });
      return;
    }
    const { resolvedSubject, resolvedGrade } = resolved;

    const formData = new FormData(e.currentTarget);
    
    // Convert datetime-local to Vietnam timezone (UTC+7)
    let dueAtISO = null;
    const dueAtInput = formData.get("dueAt") as string;
    if (dueAtInput) {
      const localDate = new Date(dueAtInput);
      const vietnamOffset = 7 * 60; // UTC+7 in minutes
      const localOffset = localDate.getTimezoneOffset(); // local offset from UTC
      const offsetDiff = vietnamOffset + localOffset;
      const adjustedDate = new Date(localDate.getTime() - offsetDiff * 60 * 1000);
      dueAtISO = adjustedDate.toISOString();
    }
    
    const data = {
      title: formData.get("title") as string,
      subject: resolvedSubject,
      grade: resolvedGrade,
      dueAt: dueAtISO,
      durationMinutes: parseInt(formData.get("durationMinutes") as string) || undefined,
      totalScore: parseFloat(formData.get("totalScore") as string) || 10,
      hideScore,
      pointRanges: pointRanges.length > 0 ? pointRanges : undefined,
    };

    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        setToast({ message: "Tạo bài tập thành công!", type: "success" });
        setTimeout(() => {
          router.push(`/admin/assignments/${result.id}`);
        }, 1000);
      } else {
        const text = await res.text();
        console.error("Lỗi tạo bài tập - Status:", res.status, "Response:", text);
        try {
          const errorData = JSON.parse(text);
          setToast({ message: `Lỗi tạo bài tập (${res.status}): ${errorData.error || text}`, type: "error" });
        } catch {
          setToast({ message: `Lỗi tạo bài tập (${res.status}): ${text}`, type: "error" });
        }
      }
    } catch (err) {
      console.error("Lỗi kết nối:", err);
      setToast({ message: `Lỗi kết nối: ${err instanceof Error ? err.message : "Unknown error"}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Tạo bài tập mới</h1>
          <Link href="/admin/dashboard" className="text-sm text-slate-600 hover:text-slate-800">
            ← Quay lại
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700">Tên bài tập</label>
            <input
              type="text"
              name="title"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="VD: Toán - Hàm số bậc nhất"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Môn học</label>
              <div className="mt-1 flex flex-col gap-2">
                <select
                  name="subjectSelect"
                  value={subjectSelect}
                  onChange={(e) => setSubjectSelect(e.target.value)}
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
                {subjectSelect === CUSTOM_VALUE && (
                  <input
                    type="text"
                    name="subjectCustom"
                    value={subjectCustom}
                    onChange={(e) => setSubjectCustom(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Nhập môn khác"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Lớp</label>
              <div className="mt-1 flex flex-col gap-2">
                <select
                  name="gradeSelect"
                  value={gradeSelect}
                  onChange={(e) => setGradeSelect(e.target.value)}
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
                {gradeSelect === CUSTOM_VALUE && (
                  <input
                    type="text"
                    name="gradeCustom"
                    value={gradeCustom}
                    onChange={(e) => setGradeCustom(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                    placeholder="Nhập lớp khác (vd: Lớp 10 nâng cao)"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Hạn nộp</label>
              <input
                type="datetime-local"
                name="dueAt"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Thời gian (phút)</label>
              <input
                type="number"
                name="durationMinutes"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Tổng điểm</label>
              <input
                type="number"
                name="totalScore"
                step="0.5"
                defaultValue="10"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">⚙️ Cài đặt hiển thị kết quả</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hideScore}
                onChange={(e) => setHideScore(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Ẩn điểm sau khi nộp bài</span>
                <p className="text-xs text-slate-500 mt-0.5">Học sinh sẽ không thấy điểm ngay sau nộp bài. Giáo viên sẽ công bố điểm sau.</p>
              </div>
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">📊 Phân bổ điểm theo nhóm câu</p>
              <button
                type="button"
                onClick={() => setPointRanges(p => [...p, { fromQuestion: 1, toQuestion: 10, totalPoints: 5 }])}
                className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 border border-blue-200"
              >
                + Thêm nhóm
              </button>
            </div>
            {pointRanges.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">Chưa có nhóm câu. Nhấn &quot;Thêm nhóm&quot; để cấu hình điểm theo phạm vi câu hỏi.</p>
            ) : (
              <div className="space-y-2">
                {pointRanges.map((range, idx) => (
                  <div key={idx} className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-600 shrink-0">Câu</span>
                    <input
                      type="number"
                      min={1}
                      value={range.fromQuestion}
                      onChange={(e) => setPointRanges(p => {
                        const updated = [...p];
                        updated[idx] = { ...updated[idx], fromQuestion: parseInt(e.target.value) || 1 };
                        return updated;
                      })}
                      className="w-16 rounded border border-slate-300 px-2 py-1 text-sm text-center focus:border-blue-400 focus:outline-none"
                    />
                    <span className="text-xs text-slate-600 shrink-0">đến câu</span>
                    <input
                      type="number"
                      min={1}
                      value={range.toQuestion}
                      onChange={(e) => setPointRanges(p => {
                        const updated = [...p];
                        updated[idx] = { ...updated[idx], toQuestion: parseInt(e.target.value) || 1 };
                        return updated;
                      })}
                      className="w-16 rounded border border-slate-300 px-2 py-1 text-sm text-center focus:border-blue-400 focus:outline-none"
                    />
                    <span className="text-xs text-slate-600 shrink-0">=</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={range.totalPoints}
                      onChange={(e) => setPointRanges(p => {
                        const updated = [...p];
                        updated[idx] = { ...updated[idx], totalPoints: parseFloat(e.target.value) || 0 };
                        return updated;
                      })}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-center focus:border-blue-400 focus:outline-none"
                    />
                    <span className="text-xs text-slate-600 shrink-0">điểm</span>
                    <button
                      type="button"
                      onClick={() => setPointRanges(p => p.filter((_, i) => i !== idx))}
                      className="ml-auto text-red-400 hover:text-red-600 text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow disabled:opacity-50"
          >
            {loading ? "Đang tạo..." : "Tạo bài tập"}
          </button>
        </form>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </main>
  );
}
