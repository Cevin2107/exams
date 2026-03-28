import { useEffect, useState } from "react";
import { countActualQuestions } from "@/lib/utils";
import { RegradeModal, RegradeInstruction } from "@/components/RegradeControls";
import { StudentAnswerReviewList, type ReviewQuestion } from "./StudentAnswerReviewList";
import { CheckCircle2, Edit3, RefreshCw, Target, Timer, TrendingUp, Zap } from "lucide-react";

interface StudentWorkReviewPanelProps {
  questions: ReviewQuestion[];
  startedAt: string;
  isSubmitted: boolean;
  isPaused?: boolean;
  pausedAt?: string;
  submissionId?: string;
  submissionScore?: number;
  submissionDurationSeconds?: number;
  answeredCountOverride?: number;
  onRefresh: () => Promise<void> | void;
  notify?: (message: string, type: "success" | "error") => void;
}

type RegradeAnswerState = {
  isCorrect: boolean;
  pointsAwarded: number;
  subAnswers?: Record<string, boolean>;
};

export function StudentWorkReviewPanel({
  questions,
  startedAt,
  isSubmitted,
  isPaused = false,
  pausedAt,
  submissionId,
  submissionScore,
  submissionDurationSeconds,
  answeredCountOverride,
  onRefresh,
  notify,
}: StudentWorkReviewPanelProps) {
  const [regradingMode, setRegradingMode] = useState(false);
  const [regrading, setRegrading] = useState(false);
  const [regradeAnswers, setRegradeAnswers] = useState<Map<string, RegradeAnswerState>>(new Map());

  const [liveNow, setLiveNow] = useState(() => Date.now());

  useEffect(() => {
    if (isSubmitted || isPaused) return;

    const timer = setInterval(() => {
      setLiveNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitted, isPaused]);

  const answeredCountFromQuestions = questions.filter((q) => q.studentAnswer && q.type !== "section").length;
  const answeredCount = typeof answeredCountOverride === "number"
    ? answeredCountOverride
    : answeredCountFromQuestions;
  const totalQuestions = countActualQuestions(questions as any);
  const startedAtMs = new Date(startedAt).getTime();
  const pausedAtMs = pausedAt ? new Date(pausedAt).getTime() : NaN;
  const endTimeMs = isPaused && Number.isFinite(pausedAtMs) ? pausedAtMs : liveNow;
  const elapsedSeconds = Number.isNaN(startedAtMs)
    ? 0
    : Math.max(0, Math.floor((endTimeMs - startedAtMs) / 1000));
  const workSeconds = isSubmitted && submissionDurationSeconds != null
    ? Math.max(0, Math.floor(submissionDurationSeconds))
    : elapsedSeconds;
  const workTimeLabel = (() => {
    const hours = Math.floor(workSeconds / 3600);
    const minutes = Math.floor((workSeconds % 3600) / 60);
    const seconds = workSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  })();
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const startRegrading = () => {
    const initialAnswers = new Map<string, RegradeAnswerState>();
    questions.forEach((q) => {
      initialAnswers.set(q.questionId, {
        isCorrect: q.isCorrect ?? false,
        pointsAwarded: q.pointsAwarded ?? 0,
      });
    });

    setRegradeAnswers(initialAnswers);
    setRegradingMode(true);
  };

  const cancelRegrading = () => {
    setRegradingMode(false);
    setRegradeAnswers(new Map());
  };

  const toggleAnswerCorrectness = (questionId: string, points: number) => {
    const newAnswers = new Map(regradeAnswers);
    const current = newAnswers.get(questionId);

    if (!current) return;

    const newIsCorrect = !current.isCorrect;
    newAnswers.set(questionId, {
      isCorrect: newIsCorrect,
      pointsAwarded: newIsCorrect ? points : 0,
    });

    setRegradeAnswers(newAnswers);
  };

  const setAnswerPoints = (questionId: string, pointsAwarded: number, totalPoints: number) => {
    const safePoints = Math.max(0, Math.min(pointsAwarded, totalPoints));
    const newAnswers = new Map(regradeAnswers);
    newAnswers.set(questionId, {
      isCorrect: safePoints > 0,
      pointsAwarded: safePoints,
    });
    setRegradeAnswers(newAnswers);
  };

  const setSubQuestionAnswer = (
    questionId: string,
    subQuestionIndex: number,
    isCorrect: boolean,
    totalPoints: number,
    totalSubQuestions: number
  ) => {
    const newAnswers = new Map(regradeAnswers);
    const current = newAnswers.get(questionId) || { isCorrect: false, pointsAwarded: 0, subAnswers: {} };
    
    if (!current.subAnswers) {
      current.subAnswers = {};
    }
    
    current.subAnswers![subQuestionIndex.toString()] = isCorrect;
    
    // Tính điểm theo số mệnh đề đúng trong câu đúng/sai
    const subQuestionArray = Object.values(current.subAnswers);
    const correctCount = subQuestionArray.filter((v) => v === true).length;
    const numSubQuestions = Math.max(totalSubQuestions, 1);
    const pointsPerSubQuestion = totalPoints / numSubQuestions;
    current.pointsAwarded = Math.max(0, Math.min(totalPoints, correctCount * pointsPerSubQuestion));
    current.isCorrect = current.pointsAwarded > 0;
    
    newAnswers.set(questionId, current);
    setRegradeAnswers(newAnswers);
  };

  const submitRegrade = async () => {
    if (!submissionId) return;

    const answers = Array.from(regradeAnswers.entries()).map(([questionId, data]) => ({
      questionId,
      isCorrect: data.isCorrect,
      pointsAwarded: data.pointsAwarded,
    }));

    setRegrading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/regrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) throw new Error("Failed to regrade");

      const result = await res.json();
      if (notify) {
        notify(`Chấm lại thành công! Điểm mới: ${result.newScore}/10`, "success");
      } else {
        alert(`Chấm lại thành công! Điểm mới: ${result.newScore}/10`);
      }

      await onRefresh();
      setRegradingMode(false);
      setRegradeAnswers(new Map());
    } catch {
      if (notify) {
        notify("Có lỗi xảy ra khi chấm lại", "error");
      } else {
        alert("Có lỗi xảy ra khi chấm lại");
      }
    } finally {
      setRegrading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!isSubmitted && (
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-amber-50 border border-amber-200/80">
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500 rounded-full blur animate-pulse" />
              <Zap className="relative h-4 w-4 text-amber-600" />
            </div>
          </div>
          <p className="text-xs text-amber-800 font-medium">⚡ Cập nhật theo thời gian thực - Học sinh đang làm bài</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="group relative overflow-hidden rounded-2xl bg-slate-50/95 backdrop-blur-sm border border-slate-200/80 shadow-md shadow-slate-200/40 p-3 hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <Target className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-blue-700 drop-shadow-sm">{answeredCount}/{totalQuestions}</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Câu đã trả lời</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-slate-50/95 backdrop-blur-sm border border-slate-200/80 shadow-md shadow-slate-200/40 p-3 hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <Timer className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-xl font-bold text-purple-700 drop-shadow-sm">{workTimeLabel}</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Thời gian làm</p>
          </div>
        </div>

        {isSubmitted && (
          <div className="group relative overflow-hidden rounded-2xl bg-slate-50/95 backdrop-blur-sm border border-slate-200/80 shadow-md shadow-slate-200/40 p-3 hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-xl font-bold text-emerald-700 drop-shadow-sm">{submissionScore ?? 0}đ</p>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Điểm số</p>
            </div>
          </div>
        )}

        <div className="group relative overflow-hidden rounded-2xl bg-slate-50/95 backdrop-blur-sm border border-slate-200/80 shadow-md shadow-slate-200/40 p-3 hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <CheckCircle2 className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-xl font-bold text-indigo-700 drop-shadow-sm">{progress}%</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Tiến độ</p>
          </div>
        </div>
      </div>

      {isSubmitted && submissionId && (
        <div className="rounded-2xl bg-slate-50/95 backdrop-blur-sm border border-slate-200/80 shadow-md shadow-slate-200/40 p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {!regradingMode ? (
              <button
                onClick={startRegrading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 transition-all"
              >
                <Edit3 className="h-4 w-4" />
                Chấm lại điểm
              </button>
            ) : (
              <RegradeModal
                isOpen={regradingMode}
                isRegrading={regrading}
                onSave={submitRegrade}
                onCancel={cancelRegrading}
              />
            )}
          </div>
          <RegradeInstruction show={regradingMode} />
        </div>
      )}

      <StudentAnswerReviewList
        questions={questions}
        isSubmitted={isSubmitted}
        regradingMode={regradingMode}
        regradeAnswers={regradeAnswers}
        onToggleAnswerCorrectness={toggleAnswerCorrectness}
        onSetAnswerPoints={setAnswerPoints}
        onSetSubQuestionAnswer={setSubQuestionAnswer}
      />
    </div>
  );
}
