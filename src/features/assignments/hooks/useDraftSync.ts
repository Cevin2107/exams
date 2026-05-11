import { useState, useEffect, useRef } from "react";

export function useDraftSync(assignmentId: string, sessionId: string | null) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const draftKey = `assignment-draft-${assignmentId}`;
  const isInitialLoad = useRef(true);
  const lastSavedAnswers = useRef<string>("");

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
            lastSavedAnswers.current = JSON.stringify(data.draftAnswers);
          }
        }
      } catch {
        // Fallback localStorage
        try {
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.answers) {
              setAnswers(parsed.answers);
              lastSavedAnswers.current = JSON.stringify(parsed.answers);
            }
          }
        } catch {}
      } finally {
        isInitialLoad.current = false;
      }
    };
    
    loadDraft();
  }, [sessionId, draftKey]);

  // Sync Draft
  useEffect(() => {
    if (!sessionId || isInitialLoad.current) return;
    
    const currentAnswersStr = JSON.stringify(answers);
    if (currentAnswersStr === lastSavedAnswers.current) return;

    const saveDraft = async () => {
      setIsSaving(true);
      try {
        await fetch(`/api/student-sessions/${sessionId}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftAnswers: answers }),
        });
        localStorage.setItem(draftKey, JSON.stringify({ answers }));
        lastSavedAnswers.current = currentAnswersStr;
        setLastSaved(new Date());
      } catch {
        try { 
          localStorage.setItem(draftKey, JSON.stringify({ answers })); 
          lastSavedAnswers.current = currentAnswersStr;
          setLastSaved(new Date());
        } catch {}
      } finally {
        setIsSaving(false);
      }
    };

    const timeoutId = setTimeout(saveDraft, 1000); // Debounce 1000ms
    return () => clearTimeout(timeoutId);
  }, [answers, sessionId, draftKey]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  return {
    answers,
    setAnswers,
    handleAnswerChange,
    isSaving,
    lastSaved
  };
}
