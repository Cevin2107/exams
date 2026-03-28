'use client'

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { AlertTriangle } from "lucide-react";

interface TabSwitchWarningProps {
  sessionId: string | null;
}

export function TabSwitchWarning({ sessionId }: TabSwitchWarningProps) {
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [switchCount, setSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const handleVisibilityChange = () => {
      const nowVisible = document.visibilityState === 'visible';
      
      if (!nowVisible && isTabVisible) {
        // Tab was just hidden
        setSwitchCount(prev => prev + 1);
        setShowWarning(true);
        
        addToast({
          title: "Cảnh báo!",
          description: "Bạn đã chuyển tab. Hành vi này có thể bị ghi nhận.",
          variant: "warning",
          duration: 4000,
        });

        // Track tab switch in backend
        if (sessionId) {
          fetch("/api/student-sessions/activity", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              sessionId,
              tabSwitched: true 
            }),
          }).catch(err => console.error("Failed to track tab switch:", err));
        }
      }
      
      setIsTabVisible(nowVisible);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isTabVisible, sessionId, addToast]);

  // Auto hide warning after 10 seconds
  useEffect(() => {
    if (showWarning) {
      const timeout = setTimeout(() => setShowWarning(false), 10000);
      return () => clearTimeout(timeout);
    }
  }, [showWarning]);

  if (!showWarning || switchCount === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-md w-full px-4 animate-slide-up">
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900 mb-1">
              Phát hiện chuyển tab ({switchCount} lần)
            </h4>
            <p className="text-xs text-amber-700">
              Hãy tập trung vào bài thi. Việc chuyển tab có thể bị coi là gian lận.
            </p>
          </div>
          <button
            onClick={() => setShowWarning(false)}
            className="text-amber-600 hover:text-amber-800 transition"
            aria-label="Đóng cảnh báo"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
