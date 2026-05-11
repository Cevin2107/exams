import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { countActualQuestions } from "@/lib/utils";
import { AiGeneratorModal } from "./AiGeneratorModal";
import { QuestionEditorModal } from "./QuestionEditorModal";
import { GripVertical, Plus, Settings2, Trash2, Edit2, CheckCircle2 } from "lucide-react";
import Toast from "@/components/Toast";
import { MathText } from "@/components/MathText";

export function QuestionBuilderTab({ assignmentId, initialQuestions }: { assignmentId: string; initialQuestions: any[] }) {
  const [questions, setQuestions] = useState<any[]>(initialQuestions);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [autoScrollInterval, setAutoScrollInterval] = useState<NodeJS.Timeout | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Auto reload questions after AI generation or changes
  const refreshQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/questions?assignmentId=${assignmentId}`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch {
      setToast({ message: "Không thể tải danh sách câu hỏi", type: "error" });
    }
  }, [assignmentId]);

  useEffect(() => {
    refreshQuestions();
  }, [refreshQuestions]);

  // Cleanup auto-scroll interval on unmount
  useEffect(() => {
    return () => {
      if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
      }
    };
  }, [autoScrollInterval]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    
    // Get cursor position relative to viewport
    const cursorY = e.clientY;
    const viewportHeight = window.innerHeight;
    const scrollThreshold = 100; // pixels from edge
    const scrollSpeed = 10; // pixels per interval
    
    // Clear existing interval
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      setAutoScrollInterval(null);
    }
    
    // Scroll up if near top
    if (cursorY < scrollThreshold) {
      const interval = setInterval(() => {
        window.scrollBy(0, -scrollSpeed);
      }, 16); // ~60fps
      setAutoScrollInterval(interval);
    }
    // Scroll down if near bottom
    else if (cursorY > viewportHeight - scrollThreshold) {
      const interval = setInterval(() => {
        window.scrollBy(0, scrollSpeed);
      }, 16);
      setAutoScrollInterval(interval);
    }
  };

  const handleDragEnd = () => {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      setAutoScrollInterval(null);
    }
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const oldIndex = questions.findIndex(q => q.id === draggedId);
    const newIndex = questions.findIndex(q => q.id === targetId);
    if (oldIndex === -1 || newIndex === -1) return;

    const newArr = [...questions];
    const [moved] = newArr.splice(oldIndex, 1);
    newArr.splice(newIndex, 0, moved);
    setQuestions(newArr);
    
    // Call API to reorder
    try {
      const res = await fetch("/api/admin/questions/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          orderedIds: newArr.map(q => q.id),
        }),
      });
      if (!res.ok) {
        throw new Error("Reorder failed");
      }
      setToast({ message: "Sắp xếp thành công", type: "success" });
    } catch {
      setToast({ message: "Sắp xếp thất bại", type: "error" });
      refreshQuestions();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa câu hỏi này?")) return;
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xóa thất bại");
      setToast({ message: "Xóa thành công", type: "success" });
      refreshQuestions();
    } catch (e) {
      setToast({ message: "Lỗi khi xóa", type: "error" });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Xóa ${selectedIds.size} câu hỏi đã chọn?`)) return;
    
    setIsDeletingBulk(true);
    try {
      const res = await fetch(`/api/admin/questions`, { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          questionIds: Array.from(selectedIds)
        })
      });
      if (!res.ok) throw new Error("Xóa thất bại");
      setToast({ message: `Đã xóa ${selectedIds.size} câu hỏi`, type: "success" });
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      refreshQuestions();
    } catch (e) {
      setToast({ message: "Lỗi khi xóa hàng loạt", type: "error" });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map(q => q.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Bộ câu hỏi</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Sắp xếp, chỉnh sửa và tạo câu hỏi cho bài tập này. 
            {questions.length > 0 && (
              <span className="font-semibold text-slate-700 block sm:inline">
                {" "}({countActualQuestions(questions)} câu hỏi, {questions.length - countActualQuestions(questions)} ghi chú)
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {isSelectionMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}>
                 Hủy
              </Button>
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                 {selectedIds.size === questions.length ? "Bỏ chọn hết" : "Chọn hết"}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={selectedIds.size === 0 || isDeletingBulk}>
                 <Trash2 className="h-4 w-4 mr-1.5" /> Xóa ({selectedIds.size})
              </Button>
            </>
          ) : (
            <>
              {questions.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setIsSelectionMode(true)}>
                   Chọn nhiều
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => { setEditingQuestion(null); setShowEditorModal(true); }}>
                 <Plus className="h-4 w-4 mr-1.5" /> Thủ công
              </Button>
              <Button variant="brand" size="sm" onClick={() => setShowAiModal(true)}>
                 <Settings2 className="h-4 w-4 mr-1.5" /> Tạo bằng AI
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {questions.length === 0 ? (
          <Card className="p-12 text-center bg-slate-50 border-dashed">
            <p className="text-base font-semibold text-slate-700">Chưa có câu hỏi nào</p>
            <p className="mt-1 text-sm text-slate-500 mb-6">Trải nghiệm tính năng AI để tự động tạo câu hỏi trắc nghiệm từ tài liệu.</p>
            <Button variant="brand" onClick={() => setShowAiModal(true)}>Tạo câu hỏi bằng AI ngay</Button>
          </Card>
        ) : (
          questions.map((q) => (
            <Card 
              key={q.id} 
              className={`flex items-start p-4 transition-all border-l-4 ${q.type === 'section' ? 'border-l-indigo-500 bg-indigo-50' : 'border-l-transparent bg-white'} hover:shadow-md ${isSelectionMode ? 'cursor-pointer' : 'cursor-move'} ${selectedIds.has(q.id) ? 'ring-2 ring-indigo-500' : ''}`}
              draggable={!isSelectionMode}
              onDragStart={(e) => { if(!isSelectionMode) setDraggedId(q.id); else e.preventDefault(); }}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(q.id)}
              onClick={() => isSelectionMode && toggleSelection(q.id)}
            >
              {isSelectionMode ? (
                <div className="mr-4 mt-1">
                  <input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => {}} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-none" />
                </div>
              ) : (
                <div className="mr-4 mt-1 cursor-grab text-slate-300 hover:text-slate-500">
                   <GripVertical className="h-5 w-5" />
                </div>
              )}
              
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  {q.type !== 'section' && <Badge variant="secondary">Câu {questions.filter(x => x.type !== 'section').findIndex(x => x.id === q.id) + 1}</Badge>}
                  {q.type === 'section' && <Badge variant="default">Đoạn văn / Ghi chú</Badge>}
                  {q.type === 'essay' && <Badge variant="warning">Tự luận</Badge>}
                  {q.type === 'true_false' && <Badge variant="secondary" className="bg-blue-50 text-blue-700">Đúng/Sai</Badge>}
                  {q.type === 'short_answer' && <Badge variant="secondary" className="bg-purple-50 text-purple-700">Trả lời ngắn</Badge>}
                  {q.points > 0 && <span className="text-sm font-semibold text-slate-500">{q.points} điểm</span>}
                </div>
                
                <div className="text-base font-semibold text-slate-900 leading-relaxed max-w-full break-words overflow-hidden"><MathText text={q.content || ""} /></div>

                {(q.imageUrl || q.image_url) && <img src={q.imageUrl || q.image_url} alt="img" className="mt-3 max-w-xs rounded-xl border border-slate-200" />}

                {q.type === "mcq" && q.choices && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {q.choices.map((c: string, i: number) => {
                      const isCorrect = String.fromCharCode(65 + i) === (q.answerKey || q.answer_key);
                      return (
                        <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isCorrect ? 'bg-emerald-50 text-emerald-700 font-semibold ring-1 ring-emerald-200' : 'bg-slate-50 text-slate-600'}`}>
                           <span>{String.fromCharCode(65 + i)}.</span>
                           <span className="flex-1 break-words"><MathText text={c || ""} /></span>
                           {isCorrect && <CheckCircle2 className="h-4 w-4 ml-auto text-emerald-500" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.type === "true_false" && (q.subQuestions || q.sub_questions) && (
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    {(q.subQuestions || q.sub_questions).map((sq: any, i: number) => (
                      <div key={sq.id || i} className="flex justify-between items-center gap-2 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700">
                         <div className="flex gap-2">
                           <span className="font-semibold text-slate-400">{String.fromCharCode(97 + i)}.</span>
                           <span><MathText text={sq.content || ""} /></span>
                         </div>
                         <Badge variant={sq.answerKey === "true" || sq.answer_key === "true" ? "success" : "destructive"} className="shrink-0 text-xs py-0">
                           {sq.answerKey === "true" || sq.answer_key === "true" ? "Đúng" : "Sai"}
                         </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-2 shrink-0">
                 {!isSelectionMode && (
                   <>
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={(e) => { e.stopPropagation(); setEditingQuestion(q); setShowEditorModal(true); }}>
                        <Edit2 className="h-4 w-4" />
                     </Button>
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}>
                        <Trash2 className="h-4 w-4" />
                     </Button>
                   </>
                 )}
              </div>
            </Card>
          ))
        )}
      </div>

      <AiGeneratorModal 
        assignmentId={assignmentId} 
        isOpen={showAiModal} 
        onClose={() => setShowAiModal(false)}
        onSuccess={refreshQuestions}
      />
      
      <QuestionEditorModal
        assignmentId={assignmentId}
        isOpen={showEditorModal}
        onClose={() => { setShowEditorModal(false); setEditingQuestion(null); }}
        onSuccess={refreshQuestions}
        editingQuestion={editingQuestion}
      />
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
