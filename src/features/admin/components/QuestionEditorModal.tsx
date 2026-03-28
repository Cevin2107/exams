import React, { useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { X, Plus, Trash2, Upload, ClipboardPaste } from "lucide-react";

interface QuestionEditorModalProps {
  assignmentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingQuestion?: any | null;
}

export function QuestionEditorModal({ assignmentId, isOpen, onClose, onSuccess, editingQuestion }: QuestionEditorModalProps) {
  const isEditing = !!editingQuestion;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [type, setType] = useState<"mcq" | "essay" | "short_answer" | "section" | "true_false">("mcq");
  const [content, setContent] = useState("");
  const [choices, setChoices] = useState<string[]>(["", "", "", ""]);
  const [subQuestions, setSubQuestions] = useState<Array<{ id: string; content: string; answerKey: string; order: number }>>([]);
  const [answerKey, setAnswerKey] = useState("A");
  const [points, setPoints] = useState<number>(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      if (editingQuestion) {
        setType(editingQuestion.type || "mcq");
        setContent(editingQuestion.content || "");
        setChoices(editingQuestion.choices?.length ? editingQuestion.choices : ["", "", "", ""]);
        
        let initialSubQs = editingQuestion.subQuestions || editingQuestion.sub_questions || [];
        if (editingQuestion.type === "true_false" && initialSubQs.length === 0) {
            initialSubQs = [
                { id: crypto.randomUUID(), content: "", answerKey: "true", order: 1 },
                { id: crypto.randomUUID(), content: "", answerKey: "true", order: 2 }
            ];
        }
        setSubQuestions(initialSubQs);

        setAnswerKey(editingQuestion.answerKey || editingQuestion.answer_key || "A");
        setPoints(editingQuestion.points || 0);
        setPreviewUrl(editingQuestion.imageUrl || editingQuestion.image_url || "");
        setImageFile(null);
      } else {
        setType("mcq");
        setContent("");
        setChoices(["", "", "", ""]);
        setSubQuestions([
            { id: crypto.randomUUID(), content: "", answerKey: "true", order: 1 },
            { id: crypto.randomUUID(), content: "", answerKey: "true", order: 2 }
        ]);
        setAnswerKey("A");
        setPoints(0);
        setPreviewUrl("");
        setImageFile(null);
      }
      setError("");
    }
  }, [isOpen, editingQuestion]);

  const applyImageFile = (file: File) => {
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) applyImageFile(e.target.files[0]);
  };

  // Handle paste image from clipboard (Ctrl+V)
  const handlePaste = useCallback((clipboardData: DataTransfer | null) => {
    const items = clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          applyImageFile(file);
          return true;
        }
      }
    }
    return false;
  }, []);

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

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload fail");
      const data = await res.json();
      return data.url;
    } catch {
      return null;
    }
  };

  const handleSave = async () => {
    if (!content.trim() && !imageFile && !previewUrl) {
      setError("Nội dung câu hỏi hoặc hình ảnh không được để trống");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let finalImageUrl = previewUrl.startsWith("blob:") ? null : previewUrl;
      if (imageFile) {
        const url = await uploadImage(imageFile);
        if (url) finalImageUrl = url;
      }

      const safeChoices = type === "mcq" ? choices : null;
      if (type === "mcq" && safeChoices && safeChoices.length < 2) {
        throw new Error("Câu trắc nghiệm phải có ít nhất 2 đáp án");
      }

      if (type === "true_false") {
        if (!subQuestions || subQuestions.length === 0) {
          throw new Error("Câu hỏi Đúng/Sai phải có ít nhất 1 ý");
        }
        // Cho phép nội dung ý để trống - học sinh vẫn có thể chọn Đúng/Sai
      }

      const payload = {
        assignmentId,
        type,
        content,
        choices: safeChoices,
        answerKey: type === "mcq" || type === "short_answer" ? answerKey : null,
        subQuestions: type === "true_false" ? subQuestions : null,
        points: points > 0 ? points : undefined,
        imageUrl: finalImageUrl || null,
      };

      const url = isEditing ? `/api/admin/questions/${editingQuestion.id}` : `/api/admin/questions`;
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Lỗi lưu câu hỏi");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      onPaste={(e) => {
        const consumed = handlePaste(e.clipboardData);
        if (consumed) {
          e.preventDefault();
        }
      }}
      suppressHydrationWarning
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{isEditing ? "Chỉnh sửa câu hỏi" : "Bổ sung câu hỏi mới"}</h3>
            <p className="text-sm text-slate-500">Thiết lập nội dung và đáp án chuẩn cho màn thi</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Loại câu hỏi</label>
              <select value={type} onChange={e => {
                  const val = e.target.value as any;
                  setType(val);
                  if (val === "true_false" && subQuestions.length === 0) {
                     setSubQuestions([
                        { id: crypto.randomUUID(), content: "", answerKey: "true", order: 1 },
                        { id: crypto.randomUUID(), content: "", answerKey: "true", order: 2 }
                     ]);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100">
                <option value="mcq">Trắc nghiệm (MCQ)</option>
                <option value="true_false">Đúng / Sai</option>
                <option value="essay">Tự luận (Tải ảnh)</option>
                <option value="short_answer">Điền từ / Trả lời ngắn</option>
                <option value="section">Đoạn văn / Ghi chú</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Điểm (0 = Tự chia đều)</label>
              <input type="number" step="0.01" min="0" disabled={type === "section"} value={points}
                onChange={e => setPoints(parseFloat(e.target.value) || 0)}
                className="w-full disabled:opacity-50 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Nội dung câu hỏi</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
              placeholder="Nhập nội dung đề bài..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 resize-y"
            />
          </div>

          {/* Image upload with paste support */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Hình ảnh minh họa
              <span className="ml-2 text-xs font-normal text-slate-400">(Chọn file hoặc Ctrl+V dán ảnh từ clipboard)</span>
            </label>
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:bg-slate-100 shrink-0">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <Upload className="h-5 w-5 text-slate-400" /> Chọn ảnh...
              </label>
              <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-400">
                <ClipboardPaste className="h-4 w-4" />
                <span>Ctrl+V để dán ảnh</span>
              </div>
              {previewUrl && (
                <div className="relative group rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <img src={previewUrl} alt="Preview" className="h-24 w-auto object-cover" />
                  <button onClick={() => { setPreviewUrl(""); setImageFile(null); }}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {type === "mcq" && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Các đáp án <span className="text-slate-400 font-normal">(chọn radio để đánh dấu đáp án đúng)</span></label>
              </div>
              {choices.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input type="radio" name="mcq-answer" checked={answerKey === String.fromCharCode(65 + i)}
                    onChange={() => setAnswerKey(String.fromCharCode(65 + i))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={`font-bold w-6 text-center text-sm rounded-md px-1 py-0.5 ${answerKey === String.fromCharCode(65 + i) ? "bg-indigo-600 text-white" : "text-slate-400 bg-slate-100"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <input type="text" value={c}
                    onChange={e => { const n = [...choices]; n[i] = e.target.value; setChoices(n); }}
                    placeholder={`Nội dung đáp án ${String.fromCharCode(65 + i)}`}
                    className={`flex-1 rounded-xl border px-4 py-2 text-sm focus:ring-4 focus:ring-indigo-100 focus:outline-none transition ${answerKey === String.fromCharCode(65 + i) ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-slate-50 focus:border-indigo-400 focus:bg-white"}`}
                  />
                  <button onClick={() => { if (choices.length <= 2) return; const n = [...choices]; n.splice(i, 1); setChoices(n); }}
                    className="p-2 text-slate-300 hover:text-red-500 rounded-lg transition" disabled={choices.length <= 2}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setChoices([...choices, ""])} className="mt-2">
                <Plus className="h-4 w-4 mr-2" /> Thêm đáp án
              </Button>
            </div>
          )}

          {type === "short_answer" && (
            <div className="pt-4 border-t border-slate-100">
              <label className="text-sm font-semibold text-slate-700 block mb-2">Đáp án chuẩn (Key)</label>
              <input type="text" value={answerKey} onChange={e => setAnswerKey(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                placeholder="Nhập đáp án chuẩn xác..."
              />
              <p className="text-xs text-slate-400 mt-1.5">Hệ thống sẽ đối chiếu trực tiếp, không phân biệt hoa/thường.</p>
            </div>
          )}

          {type === "true_false" && (
             <div className="space-y-4 pt-4 border-t border-slate-100">
               <div className="flex items-center justify-between">
                 <label className="text-sm font-semibold text-slate-700">Các ý của câu hỏi <span className="text-slate-400 font-normal">(chọn Đúng/Sai làm đáp án)</span></label>
               </div>
               {subQuestions.map((sq, i) => (
                 <div key={sq.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-bold w-6 text-center text-sm rounded-md px-1 py-0.5 text-slate-400 bg-white shadow-sm">
                       {String.fromCharCode(97 + i)}
                    </span>
                    <input type="text" value={sq.content}
                      onChange={e => { const n = [...subQuestions]; n[i].content = e.target.value; setSubQuestions(n); }}
                      placeholder="Nội dung ý..."
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-4 focus:ring-indigo-100 focus:outline-none transition focus:bg-white"
                    />
                    <select
                      value={sq.answerKey}
                      onChange={e => { const n = [...subQuestions]; n[i].answerKey = e.target.value; setSubQuestions(n); }}
                      className={`text-sm font-semibold rounded-lg px-3 py-2 border transition outline-none ${sq.answerKey === "true" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}
                    >
                       <option value="true">Đúng</option>
                       <option value="false">Sai</option>
                    </select>
                    <button onClick={() => { if (subQuestions.length <= 1) return; const n = [...subQuestions]; n.splice(i, 1); setSubQuestions(n); }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition shadow-sm" disabled={subQuestions.length <= 1}>
                      <X className="h-4 w-4" />
                    </button>
                 </div>
               ))}
               <Button type="button" variant="outline" size="sm" onClick={() => setSubQuestions([...subQuestions, {id: crypto.randomUUID(), content: "", answerKey: "true", order: subQuestions.length + 1}])} className="mt-2">
                 <Plus className="h-4 w-4 mr-2" /> Thêm ý
               </Button>
             </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-slate-50 p-6 flex items-center justify-end gap-3 rounded-b-3xl">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Hủy bỏ</Button>
          <Button variant="brand" onClick={handleSave} disabled={loading}>
            {loading ? "Đang xử lý..." : (isEditing ? "Lưu thay đổi" : "Thêm câu hỏi")}
          </Button>
        </div>
      </div>
    </div>
  );
}
