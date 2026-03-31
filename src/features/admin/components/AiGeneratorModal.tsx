"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Check, Loader2, Sparkles, Upload, X, Save, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import Toast from "@/components/Toast";
import { MathText } from "@/components/MathText";

interface AiQuestion {
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correct_answer: "A" | "B" | "C" | "D";
}

interface AiGeneratorModalProps {
  assignmentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ANSWER_OPTIONS = ["A", "B", "C", "D"] as const;

/** Kiểm tra xem tất cả đáp án có giống nhau không (đánh giá AI có bị lỗi không) */
function isSuspiciousAnswers(questions: AiQuestion[]): boolean {
  if (questions.length < 3) return false;
  const answers = new Set(questions.map((q) => q.correct_answer));
  return answers.size <= 1;
}

export function AiGeneratorModal({ assignmentId, isOpen, onClose, onSuccess }: AiGeneratorModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [textInput, setTextInput] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [aiQuestions, setAiQuestions] = useState<AiQuestion[]>([]);
  // Mutable copy for user to override AI answers
  const [editedQuestions, setEditedQuestions] = useState<AiQuestion[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Handle paste image from clipboard (Ctrl+V)
  const handlePaste = useCallback((clipboardData: DataTransfer | null) => {
    const items = clipboardData?.items;
    if (!items) return false;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setFiles((prev) => [...prev, file]);
          setToast({ message: "Đã thêm ảnh từ clipboard", type: "success" });
          return true;
        }
      }
    }
    return false;
  }, []);

  // Listen for paste events on images only (text goes naturally into textarea)
  useEffect(() => {
    if (!isOpen) return;

    const onWindowPaste = (event: ClipboardEvent) => {
      if (!event.clipboardData) return;
      const hasImage = Array.from(event.clipboardData.items || []).some((item) =>
        item.type.startsWith("image/")
      );
      if (!hasImage) return;

      const consumed = handlePaste(event.clipboardData);
      if (consumed) event.preventDefault();
    };

    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  }, [isOpen, handlePaste]);

  if (!isOpen) return null;

  async function handleGenerate() {
    if (files.length === 0 && !textInput.trim()) {
      setToast({ message: "Vui lòng chọn file PDF/Ảnh hoặc dán câu hỏi vào ô văn bản", type: "error" });
      return;
    }

    setStatus("running");
    setMessage("Đang phân tích dữ liệu...");
    setAiQuestions([]);
    setEditedQuestions([]);
    setSelectedIndices(new Set());

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      if (textInput.trim()) formData.append("manualText", textInput.trim());

      const res = await fetch("/api/admin/ai/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Lỗi tạo câu hỏi");
      }

      const data = await res.json();
      const questions: AiQuestion[] = data.questions || [];
      setAiQuestions(questions);
      setEditedQuestions(JSON.parse(JSON.stringify(questions))); // deep copy
      setSelectedIndices(new Set(questions.map((_: AiQuestion, i: number) => i)));
      setStatus("done");
      setMessage(`Đã tạo ${questions.length} câu hỏi`);
    } catch (err: unknown) {
      console.error(err);
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Không thể sinh câu hỏi. Vui lòng thử lại.");
    }
  }

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const setAnswer = (index: number, answer: "A" | "B" | "C" | "D") => {
    setEditedQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], correct_answer: answer };
      return next;
    });
  };

  const handleSaveSelected = async () => {
    if (selectedIndices.size === 0) return;
    setSaving(true);
    try {
      const selected = editedQuestions.filter((_, i) => selectedIndices.has(i));
      const res = await fetch(`/api/admin/assignments/${assignmentId}/ai-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiQuestions: selected }),
      });

      if (!res.ok) throw new Error("Không thể lưu câu hỏi");

      setToast({ message: `Đã lưu ${selected.length} câu hỏi thành công!`, type: "success" });
      setTimeout(() => {
        onSuccess();
        onClose();
        // Reset state
        setFiles([]);
        setTextInput("");
        setAiQuestions([]);
        setEditedQuestions([]);
        setStatus("idle");
      }, 1000);
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : "Lỗi lưu câu hỏi", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const suspicious = isSuspiciousAnswers(editedQuestions);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <Card className="flex w-full max-w-4xl flex-col max-h-[92vh] overflow-hidden bg-white shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            <h2 className="text-xl font-bold text-slate-900">AI Sinh câu hỏi trắc nghiệm</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {status === "idle" || status === "error" ? (
            <div className="space-y-5">
              {/* File upload */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Upload className="h-4 w-4 text-slate-400" />
                  Tải lên tài liệu (PDF, Ảnh)
                  <span className="ml-1 text-xs font-normal text-slate-400">(Ctrl+V để dán ảnh)</span>
                </label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-300 transition">
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="w-7 h-7 mb-1.5 text-slate-400" />
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold">Bấm để chọn file</span> hoặc kéo thả vào đây
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">PDF, Ảnh · Tối đa 8MB/file</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
                  />
                </label>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {files.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700"
                      >
                        {f.name}
                        <button
                          type="button"
                          onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                          className="ml-1 text-indigo-400 hover:text-indigo-700 transition"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Text input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Hoặc paste câu hỏi trực tiếp
                </label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="w-full h-44 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 resize-none placeholder:text-slate-400 font-mono leading-relaxed"
                  placeholder={"Câu 1. Cho 17,4 gam $MnO_2$ tác dụng hết với $HCl$...\nA. Phương án A\nB. Phương án B\nC. Phương án C\nD. Phương án D\n\nCâu 2. ..."}
                />
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  AI sẽ tự động tách từng câu, kiểm tra cấu trúc và giải đáp án. Hỗ trợ LaTeX ($...$).
                </p>
              </div>

              {status === "error" && (
                <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              <Button onClick={handleGenerate} variant="brand" className="w-full text-base py-5">
                <Sparkles className="h-5 w-5 mr-2" />
                Bắt đầu tạo câu hỏi
              </Button>
            </div>
          ) : status === "running" ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-indigo-500 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-900">AI đang xử lý...</p>
                <p className="text-sm text-slate-500 mt-1">{message}</p>
                <p className="text-xs text-slate-400 mt-3">Quá trình có thể mất 30–90 giây</p>
              </div>
            </div>
          ) : (
            /* Results view */
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {editedQuestions.length} câu hỏi
                  </span>
                  {suspicious && (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full ring-1 ring-amber-200 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      AI chưa chắc đáp án – hãy kiểm tra lại
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedIndices.size === editedQuestions.length) setSelectedIndices(new Set());
                      else setSelectedIndices(new Set(editedQuestions.map((_, i) => i)));
                    }}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition"
                  >
                    {selectedIndices.size === editedQuestions.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </button>
                </div>
              </div>

              {suspicious && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                  <span>
                    AI trả về quá nhiều đáp án giống nhau. Bạn có thể bấm vào từng câu để tự chọn đáp án đúng trước khi lưu.
                  </span>
                </div>
              )}

              {/* Question list */}
              <div className="space-y-3">
                {editedQuestions.map((q, i) => {
                  const isSelected = selectedIndices.has(i);
                  const isExpanded = expandedIndex === i;
                  const original = aiQuestions[i];
                  const answerChanged = original && q.correct_answer !== original.correct_answer;

                  return (
                    <div
                      key={i}
                      className={`rounded-xl border-2 transition-all ${
                        isSelected ? "border-indigo-400 bg-indigo-50/20" : "border-slate-200"
                      }`}
                    >
                      {/* Question header - click to select */}
                      <div
                        className="flex items-start gap-3 p-4 cursor-pointer"
                        onClick={() => toggleSelect(i)}
                      >
                        {/* Checkbox */}
                        <div
                          className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-500 text-white"
                              : "border-slate-300"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>

                        {/* Question text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-slate-800 leading-snug">
                            <span className="text-slate-400 font-normal mr-1">Câu {i + 1}.</span>
                            <MathText text={q.question} />
                          </p>
                          {/* Compact answer preview */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {ANSWER_OPTIONS.map((opt) => (
                              <span
                                key={opt}
                                className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                                  opt === q.correct_answer
                                    ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {opt}
                              </span>
                            ))}
                            {answerChanged && (
                              <span className="text-xs text-blue-600 font-medium ml-1">✎ Đã sửa</span>
                            )}
                          </div>
                        </div>

                        {/* Expand toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedIndex(isExpanded ? null : i);
                          }}
                          className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Expanded: full options + manual answer selection */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ANSWER_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAnswer(i, opt);
                                }}
                                className={`text-left rounded-lg px-3 py-2 text-sm transition-all ring-1 ${
                                  opt === q.correct_answer
                                    ? "bg-emerald-50 text-emerald-800 font-semibold ring-emerald-300"
                                    : "bg-slate-50 text-slate-700 ring-slate-200 hover:ring-indigo-300 hover:bg-indigo-50/30"
                                }`}
                              >
                                <span className="font-bold mr-1.5">{opt}.</span>
                                <MathText text={String(q.options[opt])} />
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-slate-400">
                            Bấm vào đáp án để đặt là đúng • Đáp án AI gốc:{" "}
                            <strong className="text-slate-600">{original?.correct_answer}</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === "done" && (
          <div className="border-t border-slate-100 p-4 bg-slate-50/80 flex items-center justify-between gap-3 rounded-b-2xl flex-shrink-0">
            <span className="text-sm text-slate-500">
              Đã chọn{" "}
              <strong className="text-slate-800">{selectedIndices.size}</strong>/{editedQuestions.length} câu
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setStatus("idle")}>
                Tạo lại
              </Button>
              <Button
                variant="brand"
                onClick={handleSaveSelected}
                disabled={saving || selectedIndices.size === 0}
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Lưu {selectedIndices.size} câu đã chọn
              </Button>
            </div>
          </div>
        )}
      </Card>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
