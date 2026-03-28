'use client'

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

interface AutoSaveIndicatorProps {
  lastSaveTime: number | null;
  isSaving: boolean;
}

export function AutoSaveIndicator({ lastSaveTime, isSaving }: AutoSaveIndicatorProps) {
  const [displayText, setDisplayText] = useState<string>(""); 
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    if (isSaving) {
      setDisplayText("Đang lưu...");
      setShowIndicator(true);
      return;
    }

    if (lastSaveTime) {
      setDisplayText("Đã lưu");
      setShowIndicator(true);
      
      // Hide after 3 seconds
      const timeout = setTimeout(() => {
        setShowIndicator(false);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [isSaving, lastSaveTime]);

  if (!showIndicator) return null;

  return (
    <div className="fixed bottom-6 right-6 z-30 animate-slide-up">
      <div className={`
        flex items-center gap-2 px-4 py-2 rounded-full shadow-lg backdrop-blur-sm transition-all
        ${isSaving 
          ? 'bg-blue-50/95 border border-blue-200 text-blue-700' 
          : 'bg-emerald-50/95 border border-emerald-200 text-emerald-700'
        }
      `}>
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        <span className="text-sm font-semibold">
          {displayText}
        </span>
      </div>
    </div>
  );
}
