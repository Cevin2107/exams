"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SUBJECT_OPTIONS = ["Toán học", "Vật lý", "Hóa học"];
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`);
const CUSTOM_VALUE = "custom";

type BuilderMode = "manual" | "ai";

interface AiQuestion {
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correct_answer: "A" | "B" | "C" | "D";
}

export default function NewAssignmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<BuilderMode>("manual");
  const [subjectSelect, setSubjectSelect] = useState<string>(SUBJECT_OPTIONS[0]);
  const [subjectCustom, setSubjectCustom] = useState("");
  const [gradeSelect, setGradeSelect] = useState<string>(GRADE_OPTIONS[0]);
  const [gradeCustom, setGradeCustom] = useState("");
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiTextInput, setAiTextInput] = useState("");
  const [aiQuestions, setAiQuestions] = useState<AiQuestion[]>([]);
  const [aiPreviewText, setAiPreviewText] = useState("");
  const [aiSources, setAiSources] = useState<Array<{ name: string; chars: number; kind: string }>>([]);
  const [aiStatus, setAiStatus] = useState<"idle" | "running" | "error" | "done">("idle");
  const [aiMessage, setAiMessage] = useState("");
  const [aiError, setAiError] = useState("");
  const [savingAi, setSavingAi] = useState(false);

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
      alert("Vui lòng chọn hoặc nhập môn học và lớp hợp lệ.");
      return;
    }
    const { resolvedSubject, resolvedGrade } = resolved;

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

  const addAiFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    setAiFiles((prev) => [...prev, ...incoming].slice(0, 20));
    setAiError("");
  };

  const handleAiFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addAiFiles(files);
    e.target.value = "";
  };

  const handleAiPaste = (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.includes("image")) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      e.preventDefault();
      addAiFiles(files);
    }
  };

  const removeAiFile = (index: number) => {
    setAiFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addEmptyAiQuestion = () => {
    setAiQuestions((prev) => [
      ...prev,
      {
        question: "",
        options: { A: "", B: "", C: "", D: "" },
        correct_answer: "A",
      },
    ]);
  };

  const updateAiQuestion = (index: number, value: Partial<AiQuestion>) => {
    setAiQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...value } : q)));
  };

  const updateAiOption = (index: number, key: "A" | "B" | "C" | "D", value: string) => {
    setAiQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, options: { ...q.options, [key]: value } } : q))
    );
  };

  const removeAiQuestion = (index: number) => {
    setAiQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerateAi = async () => {
    if (!aiFiles.length && !aiTextInput.trim()) {
      setAiError("Thêm ít nhất 1 ảnh/PDF hoặc văn bản để AI xử lý.");
      return;
    }
    setAiStatus("running");
    setAiMessage("Đang quét nội dung và sinh câu hỏi...");
    setAiError("");

    const formData = new FormData();
    aiFiles.forEach((file) => formData.append("files", file));
    if (aiTextInput.trim()) {
      formData.append("manualText", aiTextInput.trim());
    }

    try {
      const res = await fetch("/api/admin/ai/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.details ? `\n${err.details}` : "";
        setAiError((err.error || "AI gặp lỗi, vui lòng thử lại.") + detail);
        setAiStatus("error");
        return;
      }

      const data = await res.json();
      setAiQuestions(data.questions || []);
      setAiPreviewText(data.cleanedText || "");
      setAiSources(data.sources || []);
      setAiStatus("done");
      setAiMessage("Đã sinh câu hỏi, hãy rà soát và chỉnh sửa trước khi lưu.");
    } catch {
      setAiError("Không thể tạo câu hỏi bằng AI lúc này.");
      setAiStatus("error");
    }
  };

  const handleSaveAiAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const resolved = resolveSubjectAndGrade();
    if (!resolved) {
      alert("Vui lòng chọn hoặc nhập môn học và lớp hợp lệ.");
      return;
    }
    if (aiQuestions.length === 0) {
      setAiError("Chưa có câu hỏi để lưu.");
      return;
    }

    setSavingAi(true);
    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        title: formData.get("title") as string,
        subject: resolved.resolvedSubject,
        grade: resolved.resolvedGrade,
        dueAt: formData.get("dueAt") as string,
        durationMinutes: parseInt(formData.get("durationMinutes") as string) || undefined,
        totalScore: parseFloat(formData.get("totalScore") as string) || 10,
      };

      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Lỗi tạo bài tập");
      const assignment = await res.json();

      for (const [index, q] of aiQuestions.entries()) {
        const questionRes = await fetch("/api/admin/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: assignment.id,
            type: "mcq",
            content: q.question,
            choices: [q.options.A, q.options.B, q.options.C, q.options.D],
            answerKey: q.correct_answer,
          }),
        });

        if (!questionRes.ok) {
          throw new Error(`Lỗi lưu câu hỏi ${index + 1}`);
        }
      }

      router.push(`/admin/assignments/${assignment.id}`);
    } catch (err) {
      console.error("Lỗi lưu AI assignment", err);
      setAiError("Không thể lưu bài tập, vui lòng thử lại.");
    } finally {
      setSavingAi(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Tạo bài tập mới</h1>
          <Link href="/admin/dashboard" className="text-sm text-slate-600 hover:text-slate-800">
            ← Quay lại
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
              mode === "manual"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-800 hover:border-slate-400"
            }`}
          >
            ✍️ Tạo thủ công
          </button>
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
              mode === "ai"
                ? "bg-indigo-600 text-white"
                : "border border-indigo-100 bg-white text-slate-800 hover:border-indigo-200"
            }`}
          >
            🤖 Tạo bằng AI (OCR)
          </button>
        </div>

        {mode === "manual" && (
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
        )}

        {mode === "ai" && (
          <form onSubmit={handleSaveAiAssignment} className="space-y-5 rounded-xl border border-indigo-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tên bài tập</label>
                <input
                  type="text"
                  name="title"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder="VD: Vật lý - Dao động điều hòa"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Hạn nộp</label>
                  <input
                    type="datetime-local"
                    name="dueAt"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Thời gian (phút)</label>
                  <input
                    type="number"
                    name="durationMinutes"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    placeholder="45"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Môn học</label>
                <div className="mt-1 flex flex-col gap-2">
                  <select
                    name="subjectSelect"
                    value={subjectSelect}
                    onChange={(e) => setSubjectSelect(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
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
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
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
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                      placeholder="Nhập lớp khác (vd: Lớp 10 nâng cao)"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tổng điểm</label>
                <input
                  type="number"
                  name="totalScore"
                  step="0.5"
                  defaultValue="10"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-800">Ảnh / PDF (paste hoặc upload)</label>
                <div
                  onPaste={handleAiPaste}
                  className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-4 text-sm text-slate-700"
                >
                  <p className="font-semibold text-indigo-700">Ctrl + V để dán nhiều ảnh cùng lúc</p>
                  <p className="text-center text-xs text-slate-600">Hỗ trợ nhiều ảnh và PDF, tối đa 8MB mỗi file</p>
                  <div className="flex gap-2">
                    <label className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700">
                      Chọn file
                      <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleAiFileInput} />
                    </label>
                    {aiFiles.length > 0 && (
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400"
                        onClick={() => setAiFiles([])}
                      >
                        Xóa danh sách file
                      </button>
                    )}
                  </div>
                </div>
                {aiFiles.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="text-xs font-semibold text-slate-600">Đã chọn ({aiFiles.length})</p>
                    {aiFiles.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1">
                        <span className="truncate text-slate-800">{file.name}</span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                          onClick={() => removeAiFile(idx)}
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-800">Văn bản bổ sung (tùy chọn)</label>
                <textarea
                  name="manualText"
                  value={aiTextInput}
                  onChange={(e) => setAiTextInput(e.target.value)}
                  onPaste={handleAiPaste}
                  rows={8}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder="Dán nội dung sẵn có hoặc mô tả ngắn..."
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateAi}
                    disabled={aiStatus === "running"}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow disabled:opacity-60"
                  >
                    {aiStatus === "running" ? "AI đang xử lý..." : "Tạo câu hỏi bằng AI"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiQuestions([]);
                      setAiPreviewText("");
                      setAiSources([]);
                      setAiStatus("idle");
                      setAiMessage("");
                      setAiError("");
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400"
                  >
                    Xóa kết quả AI
                  </button>
                  <div className="text-xs font-semibold text-slate-600">
                    {aiStatus === "running" && aiMessage}
                    {aiStatus === "done" && aiMessage}
                  </div>
                </div>
                {aiError && <p className="text-sm font-semibold text-red-600">{aiError}</p>}
              </div>
            </div>

            {aiSources.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-800">Nguồn đã quét</p>
                <div className="mt-1 grid gap-2 md:grid-cols-2">
                  {aiSources.map((s, idx) => (
                    <div key={`${s.name}-${idx}`} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1">
                      <span className="truncate">{s.name}</span>
                      <span className="text-[11px] text-slate-500">{s.kind} · {s.chars} ký tự</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiPreviewText && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold text-slate-600">Text đã làm sạch (rút gọn)</p>
                <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">{aiPreviewText}</pre>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Danh sách câu hỏi ({aiQuestions.length})</h3>
                <p className="text-sm text-slate-600">Chỉnh sửa tự do trước khi lưu xuống CSDL.</p>
              </div>
              <button
                type="button"
                onClick={addEmptyAiQuestion}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-400"
              >
                + Thêm câu mới
              </button>
            </div>

            {aiQuestions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                Chưa có câu hỏi. Hãy dùng AI tạo câu hỏi hoặc thêm thủ công.
              </div>
            ) : (
              <div className="space-y-4">
                {aiQuestions.map((q, idx) => (
                  <div key={`ai-q-${idx}`} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="text-xs font-semibold text-slate-500">Câu {idx + 1}</div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                        onClick={() => removeAiQuestion(idx)}
                      >
                        Xóa
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Nội dung</label>
                      <textarea
                        value={q.question}
                        onChange={(e) => updateAiQuestion(idx, { question: e.target.value })}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {(["A", "B", "C", "D"] as Array<"A" | "B" | "C" | "D">).map((key) => (
                        <div key={key} className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700">Đáp án {key}</label>
                          <input
                            value={q.options[key]}
                            onChange={(e) => updateAiOption(idx, key, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-semibold text-slate-700">Đáp án đúng</label>
                      <select
                        value={q.correct_answer}
                        onChange={(e) => updateAiQuestion(idx, { correct_answer: e.target.value as AiQuestion["correct_answer"] })}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                      >
                        {"ABCD".split("").map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600">
                AI chỉ hỗ trợ gợi ý. Admin cần rà soát trước khi lưu xuống CSDL.
              </div>
              <button
                type="submit"
                disabled={savingAi}
                className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow disabled:opacity-60"
              >
                {savingAi ? "Đang lưu..." : "Lưu bài tập"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
