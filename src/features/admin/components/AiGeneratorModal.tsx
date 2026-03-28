"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Check, Loader2, Sparkles, Upload, X, Save, ImageIcon } from "lucide-react";
import Toast from "@/components/Toast";

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

export function AiGeneratorModal({ assignmentId, isOpen, onClose, onSuccess }: AiGeneratorModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [textInput, setTextInput] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [aiQuestions, setAiQuestions] = useState<AiQuestion[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
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
          // Add image file to files array
          setFiles(prev => [...prev, file]);
          setToast({ message: "Đã thêm ảnh từ clipboard", type: "success" });
          return true;
        }
      }
    }
    return false;
  }, []);

  // Listen for paste events
  useEffect(() => {
    if (!isOpen) return;

    const onWindowPaste = (event: ClipboardEvent) => {
      if (!event.clipboardData) return;
      const hasImage = Array.from(event.clipboardData.items || []).some((item) => item.type.startsWith("image/"));
      if (!hasImage) return;

      const consumed = handlePaste(event.clipboardData);
      if (consumed) {
        event.preventDefault();
      }
    };

    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  }, [isOpen, handlePaste]);

  if (!isOpen) return null;

  async function handleGenerate() {
    if (files.length === 0 && !textInput.trim()) {
      setToast({ message: "Vui lòng chọn file PDF/Docx hoặc nhập text", type: "error" });
      return;
    }

    setStatus("running");
    setMessage("Đang đọc dữ liệu và gửi cho AI...");
    setAiQuestions([]);
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
      setAiQuestions(data.questions || []);
      setSelectedIndices(new Set((data.questions || []).map((_: any, i: number) => i)));
      setStatus("done");
      setMessage(`Đã tạo ${data.questions?.length || 0} câu hỏi`);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setMessage(err.message || "Không thể sinh câu hỏi. Vui lòng thử lại.");
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

  const handleSaveSelected = async () => {
    if (selectedIndices.size === 0) return;
    setSaving(true);
    try {
      const selected = aiQuestions.filter((_, i) => selectedIndices.has(i));
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
        setStatus("idle");
      }, 1000);
    } catch (err: any) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
      <Card className="flex w-full max-w-4xl flex-col max-h-[90vh] overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            <h2 className="text-xl font-bold text-slate-900">AI Sinh câu hỏi trắc nghiệm</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {status === "idle" || status === "error" ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Tài liệu tham khảo (PDF, Docx, Ảnh)
                  <span className="ml-2 text-xs font-normal text-slate-400">(Chọn file hoặc Ctrl+V dán ảnh)</span>
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-slate-400" />
                      <p className="mb-2 text-sm text-slate-600"><span className="font-semibold">Bấm để chọn file</span> hoặc kéo thả vào đây</p>
                      <p className="text-xs text-slate-500">Giới hạn 10MB mỗi file · Hỗ trợ Ctrl+V paste ảnh</p>
                    </div>
                    <input 
                      type="file" 
                      multiple 
                      accept=".pdf,.docx,image/*" 
                      className="hidden" 
                      onChange={(e) => setFiles(Array.from(e.target.files || []))}
                    />
                  </label>
                </div>
                {files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                        {f.name}
                        <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="ml-1 text-indigo-400 hover:text-indigo-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Hoặc dán văn bản / Yêu cầu chi tiết (Hỗ trợ Ctrl+V)</label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="w-full h-32 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 resize-none placeholder:text-slate-400"
                  placeholder="Bạn có thể gõ hoặc paste (Ctrl+V) nội dung vào đây..."
                />
              </div>

              {status === "error" && (
                <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
                  {message}
                </div>
              )}

              <Button onClick={handleGenerate} variant="brand" className="w-full text-base py-6">
                <Sparkles className="h-5 w-5 mr-2" /> Bắt đầu tạo câu hỏi
              </Button>
            </div>
          ) : status === "running" ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
              <p className="text-lg font-semibold text-slate-900">AI đang xử lý tài liệu...</p>
              <p className="text-sm text-slate-500 mt-2">{message}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  Đã tạo {aiQuestions.length} câu hỏi
                </p>
                <button
                  onClick={() => {
                    if (selectedIndices.size === aiQuestions.length) setSelectedIndices(new Set());
                    else setSelectedIndices(new Set(aiQuestions.map((_, i) => i)));
                  }}
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
                >
                  {selectedIndices.size === aiQuestions.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
              </div>

              <div className="space-y-4">
                {aiQuestions.map((q, i) => (
                  <div 
                    key={i} 
                    className={`relative rounded-xl border-2 p-4 transition-all cursor-pointer ${
                      selectedIndices.has(i) ? "border-indigo-500 bg-indigo-50/30" : "border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => toggleSelect(i)}
                  >
                    <div className="absolute right-4 top-4">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                        selectedIndices.has(i) ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-300"
                      }`}>
                        {selectedIndices.has(i) && <Check className="h-4 w-4" />}
                      </div>
                    </div>
                    
                    <h4 className="pr-10 text-[15px] font-bold text-slate-900 mb-3 leading-snug">Câu {i + 1}: {q.question}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(q.options).map(([key, value]) => (
                        <div key={key} className={`rounded-lg px-3 py-2 ${
                          key === q.correct_answer ? "bg-emerald-100 text-emerald-800 font-semibold ring-1 ring-emerald-200" : "bg-slate-50 text-slate-700"
                        }`}>
                           {key}. {value}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {status === "done" && (
          <div className="border-t border-slate-100 p-4 bg-slate-50 flex items-center justify-end gap-3 rounded-b-xl">
             <Button variant="outline" onClick={() => setStatus("idle")}>
               Tạo lại
             </Button>
             <Button variant="brand" onClick={handleSaveSelected} disabled={saving || selectedIndices.size === 0}>
               {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
               Lưu {selectedIndices.size} câu đã chọn
             </Button>
          </div>
        )}
      </Card>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
