"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SUBJECT_OPTIONS = ["Toán học", "Vật lý", "Hóa học"];
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`);
const CUSTOM_VALUE = "custom";

export default function NewAssignmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subjectSelect, setSubjectSelect] = useState<string>(SUBJECT_OPTIONS[0]);
  const [subjectCustom, setSubjectCustom] = useState("");
  const [gradeSelect, setGradeSelect] = useState<string>(GRADE_OPTIONS[0]);
  const [gradeCustom, setGradeCustom] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const resolvedSubject = subjectSelect === CUSTOM_VALUE ? subjectCustom.trim() : subjectSelect;
    const resolvedGrade = gradeSelect === CUSTOM_VALUE ? gradeCustom.trim() : gradeSelect;
    if (!resolvedSubject || !resolvedGrade) {
      setLoading(false);
      alert("Vui lòng chọn hoặc nhập môn học và lớp hợp lệ.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      subject: resolvedSubject,
      grade: resolvedGrade,
      dueAt: formData.get("dueAt") as string,
      durationMinutes: parseInt(formData.get("durationMinutes") as string) || undefined,
      totalScore: parseFloat(formData.get("totalScore") as string) || 10,
    };

    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        router.push(`/admin/assignments/${result.id}`);
      } else {
        console.error("Lỗi tạo bài tập");
      }
    } catch (err) {
      console.error("Lỗi kết nối:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow disabled:opacity-50"
          >
            {loading ? "Đang tạo..." : "Tạo bài tập"}
          </button>
        </form>
      </div>
    </main>
  );
}
