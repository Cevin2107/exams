import React from "react";
import { Clock } from "lucide-react";

interface TimerBadgeProps {
  remaining: number;
  timeUp: boolean;
}

const formatClock = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

export const TimerBadge: React.FC<TimerBadgeProps> = React.memo(({ remaining, timeUp }) => {
  if (timeUp) {
    return (
      <div className="flex animate-pulse items-center gap-2 rounded-full bg-red-100 px-4 py-2 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
        <Clock className="w-5 h-5" />
        Hết giờ!
      </div>
    );
  }

  const isWarning = remaining > 0 && remaining <= 300; // <= 5 minutes

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-4 py-2 font-bold shadow-sm ring-1 transition-colors ${
        isWarning
          ? "bg-red-50 text-red-600 ring-red-200 animate-pulse"
          : "bg-indigo-50 text-indigo-700 ring-indigo-200"
      }`}
    >
      <Clock className="w-5 h-5" />
      {formatClock(remaining)}
    </div>
  );
});

TimerBadge.displayName = "TimerBadge";
