"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";

export function ResultQuestionsAccordion({ 
  questions, 
  answers, 
  isScoreHidden 
}: { 
  questions: any[]; 
  answers: any[]; 
  isScoreHidden: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    return new Set((questions || []).map(q => q.id));
  });

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const answerMap = new Map(answers?.map((a) => [a.question_id, a]) || []);

  const formatPoints = (value: number | null | undefined) => Number(value ?? 0).toFixed(3);

  if (isScoreHidden) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-6 text-center shadow-sm">
        <div className="mb-3 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20 ring-4 ring-white dark:ring-slate-800">
            <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p className="text-lg font-bold text-amber-900 dark:text-amber-200">Bài đã nộp thành công!</p>
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">Giáo viên sẽ chấm bài và công bố điểm sau.</p>
      </div>
    );
  }

  const actualQuestions = questions?.filter((q) => q.type !== 'section') || [];

  return (
    <div className="space-y-4">
      {actualQuestions.map((q, idx) => {
        const answer = answerMap.get(q.id);
        // Fallback cho short_answer: nếu is_correct null, dùng points_awarded
        let isCorrect = answer?.is_correct;
        if (isCorrect === null && q.type === "short_answer") {
          isCorrect = answer?.points_awarded === q.points;
        }
        const studentAnswer = answer?.answer;
        const isExpanded = expandedIds.has(q.id);

        const imgUrl = q.image_url || q.imageUrl;

        return (
          <div key={q.id} className={clsx(
            "rounded-2xl border transition-all duration-300 overflow-hidden",
            isExpanded ? "shadow-md dark:shadow-none" : "shadow-sm hover:border-slate-300 dark:hover:border-slate-600",
            isCorrect === true 
              ? (isExpanded ? "border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/10 dark:bg-emerald-500/10" : "border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-slate-800") :
            isCorrect === false 
              ? (isExpanded ? "border-rose-300 dark:border-rose-500/50 bg-rose-50/10 dark:bg-rose-500/10" : "border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-800") :
            "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          )}>
            {/* Header (Always Visible) */}
            <button
               onClick={() => toggleExpand(q.id)}
               className="w-full flex items-center justify-between gap-4 p-5 focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <span className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-black shrink-0 shadow-sm transition-colors",
                  isCorrect === true ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:ring-emerald-500/30" :
                  isCorrect === false ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:ring-rose-500/30" :
                  "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600"
                )}>{idx + 1}</span>
                
                <div className="text-left">
                   <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-1 transition-colors">
                     Câu {idx + 1}
                   </p>
                   {q.type === "mcq" && isCorrect !== null && (
                     <p className={clsx(
                       "text-sm font-semibold transition-colors",
                       isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                     )}>
                       {isCorrect ? "Trả lời đúng" : "Trả lời sai"}
                     </p>
                   )}
                   {q.type !== "mcq" && (
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors">
                         {q.type === 'essay' ? 'Tự luận' : q.type === 'short_answer' ? (isCorrect ? 'Điền từ - Đúng' : 'Điền từ - Sai') : q.type === 'true_false' ? 'Đúng/Sai' : 'Đọc hiểu'}
                      </p>
                   )}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                 <span className="shrink-0 rounded-full bg-amber-50 dark:bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 ring-1 ring-amber-200/60 dark:ring-amber-500/30 transition-colors">
                   {formatPoints(answer?.points_awarded)} / {formatPoints(q.points)} điểm
                 </span>
                 <ChevronDown className={clsx(
                    "h-5 w-5 text-slate-400 dark:text-slate-500 transition-transform duration-300",
                    isExpanded && "rotate-180 text-slate-700 dark:text-slate-300"
                 )} />
              </div>
            </button>

            {/* Content (Expanded) */}
            <div className={clsx(
               "grid transition-all duration-300",
               isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
              <div className="overflow-hidden">
                 <div className="p-5 pt-0 border-t border-slate-100/50 dark:border-slate-700/50">
                    {imgUrl && (
                      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mt-4">
                        <img src={imgUrl} alt="Câu hỏi" className="max-h-64 w-auto object-contain bg-slate-50 dark:bg-slate-900 mx-auto" />
                      </div>
                    )}
                    {q.content && <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-5 leading-relaxed whitespace-pre-wrap">{q.content}</p>}

                    {/* MCQ Choices */}
                    {q.type === "mcq" && (() => {
                      const parsedChoices = Array.isArray(q.choices) ? q.choices : [];
                      
                      const normalizeToIndex = (value: unknown) => {
                        if (value == null) return -1;
                        const normalized = String(value).trim().toUpperCase();
                        if (!normalized) return -1;
                        const first = normalized[0];
                        if (first >= "A" && first <= "Z") return first.charCodeAt(0) - 65;
                        return -1;
                      };

                      const selectedIndex = normalizeToIndex(studentAnswer);
                      const keyIndex = normalizeToIndex(q.answer_key || q.answerKey);
                      
                      const maxIndex = Math.max(parsedChoices.length - 1, selectedIndex, keyIndex, 3);
                      const optionIndexes = Array.from({ length: maxIndex + 1 }, (_, i) => i);

                      return (
                        <div className="space-y-2.5">
                          {optionIndexes.map((ci) => {
                            const choiceLabel = String.fromCharCode(65 + ci);
                            const choice = typeof parsedChoices[ci] === "string" ? parsedChoices[ci] : "";
                            const isStudentChoice = ci === selectedIndex;
                            const isCorrectAnswer = ci === keyIndex;
                            
                            return (
                              <div key={ci} className={clsx(
                                "flex items-center gap-3 rounded-xl border px-4 py-3 text-[14px] transition-colors",
                                isCorrectAnswer ? "border-emerald-300 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10 font-bold text-emerald-900 dark:text-emerald-100 shadow-sm" :
                                isStudentChoice && !isCorrectAnswer ? "border-rose-300 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-500/10 font-bold text-rose-900 dark:text-rose-100" :
                                "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                              )}>
                                <span className={clsx(
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                                  isCorrectAnswer ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-300" :
                                  isStudentChoice ? "bg-rose-200 text-rose-800 dark:bg-rose-500/30 dark:text-rose-300" :
                                  "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                                )}>{choiceLabel}</span>
                                <span className="flex-1 leading-relaxed">
                                  {choice ? choice : <span className="italic text-slate-400 dark:text-slate-500">(Không có nội dung)</span>}
                                </span>
                                {isCorrectAnswer && <span className="text-xs font-black tracking-wide text-emerald-600 dark:text-emerald-400 uppercase">Đúng</span>}
                                {isStudentChoice && !isCorrectAnswer && <span className="text-xs font-black tracking-wide text-rose-600 dark:text-rose-400 uppercase">Bạn chọn</span>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Short Answer */}
                    {q.type === "short_answer" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={clsx("rounded-xl border px-4 py-3",
                          isCorrect ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
                        )}>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Bạn trả lời: </span>
                          <span className={clsx("font-semibold text-[15px]", isCorrect ? "text-emerald-900 dark:text-emerald-200" : "text-rose-900 dark:text-rose-200")}>{studentAnswer || <em className="text-slate-400 opacity-70 font-normal">Đã bỏ trống</em>}</span>
                        </div>
                        {!isCorrect && (q.answer_key || q.answerKey) && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 px-4 py-3">
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest block mb-1">Đáp án gợi ý: </span>
                            <span className="font-semibold text-[15px] text-emerald-900 dark:text-emerald-200">{q.answer_key || q.answerKey}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Essay */}
                    {q.type === "essay" && (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 text-[14px] text-slate-800 dark:text-slate-200 min-h-[100px] whitespace-pre-wrap">
                          {studentAnswer || <em className="text-slate-400 dark:text-slate-500">Không có chữ viết.</em>}
                        </div>
                        {answer?.answer_image_url && (
                          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mt-4">
                            <img src={answer.answer_image_url} alt="Ảnh bài làm" className="max-h-96 w-auto object-contain bg-slate-100 dark:bg-slate-900 mx-auto" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* True/False Sub-questions */}
                    {q.type === "true_false" && (() => {
                      const subQs = (q.sub_questions as Array<{id: string; content: string; answerKey: string; order: number}>) || [];
                      const studentTf = (() => { try { return JSON.parse(studentAnswer || "{}"); } catch { return {}; } })();
                      return subQs.length > 0 ? (
                        <div className="space-y-2">
                          {subQs.map((sq, si) => {
                            const studentVal = studentTf[sq.id];
                            const subCorrect = studentVal === sq.answerKey;
                            return (
                              <div key={sq.id} className={clsx(
                                "flex items-center gap-3 rounded-xl border px-4 py-3 text-[14px]",
                                subCorrect ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
                              )}>
                                <span className="w-5 text-sm font-black text-slate-400 dark:text-slate-500 shrink-0">{String.fromCharCode(97 + si)}.</span>
                                <span className={clsx("flex-1 font-medium leading-relaxed", subCorrect ? "text-emerald-900 dark:text-emerald-100" : "text-rose-900 dark:text-rose-100")}>
                                  {sq.content || <em className="not-italic text-slate-400 dark:text-slate-500">Câu {String.fromCharCode(97 + si)}</em>}
                                </span>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className={clsx("rounded-md px-2.5 py-1 text-xs font-extrabold uppercase",
                                    studentVal === "true" ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30" :
                                    studentVal === "false" ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:ring-rose-500/30" :
                                    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                  )}>
                                    {studentVal === "true" ? "Đúng" : studentVal === "false" ? "Sai" : "Trống"}
                                  </span>
                                  {!subCorrect && (
                                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                      → <span className="text-emerald-700 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30">
                                        {sq.answerKey === "true" ? "Đúng" : "Sai"}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null;
                    })()}
                 </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
