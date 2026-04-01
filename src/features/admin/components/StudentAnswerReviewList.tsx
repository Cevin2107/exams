import React from "react";
import { CheckCircle2, AlertCircle, FileCheck, XCircle } from "lucide-react";
import { MathText } from "@/components/MathText";

export interface ReviewQuestion {
  questionId: string;
  order: number;
  type: string;
  content: string;
  choices?: string[] | string;
  answerKey?: string;
  correctAnswer?: string;
  points: number;
  imageUrl?: string;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  pointsAwarded?: number;
  subQuestions?: Array<{
    id: string;
    content: string;
    answerKey?: string;
    answer_key?: string;
  }>;
}

interface StudentAnswerReviewListProps {
  questions: ReviewQuestion[];
  isSubmitted: boolean;
  regradingMode?: boolean;
  regradeAnswers?: Map<string, { isCorrect?: boolean; pointsAwarded: number; subAnswers?: Record<string, boolean> }>;
  onToggleAnswerCorrectness?: (questionId: string, points: number) => void;
  onSetAnswerPoints?: (questionId: string, pointsAwarded: number, totalPoints: number) => void;
  onSetSubQuestionAnswer?: (questionId: string, subQuestionIndex: number, isCorrect: boolean, totalPoints: number, totalSubQuestions: number) => void;
}

function normalizeToIndex(value: unknown) {
  if (value == null) return -1;
  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return -1;
  const first = normalized[0];
  if (first >= "A" && first <= "Z") return first.charCodeAt(0) - 65;
  const asNumber = Number(normalized);
  return Number.isFinite(asNumber) && asNumber > 0 ? Math.floor(asNumber - 1) : -1;
}

function sanitizeQuestionContent(content: string) {
  // Loai bo dau ngoac dong du o cuoi cau hoi neu co.
  return content.replace(/\s*}\s*$/, "").trim();
}

function toMathRenderableText(content: string) {
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

export function StudentAnswerReviewList({
  questions,
  isSubmitted,
  regradingMode = false,
  regradeAnswers = new Map(),
  onToggleAnswerCorrectness,
  onSetAnswerPoints,
  onSetSubQuestionAnswer,
}: StudentAnswerReviewListProps) {
  return (
    <div className="space-y-3">
      {questions && questions.length > 0 ? (
        questions.map((q) => {
          if (q.type === "section") return null;

          const hasAnswer = q.studentAnswer !== undefined && q.studentAnswer !== null && q.studentAnswer !== "";
          const regradeAnswer = regradeAnswers.get(q.questionId);
          const displayIsCorrect = regradingMode ? (regradeAnswer?.isCorrect ?? (q.isCorrect ?? false)) : (q.isCorrect ?? false);
          const displayPointsAwarded = regradingMode ? (regradeAnswer?.pointsAwarded ?? (q.pointsAwarded ?? 0)) : (q.pointsAwarded ?? 0);
          const displayContent = toMathRenderableText(sanitizeQuestionContent(q.content || ""));

          return (
            <div
              key={q.questionId}
              className="group relative overflow-hidden rounded-3xl bg-slate-50/95 backdrop-blur-sm border border-slate-200/80 shadow-md shadow-slate-200/40 p-3.5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              <div
                className={`absolute top-0 left-0 right-0 h-0.5 ${
                  hasAnswer
                    ? isSubmitted && displayIsCorrect
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : isSubmitted && !displayIsCorrect
                      ? "bg-gradient-to-r from-rose-500 to-red-500"
                      : "bg-gradient-to-r from-indigo-500 to-violet-500"
                    : "bg-gradient-to-r from-slate-300 to-slate-400"
                }`}
              />

              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex items-center justify-center h-8 w-8 rounded-2xl font-bold text-sm text-white shadow-md ${
                      hasAnswer
                        ? isSubmitted && displayIsCorrect
                          ? "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/30"
                          : isSubmitted && !displayIsCorrect
                          ? "bg-gradient-to-br from-rose-500 to-red-500 shadow-rose-500/30"
                          : "bg-gradient-to-br from-indigo-500 to-violet-500 shadow-indigo-500/30"
                        : "bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-500/30"
                    }`}
                  >
                    {q.order}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {q.type === "mcq" ? "Trắc nghiệm" : q.type === "true_false" ? "Đúng/Sai" : "Tự luận"}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-sm font-bold text-slate-600">{q.points}đ</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isSubmitted && hasAnswer && (
                    <>
                      {regradingMode && onToggleAnswerCorrectness ? (
                        <button
                          onClick={() => onToggleAnswerCorrectness(q.questionId, q.points)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-md transition-all ${
                            displayIsCorrect
                              ? "bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-emerald-300/30 hover:bg-emerald-200"
                              : "bg-rose-100 border border-rose-300 text-rose-800 shadow-rose-300/30 hover:bg-rose-200"
                          }`}
                        >
                          {displayIsCorrect ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          <span>{displayIsCorrect ? "Đúng" : "Sai"} · {displayPointsAwarded}/{q.points}đ</span>
                        </button>
                      ) : (
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-md ${
                            displayIsCorrect
                              ? "bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-emerald-300/30"
                              : "bg-rose-100 border border-rose-300 text-rose-800 shadow-rose-300/30"
                          }`}
                        >
                          {displayIsCorrect ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          <span>{displayIsCorrect ? "Đúng" : "Sai"} · {displayPointsAwarded}/{q.points}đ</span>
                        </div>
                      )}
                    </>
                  )}

                  {!isSubmitted && q.type === "mcq" && q.studentAnswer && (
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-md ${
                        q.isCorrect
                          ? "bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-emerald-300/30"
                          : "bg-rose-100 border border-rose-300 text-rose-800 shadow-rose-300/30"
                      }`}
                    >
                      {q.isCorrect ? "Đúng (tạm)" : "Sai (tạm)"}
                    </div>
                  )}
                </div>
              </div>

              {q.imageUrl && (
                <div className="mb-3 rounded-2xl overflow-hidden border border-slate-200/50 shadow-sm">
                  <img src={q.imageUrl} alt="Question image" className="max-h-48 w-full object-contain bg-slate-50" />
                </div>
              )}

              <div className="text-sm text-slate-700 leading-relaxed mb-3">
                <MathText text={displayContent} />
              </div>

              {q.type === "mcq" ? (
                <div className="space-y-2">
                  {(() => {
                    const parsedChoices = Array.isArray(q.choices)
                      ? q.choices
                      : (() => {
                          if (typeof q.choices !== "string") return [];
                          try {
                            const parsed = JSON.parse(q.choices);
                            return Array.isArray(parsed) ? parsed : [];
                          } catch {
                            return [];
                          }
                        })();

                    const selectedIndex = normalizeToIndex(q.studentAnswer);
                    const keyIndex = normalizeToIndex(q.correctAnswer || q.answerKey);
                    const maxIndex = Math.max(parsedChoices.length - 1, selectedIndex, keyIndex, 3);
                    const optionIndexes = Array.from({ length: maxIndex + 1 }, (_, i) => i);
                    const selectedLabel = selectedIndex >= 0 ? String.fromCharCode(65 + selectedIndex) : "-";
                    const keyLabel = keyIndex >= 0 ? String.fromCharCode(65 + keyIndex) : "-";

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2">
                            <span className="text-xs font-semibold text-indigo-700">Lựa chọn học sinh</span>
                            <span className="inline-flex items-center rounded-full border border-indigo-300 bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800">
                              {selectedLabel}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                            <span className="text-xs font-semibold text-emerald-700">Đáp án đúng</span>
                            <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                              {keyLabel}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {optionIndexes.map((i) => {
                            const optionLabel = String.fromCharCode(65 + i);
                            const isSelected = i === selectedIndex;
                            const isKey = i === keyIndex;
                            const content = typeof parsedChoices[i] === "string" ? toMathRenderableText(parsedChoices[i]) : "";

                            return (
                              <div
                                key={i}
                                className={`rounded-2xl border px-3 py-2.5 text-sm transition-all ${
                                  isSelected && isKey
                                    ? "border-emerald-400 bg-emerald-50"
                                    : isSelected
                                    ? "border-indigo-400 bg-indigo-50"
                                    : isKey
                                    ? "border-emerald-300 bg-emerald-50/70"
                                    : "border-slate-200 bg-slate-50/70"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2.5">
                                  <div className="min-w-0 flex items-start gap-2.5">
                                    <span
                                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                                        isSelected && isKey
                                          ? "bg-emerald-600 text-white"
                                          : isSelected
                                          ? "bg-indigo-600 text-white"
                                          : isKey
                                          ? "bg-emerald-200 text-emerald-700"
                                          : "bg-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {optionLabel}
                                    </span>
                                    <span className="break-words text-slate-700">
                                      {content ? <MathText text={content} /> : <span className="italic opacity-60">(Không có nội dung)</span>}
                                    </span>
                                  </div>

                                  <div className="shrink-0 flex flex-col items-end gap-1">
                                    {isSelected && (
                                      <span className="rounded-full border border-indigo-300 bg-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-800">
                                        HS chọn
                                      </span>
                                    )}
                                    {isKey && (
                                      <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800">
                                        Đáp án đúng
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                  
                  {regradingMode && onSetAnswerPoints && (
                    <div className="mt-4 p-3 bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200/50 rounded-2xl">
                      <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-2.5">Chấm lại câu trắc nghiệm</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSetAnswerPoints(q.questionId, q.points, q.points)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            regradeAnswer?.pointsAwarded === q.points
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                              : "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          ✓ Đúng ({q.points}đ)
                        </button>
                        <button
                          onClick={() => onSetAnswerPoints(q.questionId, 0, q.points)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            regradeAnswer?.pointsAwarded === 0
                              ? "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md"
                              : "bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"
                          }`}
                        >
                          ✗ Sai (0đ)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : q.type === "true_false" ? (
                <div className="space-y-2 mt-3">
                  {q.subQuestions?.map((sq, i) => {
                    const stuAnsObj = (() => {
                      try {
                        return JSON.parse(q.studentAnswer || "{}");
                      } catch {
                        return {};
                      }
                    })();
                    const isStuTrue = stuAnsObj[sq.id] === "true";
                    const isStuFalse = stuAnsObj[sq.id] === "false";
                    const isKeyTrue = sq.answerKey === "true" || sq.answer_key === "true";
                    const isKeyFalse = sq.answerKey === "false" || sq.answer_key === "false";

                    return (
                      <div
                        key={sq.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="space-y-1.5">
                          <div className="flex gap-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-400">{String.fromCharCode(97 + i)}.</span>
                            <span><MathText text={toMathRenderableText(sq.content || "")} /></span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                              HS chọn: {isStuTrue ? "Đúng" : isStuFalse ? "Sai" : "-"}
                            </span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              Đáp án: {isKeyTrue ? "Đúng" : isKeyFalse ? "Sai" : "-"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {regradingMode && onSetSubQuestionAnswer ? (
                            <>
                              <button
                                onClick={() => onSetSubQuestionAnswer(q.questionId, i, true, q.points, q.subQuestions?.length || 0)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
                                  regradeAnswer?.subAnswers?.[i.toString()] === true
                                    ? "bg-emerald-100 border border-emerald-300 text-emerald-800 ring-2 ring-emerald-200 shadow-md"
                                    : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-emerald-50"
                                }`}
                              >
                                Đúng
                              </button>
                              <button
                                onClick={() => onSetSubQuestionAnswer(q.questionId, i, false, q.points, q.subQuestions?.length || 0)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
                                  regradeAnswer?.subAnswers?.[i.toString()] === false
                                    ? "bg-rose-100 border border-rose-300 text-rose-800 ring-2 ring-rose-200 shadow-md"
                                    : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-red-50"
                                }`}
                              >
                                Sai
                              </button>
                            </>
                          ) : (
                            <>
                              <span
                                className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
                                  isStuTrue && isKeyTrue
                                    ? "bg-emerald-100 border border-emerald-300 text-emerald-800 ring-2 ring-emerald-200 shadow-md"
                                    : isStuTrue && !isKeyTrue
                                    ? "bg-rose-100 border border-rose-300 text-rose-800 ring-2 ring-rose-200 shadow-md"
                                    : isKeyTrue
                                    ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                                    : "bg-slate-200 text-slate-700 border border-slate-300"
                                }`}
                              >
                                Đúng
                              </span>
                              <span
                                className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
                                  isStuFalse && isKeyFalse
                                    ? "bg-emerald-100 border border-emerald-300 text-emerald-800 ring-2 ring-emerald-200 shadow-md"
                                    : isStuFalse && !isKeyFalse
                                    ? "bg-rose-100 border border-rose-300 text-rose-800 ring-2 ring-rose-200 shadow-md"
                                    : isKeyFalse
                                    ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                                    : "bg-slate-200 text-slate-700 border border-slate-300"
                                }`}
                              >
                                Sai
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : q.type !== "mcq" && q.studentAnswer ? (
                <div className="mt-3 space-y-2">
                  <div className="p-3 bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200/50 rounded-lg">
                    <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <FileCheck className="h-3 w-3" />
                      Câu trả lời của học sinh:
                    </p>
                    <p className="text-xs text-indigo-900 leading-relaxed"><MathText text={toMathRenderableText(q.studentAnswer || "")} /></p>
                  </div>
                  
                  {regradingMode && onSetAnswerPoints && (
                    <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 rounded-lg">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2.5">Chấm lại câu tự luận</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={q.points}
                          step="0.5"
                          value={regradeAnswer?.pointsAwarded ?? 0}
                          onChange={(e) => onSetAnswerPoints(q.questionId, parseFloat(e.target.value) || 0, q.points)}
                          className="flex-1 px-3 py-1.5 text-sm font-semibold border border-amber-300 rounded-lg bg-white text-amber-900 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="text-xs font-semibold text-amber-700">/ {q.points}đ</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200/50">
                    <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 italic">Chưa trả lời</span>
                  </div>
                  
                  {isSubmitted && regradingMode && onSetAnswerPoints && (
                    <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 rounded-lg">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2.5">Chấm câu chưa làm</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={q.points}
                          step="0.5"
                          value={regradeAnswer?.pointsAwarded ?? 0}
                          onChange={(e) => onSetAnswerPoints(q.questionId, parseFloat(e.target.value) || 0, q.points)}
                          className="flex-1 px-3 py-1.5 text-sm font-semibold border border-amber-300 rounded-lg bg-white text-amber-900 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="text-xs font-semibold text-amber-700">/ {q.points}đ</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="text-center py-6 text-slate-500">
          <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="font-medium text-sm">Chưa tải được danh sách câu hỏi.</p>
        </div>
      )}
    </div>
  );
}
