import { useState, useEffect } from "react";

export function useDraftSync(assignmentId: string, sessionId: string | null) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const draftKey = `assignment-draft-${assignmentId}`;

  // Initial Load Draft
  useEffect(() => {
    if (!sessionId) return;
    
    const loadDraft = async () => {
      try {
        const res = await fetch(`/api/student-sessions/${sessionId}/draft`);
        if (res.ok) {
          const data = await res.json();
          if (data.draftAnswers && Object.keys(data.draftAnswers).length > 0) {
            setAnswers(data.draftAnswers);
          }
        }
      } catch {
        // Fallback localStorage
        try {
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.answers) setAnswers(parsed.answers);
          }
        } catch {}
      }
    };
    
    loadDraft();
  }, [sessionId, draftKey]);

  // Sync Draft
  useEffect(() => {
    if (!sessionId) return;
    
    const saveDraft = async () => {
      try {
        await fetch(`/api/student-sessions/${sessionId}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftAnswers: answers }),
        });
        localStorage.setItem(draftKey, JSON.stringify({ answers }));
      } catch {
        try { localStorage.setItem(draftKey, JSON.stringify({ answers })); } catch {}
      }
    };

    const timeoutId = setTimeout(saveDraft, 500); // Debounce 500ms
    return () => clearTimeout(timeoutId);
  }, [answers, sessionId, draftKey]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  return {
    answers,
    setAnswers,
    handleAnswerChange
  };
}
