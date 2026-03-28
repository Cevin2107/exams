import React from "react";
import { Button } from "@/components/ui/Button";
import { TimerBadge } from "./TimerBadge";
import { LogOut } from "lucide-react";

interface TakingHeaderProps {
  title: string;
  studentName: string | null;
  answeredCount: number;
  totalQuestions: number;
  hasTimer: boolean;
  remaining: number;
  timeUp: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  onExit: () => void;
}

export const TakingHeader: React.FC<TakingHeaderProps> = ({
  title, studentName, answeredCount, totalQuestions,
  hasTimer, remaining, timeUp, isSubmitting, onSubmit, onExit,
}) => {
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/90 backdrop-blur-md shadow-xl shadow-black/30">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm md:text-base font-bold text-white truncate">{title}</h1>
            <p className="text-xs text-slate-400 truncate">
              {studentName ? `📌 ${studentName}` : "Đang tải..."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
             {hasTimer && <TimerBadge remaining={remaining} timeUp={timeUp} />}
             <Button
                variant="brand"
                onClick={onSubmit}
                disabled={isSubmitting || timeUp}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 shadow-md shadow-indigo-900/50 hover:opacity-90"
             >
                {isSubmitting ? "Đang nộp..." : "Nộp bài"}
             </Button>
             <button
                onClick={onExit}
                className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-full transition"
                title="Rời khỏi trang"
             >
                <LogOut className="w-5 h-5" />
             </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-0.5 w-full bg-white/5">
        <div
           className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
           style={{ width: `${progressPercent}%` }}
        />
      </div>
    </header>
  );
};
