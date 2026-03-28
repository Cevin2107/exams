"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ArrowLeft, BookOpen, Clock, Save, Settings2, Target, EyeOff, LayoutTemplate } from "lucide-react";

const SUBJECT_OPTIONS = ["Toán học", "Vật lý", "Hóa học"];
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`);
const CUSTOM_VALUE = "custom";

export default function NewAssignmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorObj, setErrorObj] = useState<{ message: string; type: string } | null>(null);

  const [subjectSelect, setSubjectSelect] = useState<string>(SUBJECT_OPTIONS[0]);
  const [subjectCustom, setSubjectCustom] = useState("");
  const [gradeSelect, setGradeSelect] = useState<string>(GRADE_OPTIONS[0]);
  const [gradeCustom, setGradeCustom] = useState("");
  const [hideScore, setHideScore] = useState(false);
  const [pointRanges, setPointRanges] = useState<Array<{ fromQuestion: number; toQuestion: number; totalPoints: number }>>([]);

  const resolveSubjectAndGrade = () => {
    const resolvedSubject = subjectSelect === CUSTOM_VALUE ? subjectCustom.trim() : subjectSelect;
    const resolvedGrade = gradeSelect === CUSTOM_VALUE ? gradeCustom.trim() : gradeSelect;
    if (!resolvedSubject || !resolvedGrade) return null;
    return { resolvedSubject, resolvedGrade };
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorObj(null);

    const resolved = resolveSubjectAndGrade();
    if (!resolved) {
      setLoading(false);
      setErrorObj({ message: "Vui lòng chọn hoặc nhập môn học và lớp hợp lệ.", type: "error" });
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
        router.push(`/admin/assignments/${result.id}`);
      } else {
        const text = await res.text();
        try {
          const errorData = JSON.parse(text);
          setErrorObj({ message: errorData.error || text, type: "error" });
        } catch {
          setErrorObj({ message: text, type: "error" });
        }
      }
    } catch (err: any) {
      setErrorObj({ message: err.message || "Unknown error", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="mb-2 -ml-3 text-slate-500">
               <ArrowLeft className="h-4 w-4 mr-2" />
               Quay lại
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tạo bài tập mới</h1>
          <p className="text-sm text-slate-500 mt-1">Cấu hình thông tin cơ bản cho bài tập trước khi biên soạn câu hỏi.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6">
           {errorObj && (
            <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200 flex items-center gap-2">
               <EyeOff className="h-4 w-4" />
               {errorObj.message}
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                 <BookOpen className="h-4 w-4 text-slate-500" />
                 Tên bài tập
              </label>
              <input
                type="text"
                name="title"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                placeholder="VD: Kiểm tra Toán - Hàm số bậc nhất 15 phút"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                   <Target className="h-4 w-4 text-slate-500" />
                   Môn học
                </label>
                <div className="flex flex-col gap-2">
                  <select
                    name="subjectSelect"
                    value={subjectSelect}
                    onChange={(e) => setSubjectSelect(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white"
                    required
                  >
                    {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    <option value={CUSTOM_VALUE}>Khác</option>
                  </select>
                  {subjectSelect === CUSTOM_VALUE && (
                    <input
                      type="text"
                      name="subjectCustom"
                      value={subjectCustom}
                      onChange={(e) => setSubjectCustom(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                      placeholder="Nhập môn khác"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                   <LayoutTemplate className="h-4 w-4 text-slate-500" />
                   Phân loại Lớp
                </label>
                <div className="flex flex-col gap-2">
                  <select
                    name="gradeSelect"
                    value={gradeSelect}
                    onChange={(e) => setGradeSelect(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white"
                    required
                  >
                    {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                    <option value={CUSTOM_VALUE}>Khác</option>
                  </select>
                  {gradeSelect === CUSTOM_VALUE && (
                    <input
                      type="text"
                      name="gradeCustom"
                      value={gradeCustom}
                      onChange={(e) => setGradeCustom(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                      placeholder="Nhập lớp khác (vd: Lớp 10 nâng cao)"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                   <Clock className="h-4 w-4 text-slate-500" />
                   Hạn nộp bài
                </label>
                <input
                  type="datetime-local"
                  name="dueAt"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                   <Clock className="h-4 w-4 text-slate-500" />
                   Thời gian (phút)
                </label>
                <input
                  type="number"
                  name="durationMinutes"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                  placeholder="Để trống nếu không đếm ngược"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                   <Settings2 className="h-4 w-4 text-slate-500" />
                   Tổng điểm
                </label>
                <input
                  type="number"
                  name="totalScore"
                  step="0.5"
                  defaultValue="10"
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Cài đặt nâng cao */}
        <div className="grid gap-6 md:grid-cols-2 items-start">
           <Card className="p-5 flex gap-4 h-full border-indigo-100 bg-indigo-50/30">
              <div className="mt-0.5">
                 <input
                  type="checkbox"
                  id="hideScoreCheck"
                  checked={hideScore}
                  onChange={(e) => setHideScore(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                />
              </div>
              <div>
                 <label htmlFor="hideScoreCheck" className="text-sm font-bold text-slate-900 cursor-pointer block">
                    Ẩn điểm sau khi nộp
                 </label>
                 <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    Học sinh sẽ thấy thông báo "Đã nhận bài" thay vì điểm số cụ thể. Hữu ích cho bài thi cần tự luận.
                 </p>
              </div>
           </Card>

           <Card className="p-5 h-full">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-sm font-bold text-slate-900">Chia điểm theo nhóm câu</h3>
                 <Button type="button" variant="outline" size="sm" onClick={() => setPointRanges(p => [...p, { fromQuestion: 1, toQuestion: 10, totalPoints: 5 }])}>
                    Thêm nhóm
                 </Button>
               </div>
               
               {pointRanges.length === 0 ? (
                  <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 text-center">
                    Mặc định chia đều tổng điểm cho từng câu. Thêm nhóm nếu muốn chia khác biệt.
                  </div>
               ) : (
                  <div className="space-y-3">
                    {pointRanges.map((range, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100">
                        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Từ câu</span>
                        <input
                          type="number"
                          min={1}
                          value={range.fromQuestion}
                          onChange={(e) => setPointRanges(p => {
                            const updated = [...p];
                            updated[idx] = { ...updated[idx], fromQuestion: parseInt(e.target.value) || 1 };
                            return updated;
                          })}
                          className="w-14 rounded border border-slate-200 px-2 py-1 text-sm text-center"
                        />
                        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">đến</span>
                        <input
                          type="number"
                          min={1}
                          value={range.toQuestion}
                          onChange={(e) => setPointRanges(p => {
                            const updated = [...p];
                            updated[idx] = { ...updated[idx], toQuestion: parseInt(e.target.value) || 1 };
                            return updated;
                          })}
                          className="w-14 rounded border border-slate-200 px-2 py-1 text-sm text-center"
                        />
                        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">tổng</span>
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
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-sm text-center"
                        />
                        <button
                          type="button"
                          onClick={() => setPointRanges(p => p.filter((_, i) => i !== idx))}
                          className="ml-auto text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded hover:bg-red-50"
                        >
                          ✕ Lược bỏ
                        </button>
                      </div>
                    ))}
                  </div>
               )}
           </Card>
        </div>

        <div className="flex justify-end pt-4">
           <Link href="/admin/dashboard">
             <Button type="button" variant="ghost" className="mr-3">
               Hủy
             </Button>
           </Link>
           <Button type="submit" variant="brand" size="lg" disabled={loading} className="px-8 shadow-md hover:shadow-lg">
             {loading ? "Đang xử lý..." : "Lưu & Biên soạn câu hỏi"}
             {!loading && <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />}
           </Button>
        </div>
      </form>
    </div>
  );
}
