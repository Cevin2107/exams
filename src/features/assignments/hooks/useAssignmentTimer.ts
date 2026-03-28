import { useState, useEffect } from "react";

interface UseAssignmentTimerProps {
  sessionId: string | null;
  hasTimer: boolean;
  submitting: boolean;
  hasSubmitted: boolean;
}

export function useAssignmentTimer({ sessionId, hasTimer, submitting, hasSubmitted }: UseAssignmentTimerProps) {
  const [serverDeadline, setServerDeadline] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [currentVietnamTime, setCurrentVietnamTime] = useState(new Date());

  // Cập nhật đồng hồ thời gian thực
  useEffect(() => {
    const id = setInterval(() => setCurrentVietnamTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Polling deadline mỗi 15s để bắt sự kiện Admin gia hạn
  useEffect(() => {
    if (!sessionId || submitting || hasSubmitted) return;
    
    const fetchDeadline = async () => {
      try {
        const res = await fetch(`/api/student-sessions/check-deadline?sessionId=${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.deadlineAt) {
          setServerDeadline(prev => {
            const newDeadline = new Date(data.deadlineAt);
            if (!prev || Math.abs(newDeadline.getTime() - prev.getTime()) > 1000) {
              return newDeadline;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Failed to poll deadline:", err);
      }
    };

    fetchDeadline(); // fetch immediately
    const id = setInterval(fetchDeadline, 15000);
    return () => clearInterval(id);
  }, [sessionId, submitting, hasSubmitted]);

  // Cập nhật đếm ngược mỗi giây nếu có serverDeadline
  useEffect(() => {
    if (!serverDeadline) return;
    
    const id = setInterval(() => {
      const now = new Date();
      const remainingMs = serverDeadline.getTime() - now.getTime();
      const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
      setRemaining(remainingSec);
    }, 1000);
    
    return () => clearInterval(id);
  }, [serverDeadline]);

  const timeUp = hasTimer && serverDeadline !== null && remaining === 0;

  return {
    remaining,
    serverDeadline,
    currentVietnamTime,
    timeUp
  };
}
