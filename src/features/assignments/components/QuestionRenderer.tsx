import React from "react";
import { Question } from "@/lib/types";
import { MathText } from "@/components/MathText";

interface QuestionRendererProps {
  question: Question;
  index: number;
  answer: string | undefined;
  onAnswerChange: (value: string) => void;
  essayImageUrl?: string;
  isEssayUploading?: boolean;
  onEssayImageUpload?: (file: File) => void;
  locked: boolean;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = React.memo(({
  question, index, answer, onAnswerChange, essayImageUrl, isEssayUploading, onEssayImageUpload, locked
}) => {
  const isAnswered = !!answer;
  const isSection = question.type === "section";

  if (isSection) {
    return (
      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 md:p-6 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">💡</span>
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Đoạn văn / Ghi chú</span>
        </div>
        <h3 className="text-sm md:text-base font-semibold text-indigo-100 leading-relaxed"><MathText text={question.content || ""} /></h3>
        {question.imageUrl && (
          <img src={question.imageUrl} alt="Lý thuyết" className="mt-4 max-w-full rounded-xl shadow-lg border border-indigo-500/20 max-h-80 object-contain" />
        )}
      </div>
    );
  }

  return (
    <div
      id={`question-${question.id}`}
      className={`rounded-2xl border transition-all duration-200 ${
        isAnswered
          ? "border-indigo-500/40 bg-white/8 shadow-lg shadow-indigo-900/20"
          : "border-white/10 bg-white/5 hover:border-white/20"
      }`}
    >
      <div className="p-5 md:p-7">
        <div className="flex gap-4">
          {/* Question Number */}
          <div className="shrink-0">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black transition-all ${
              isAnswered
                ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-900/40"
                : "bg-white/10 text-slate-400"
            }`}>
              {index}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {/* Question text */}
            <p className="text-base font-semibold text-white leading-relaxed mb-5"><MathText text={question.content || ""} /></p>

            {question.imageUrl && (
              <img src={question.imageUrl} alt="Câu hỏi" className="mb-5 max-w-full rounded-xl shadow-md border border-white/10 max-h-80 object-contain bg-black/20" />
            )}

            {/* MCQ */}
            {question.type === "mcq" && question.choices && (
              <div className="space-y-2.5">
                {question.choices.map((choice, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const isSelected = answer === letter;
                  return (
                    <label
                      key={i}
                      className={`group flex cursor-pointer items-start gap-3.5 rounded-xl border p-3.5 md:p-4 transition-all ${
                        locked ? "opacity-60 cursor-not-allowed" : ""
                      } ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/20 shadow-md shadow-indigo-900/30 ring-1 ring-indigo-500/40"
                          : "border-white/10 bg-white/5 hover:border-indigo-500/40 hover:bg-indigo-500/10"
                      }`}
                    >
                      <div className="flex shrink-0 items-center justify-center mt-0.5">
                        <input
                          type="radio"
                          name={`q-${question.id}`}
                          value={letter}
                          checked={isSelected}
                          onChange={(e) => { if (!locked) onAnswerChange(e.target.value); }}
                          disabled={locked}
                          className="h-4 w-4 text-indigo-500 border-white/30 focus:ring-indigo-500 bg-transparent"
                        />
                      </div>
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black transition-all ${
                          isSelected ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-400"
                        }`}>{letter}</span>
                        <span className={`text-sm md:text-base leading-snug mt-0.5 ${isSelected ? "text-indigo-100 font-medium" : "text-slate-300"}`}><MathText text={choice || ""} /></span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Short Answer */}
            {question.type === "short_answer" && (
              <input
                type="text"
                placeholder="Nhập câu trả lời ngắn gọn..."
                value={answer || ""}
                onChange={(e) => { if (!locked) onAnswerChange(e.target.value); }}
                disabled={locked}
                className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-900/60 disabled:opacity-50 transition outline-none"
              />
            )}

            {/* Essay */}
            {question.type === "essay" && (
              <div className="space-y-4">
                <textarea
                  rows={5}
                  placeholder="Nhập phần bài làm tự luận của bạn vào đây..."
                  value={answer || ""}
                  onChange={(e) => { if (!locked) onAnswerChange(e.target.value); }}
                  disabled={locked}
                  className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-900/60 disabled:opacity-50 transition outline-none resize-y"
                />
                <div className="flex flex-wrap items-center gap-4">
                  <label className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/12 transition ${locked || isEssayUploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onEssayImageUpload) onEssayImageUpload(file);
                      }}
                    />
                    📎 {isEssayUploading ? "Đang tải ảnh..." : "Đính kèm ảnh bài làm"}
                  </label>
                  {essayImageUrl && (
                    <div className="relative group rounded-xl overflow-hidden border border-white/15">
                      <img src={essayImageUrl} alt="Bản chụp" className="h-20 w-auto object-cover" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Answered indicator strip */}
      {isAnswered && (
        <div className="px-5 pb-4 md:px-7">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Đã trả lời
          </div>
        </div>
      )}
    </div>
  );
});

QuestionRenderer.displayName = "QuestionRenderer";
