"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { Assignment, Question } from "@/lib/types";
import { getActualQuestions } from "@/lib/utils";
import { TabSwitchWarning } from "@/components/TabSwitchWarning";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";
import { Clock, Moon, Sun } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { AssignmentQuestion } from "@/components/AssignmentQuestion";
import { useTheme } from "@/providers/ThemeProvider";

interface Props {
  assignment: Assignment;
  questions: Question[];
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

const formatVietnamTime = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  return new Intl.DateTimeFormat('vi-VN', options).format(date);
};

export function AssignmentTaking({ assignment, questions: initialQuestions }: Props) {
  const router = useRouter();
  const [studentName, setStudentName] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const hasTimer = Boolean(assignment.durationMinutes);
  const [remaining, setRemaining] = useState(hasTimer ? (assignment.durationMinutes ?? 0) * 60 : 0);
  const [currentVietnamTime, setCurrentVietnamTime] = useState(new Date());
  const [serverDeadline, setServerDeadline] = useState<Date | null>(null);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [essayImages, setEssayImages] = useState<Record<string, string>>({});
  const [essayImageUploading, setEssayImageUploading] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [startTime] = useState(Date.now());
  const draftKey = useMemo(() => `assignment-draft-${assignment.id}`, [assignment.id]);
  const hasAutoSubmitted = useRef(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";

  useEffect(() => {
    setIsMounted(true);
    if (typeof window === "undefined") return;
    const savedName = localStorage.getItem(`student-name-${assignment.id}`);
    const savedSessionId = localStorage.getItem(`session-${assignment.id}`);
    
    if (!savedName || !savedSessionId) {
      router.push(`/assignments/${assignment.id}/start`);
      return;
    }
    
    setStudentName(savedName);
    setSessionId(savedSessionId);

    fetch("/api/student-sessions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: savedSessionId, status: "active" }),
    }).catch(err => console.error(err));

    fetch(`/api/student-sessions/check-deadline?sessionId=${savedSessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.deadlineAt) setServerDeadline(new Date(data.deadlineAt));
      })
      .catch(err => console.error(err));
  }, [assignment.id, router]);

  useEffect(() => {
    const id = setInterval(() => setCurrentVietnamTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!sessionId || submitting || hasSubmitted) return;
    const fetchDeadline = async () => {
      try {
        const res = await fetch(`/api/student-sessions/check-deadline?sessionId=${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.deadlineAt) {
          setServerDeadline(prev => {
            const newD = new Date(data.deadlineAt);
            if (!prev || Math.abs(newD.getTime() - prev.getTime()) > 1000) return newD;
            return prev;
          });
        }
      } catch (err) { }
    };
    const id = setInterval(fetchDeadline, 15000);
    return () => clearInterval(id);
  }, [sessionId, submitting, hasSubmitted]);

  useEffect(() => {
    if (!sessionId || submitting || hasSubmitted) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase
      .channel(`assignment-${assignment.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignments', filter: `id=eq.${assignment.id}` }, async (payload: any) => {
        if (payload.new.duration_minutes !== undefined) {
          try {
            const res = await fetch(`/api/student-sessions/check-deadline?sessionId=${sessionId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.deadlineAt) setServerDeadline(new Date(data.deadlineAt));
            }
          } catch (err) {}
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [assignment.id, sessionId, submitting, hasSubmitted]);

  useEffect(() => {
    if (!serverDeadline) return;
    const id = setInterval(() => {
      const remainingMs = serverDeadline.getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(remainingMs / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [serverDeadline]);

  useEffect(() => {
    if (typeof window === "undefined" || !sessionId) return;
    const loadDraft = async () => {
      try {
        const res = await fetch(`/api/student-sessions/${sessionId}/draft`);
        if (res.ok) {
          const data = await res.json();
          if (data.draftAnswers && Object.keys(data.draftAnswers).length > 0) {
            setAnswers(data.draftAnswers);
          }
        }
      } catch (err) {
        try {
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.answers) setAnswers(parsed.answers);
          }
        } catch (localErr) {}
      }
    };
    loadDraft();
  }, [sessionId, draftKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !sessionId) return;
    const saveDraft = async () => {
      try {
        setIsSaving(true);
        await fetch(`/api/student-sessions/${sessionId}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftAnswers: answers }),
        });
        localStorage.setItem(draftKey, JSON.stringify({ answers }));
        setLastSaveTime(Date.now());
      } catch (err) {
        try {
          localStorage.setItem(draftKey, JSON.stringify({ answers }));
          setLastSaveTime(Date.now());
        } catch (localErr) {}
      } finally {
        setIsSaving(false);
      }
    };
    const id = setTimeout(saveDraft, 500);
    return () => clearTimeout(id);
  }, [answers, sessionId, draftKey]);

  useEffect(() => {
    if (!sessionId || submitting || hasSubmitted) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const fetchQuestions = async () => {
      try {
        const res = await fetch(`/api/assignments/${assignment.id}/questions`);
        if (!res.ok) return;
        const data = await res.json();
        const newQs = data.questions as Question[];
        if (!newQs || !Array.isArray(newQs)) return;
        
        if (newQs.length !== questions.length) {
          setQuestions(newQs);
        } else if (newQs.length > 0) {
          const updated = questions.map(oldQ => {
            const newQ = newQs.find(q => q.id === oldQ.id);
            if (!newQ) return oldQ;
            const hasChange = newQ.content !== oldQ.content || JSON.stringify(newQ.choices) !== JSON.stringify(oldQ.choices) || (newQ.imageUrl || '') !== (oldQ.imageUrl || '');
            if (hasChange) {
              if (!newQ.imageUrl && oldQ.imageUrl) return { ...newQ, imageUrl: oldQ.imageUrl };
              return newQ;
            }
            return oldQ;
          });
          if (updated.some((q, i) => q !== questions[i])) setQuestions(updated);
        }
      } catch (err) {}
    };
    const c = supabase.channel(`questions-${assignment.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `assignment_id=eq.${assignment.id}` }, fetchQuestions).subscribe();
    return () => { supabase.removeChannel(c); };
  }, [assignment.id, sessionId, questions.length, submitting, hasSubmitted]);

  const timeUp = hasTimer && remaining === 0;
  const locked = timeUp;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const nonSectionQuestions = useMemo(() => getActualQuestions(questions), [questions]);

  const handleSubmit = useCallback(async (isAutoSubmit = false) => {
    if (submitting || (locked && !isAutoSubmit)) return;
    if (!studentName || !sessionId) return;
    setSubmitting(true);
    setHasSubmitted(true);
    try {
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id, studentName, sessionId, answers, essayImages, durationSeconds }),
      });
      const data = await res.json();
      if (res.ok) {
        try { localStorage.removeItem(draftKey); } catch (err) {}
        window.location.href = `/assignments/${assignment.id}/result?sid=${data.submissionId}`;
      } else setSubmitting(false);
    } catch (err) { setSubmitting(false); }
  }, [assignment.id, studentName, sessionId, answers, essayImages, startTime, draftKey, locked, submitting]);

  useEffect(() => {
    if (timeUp && !hasAutoSubmitted.current && !submitting && studentName) {
      hasAutoSubmitted.current = true;
      handleSubmit(true);
    }
  }, [timeUp, submitting, studentName, handleSubmit]);

  useEffect(() => {
    if (!sessionId || !studentName) return;
    let hasExited = false;
    const handleVC = () => {
      if (document.hidden && !hasSubmitted && !hasExited) {
        fetch("/api/student-sessions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, status: "exited" }) }).catch(e => e);
        hasExited = true;
      } else if (!document.hidden && hasExited && !hasSubmitted) {
        fetch("/api/student-sessions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, status: "active" }) }).catch(e => e);
        hasExited = false;
      }
    };
    const handleBU = () => {
      if (!hasSubmitted) fetch("/api/student-sessions", { method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, status: "exited" }) }).catch(e=>e);
    };
    document.addEventListener("visibilitychange", handleVC);
    window.addEventListener("beforeunload", handleBU);
    return () => { document.removeEventListener("visibilitychange", handleVC); window.removeEventListener("beforeunload", handleBU); };
  }, [sessionId, studentName, hasSubmitted]);

  useEffect(() => {
    if (!sessionId || !studentName || hasSubmitted) return;

    const tick = () => {
      if (document.hidden) return;
      fetch("/api/student-sessions/activity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch((e) => e);
    };

    // Send one heartbeat immediately and continue periodically while visible.
    tick();
    const timer = window.setInterval(tick, 15000);
    return () => window.clearInterval(timer);
  }, [sessionId, studentName, hasSubmitted]);

  const setChoice = useCallback((questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (sessionId) {
      fetch("/api/student-sessions/activity", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) }).catch(e=>e);
    }
  }, [sessionId]);

  const handleSetEssayImageUploading = useCallback((qid: string, isUploading: boolean) => {
    setEssayImageUploading(prev => ({ ...prev, [qid]: isUploading }));
  }, []);

  const handleSetEssayImage = useCallback((qid: string, url: string | null) => {
    setEssayImages(prev => {
      if (!url) { const p = { ...prev }; delete p[qid]; return p; }
      return { ...prev, [qid]: url };
    });
  }, []);

  const scrollToQuestion = (questionId: string) => {
    const el = document.getElementById(`q-${questionId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleExitClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (answeredCount > 0) setShowExitConfirm(true); else router.push("/");
  };

  const handleExitConfirm = async (saveProgress: boolean) => {
    if (saveProgress && sessionId) {
      try { await fetch("/api/student-sessions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, status: "exited" }) }); } catch(e){}
      localStorage.removeItem(`session-${assignment.id}`);
      localStorage.removeItem(`student-name-${assignment.id}`);
    } else {
      if (sessionId) fetch(`/api/student-sessions/${sessionId}`, { method: "DELETE" }).catch(e=>e);
      localStorage.removeItem(draftKey);
      localStorage.removeItem(`session-${assignment.id}`);
      localStorage.removeItem(`student-name-${assignment.id}`);
    }
    setShowExitConfirm(false);
    router.push("/");
  };

  return (
    <main className={clsx(
      "min-h-[100dvh] transition-colors duration-500 font-sans",
      isDark ? "bg-[#0B1120] text-slate-200" : "bg-[#f8fafc] text-slate-800"
    )}>
      {isDark && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-900/20 blur-[120px] rounded-full mix-blend-screen" />
        </div>
      )}

      <TabSwitchWarning sessionId={sessionId} />
      <AutoSaveIndicator lastSaveTime={lastSaveTime} isSaving={isSaving} />
      
      {/* Top Navigation */}
      <div className={clsx(
        "sticky top-0 z-40 transition-all duration-300",
        isDark ? "bg-[#1e293b]/80 border-b border-slate-800 backdrop-blur-xl shadow-lg" : "bg-white/80 border-b border-slate-200 backdrop-blur-xl shadow-sm"
      )}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3 sm:py-4">
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className={clsx("hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white")}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="min-w-0" suppressHydrationWarning>
                <h1 className={clsx("truncate text-sm sm:text-lg font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                  {assignment.title}
                </h1>
                <p className={clsx("text-[11px] sm:text-xs font-medium truncate mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                  {assignment.subject} {assignment.grade && `• ${assignment.grade}`} {studentName && `• ${studentName}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button onClick={toggleTheme} className={clsx(
                "p-2 rounded-xl transition-colors hidden sm:block",
                isDark ? "bg-slate-800 text-amber-400 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}>
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              
              {isMounted && hasTimer && (
                <div className={clsx(
                  "flex items-center gap-1.5 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold tabular-nums shadow-sm transition-colors",
                  remaining <= 300 
                    ? isDark ? "bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : "bg-red-100 text-red-700 border-red-200" 
                    : remaining <= 900 
                      ? isDark ? "bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]" : "bg-amber-100 text-amber-700" 
                      : isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"
                )}>
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {formatClock(remaining)}
                </div>
              )}
              
              <button
                onClick={handleExitClick}
                className={clsx(
                  "flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold transition-all border shadow-sm",
                  isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                )}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Thoát</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Progress Line */}
        <div className={clsx("h-[3px] w-full", isDark ? "bg-slate-800" : "bg-slate-100")}>
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500 transition-all duration-700 ease-out"
            style={{ width: `${nonSectionQuestions.length > 0 ? (answeredCount / nonSectionQuestions.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
          <div className={clsx("w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-scale-in border", isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-100")}>
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 mb-4 ring-8 ring-amber-500/10">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className={clsx("text-lg font-black mb-1", isDark ? "text-white" : "text-slate-900")}>Thoát bài ngay?</h3>
              <p className={clsx("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>Bạn đã làm {answeredCount}/{nonSectionQuestions.length} câu. Tiến trình có thể lưu lại được.</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => handleExitConfirm(true)} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-lg shadow-indigo-600/30">
                Lưu và thoát (Tiếp tục sau)
              </button>
              <button onClick={() => handleExitConfirm(false)} className={clsx("w-full rounded-xl border px-4 py-3.5 text-sm font-bold transition-all", isDark ? "border-red-500/20 text-red-400 bg-red-500/10 hover:bg-red-500/20" : "border-red-200 text-red-600 bg-red-50 hover:bg-red-100")}>
                Xoá bài (Làm lại cữ đầu)
              </button>
              <button onClick={() => setShowExitConfirm(false)} className={clsx("w-full rounded-xl px-4 py-3.5 text-sm font-bold transition-all", isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100")}>
                Hủy, quay lại bài
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 lg:py-10">
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr,340px] items-start">
          
          <div className="space-y-4 sm:space-y-6 min-w-0 pb-20 lg:pb-0">
            {questions.map((q, idx) => {
              const questionNumber = questions.slice(0, idx + 1).filter(q2 => q2.type !== 'section').length;
              return (
                <AssignmentQuestion
                  key={q.id}
                  q={q}
                  idx={idx}
                  questionNumber={questionNumber}
                  answer={answers[q.id]}
                  essayImage={essayImages[q.id]}
                  essayImageUploading={essayImageUploading[q.id] || false}
                  locked={locked}
                  onSetChoice={setChoice}
                  onSetEssayImageUploading={handleSetEssayImageUploading}
                  onSetEssayImage={handleSetEssayImage}
                  theme={theme}
                />
              );
            })}

            <div className={clsx(
              "rounded-3xl border p-6 sm:p-8 text-center transition-all duration-300 shadow-xl mt-8",
              isDark ? "bg-slate-800/80 border-slate-700" : "bg-white border-slate-200"
            )}>
              <div className="mb-6">
                <div className="inline-flex items-center justify-center p-3 sm:p-4 rounded-full bg-emerald-500/10 text-emerald-500 mb-4">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className={clsx("text-lg sm:text-xl font-black mb-1", isDark ? "text-white" : "text-slate-900")}>Hoàn thành bài làm</h3>
                <p className={clsx("text-sm font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                  Đã làm <span className={clsx("font-bold", isDark ? "text-white" : "text-slate-900")}>{answeredCount}</span>/{nonSectionQuestions.length} câu
                </p>
                {answeredCount < nonSectionQuestions.length && !locked && (
                  <p className="mt-1 text-sm font-bold text-amber-500">Còn {nonSectionQuestions.length - answeredCount} câu chưa làm!</p>
                )}
              </div>
              <button
                className={clsx(
                  "w-full sm:w-auto min-w-[200px] rounded-2xl px-8 py-4 text-sm sm:text-base font-black transition-all duration-300 shadow-lg",
                  locked || submitting
                    ? isDark ? "cursor-not-allowed bg-slate-700 text-slate-500 shadow-none border border-slate-600" : "cursor-not-allowed bg-slate-100 text-slate-400 shadow-none"
                    : "bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0"
                )}
                type="button"
                disabled={locked || submitting}
                onClick={() => handleSubmit(false)}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Đang nộp bài...
                  </span>
                ) : locked ? "Đã khóa" : "Nộp bài ngay"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)]">
            
            {/* Realtime Vietnam Clock */}
            {isMounted && (
              <div className={clsx("rounded-3xl border p-5 text-center shadow-lg relative overflow-hidden", isDark ? "bg-slate-800/90 border-slate-700" : "bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100")}>
                <div className="absolute top-0 right-0 p-3 opacity-20">
                  <Clock className="w-16 h-16" />
                </div>
                <p className={clsx("text-xs font-bold uppercase tracking-widest relative z-10", isDark ? "text-indigo-400" : "text-indigo-600")}>Giờ chuẩn Việt Nam</p>
                <p className={clsx("mt-1.5 font-mono text-[1.75rem] font-black tabular-nums relative z-10", isDark ? "text-white" : "text-indigo-900")}>
                  {formatVietnamTime(currentVietnamTime)}
                </p>
              </div>
            )}

            {/* Timer Panel */}
            {isMounted && hasTimer && (
              <div className={clsx(
                "rounded-3xl border p-6 text-center transition-all duration-500 shadow-xl",
                timeUp 
                  ? isDark ? "border-red-500/30 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]" : "border-red-200 bg-red-50 shadow-red-100/50"
                  : remaining <= 300 
                    ? isDark ? "border-amber-500/30 bg-amber-500/10 animate-pulse-slow" : "border-amber-200 bg-amber-50"
                    : isDark ? "border-slate-700 bg-slate-800/90" : "border-slate-200 bg-white"
              )}>
                <p className={clsx(
                  "text-[10px] font-black uppercase tracking-[0.2em] mb-2",
                  timeUp || remaining <= 300 ? "text-red-500" : remaining <= 900 ? "text-amber-500" : isDark ? "text-slate-400" : "text-slate-500"
                )}>
                  Thời gian còn lại
                </p>
                <p className={clsx(
                  "font-mono text-5xl font-black tabular-nums tracking-tighter drop-shadow-sm",
                  timeUp || remaining <= 300 ? "text-red-500" : remaining <= 900 ? "text-amber-500" : isDark ? "text-slate-100" : "text-slate-800"
                )}>
                  {formatClock(remaining)}
                </p>
                {timeUp && <p className="mt-2 text-sm font-black text-red-500 animate-pulse">Đã hết giờ làm bài!</p>}
                
                {!timeUp && hasTimer && (
                  <div className={clsx("mt-5 h-2 w-full rounded-full overflow-hidden shadow-inner", isDark ? "bg-slate-700" : "bg-slate-100")}>
                    <div
                      className={clsx(
                        "h-full rounded-full transition-all duration-1000 ease-linear",
                        remaining <= 300 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : remaining <= 900 ? "bg-amber-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"
                      )}
                      style={{ width: `${(remaining / ((assignment.durationMinutes ?? 1) * 60)) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Question Map */}
            <div className={clsx("rounded-3xl border p-5 shadow-lg flex-1 min-h-0 flex flex-col", isDark ? "bg-slate-800/90 border-slate-700" : "bg-white border-slate-200")}>
              <div className="flex items-center justify-between mb-4 shrink-0">
                <p className={clsx("text-xs font-bold uppercase tracking-widest", isDark ? "text-slate-400" : "text-slate-500")}>Câu hỏi</p>
                <span className={clsx("text-xs font-black px-2 py-0.5 rounded-md", isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-700")}>
                  {answeredCount}/{nonSectionQuestions.length}
                </span>
              </div>
              
              <div className="grid grid-cols-5 gap-2 overflow-y-auto pr-1 pb-2 scrollbar-thin flex-1 min-h-0">
                {nonSectionQuestions.map((q, idx) => {
                  const done = Boolean(answers[q.id]);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => scrollToQuestion(q.id)}
                      className={clsx(
                        "flex h-10 w-full items-center justify-center rounded-xl text-xs font-black transition-all duration-200 relative overflow-hidden",
                        done
                          ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-600 hover:scale-105"
                          : isDark 
                            ? "bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-slate-200 border border-slate-600/50" 
                            : "bg-slate-50 text-slate-500 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                      )}
                    >
                      {/* Active indicator dot */}
                      {done && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-white/50" />}
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {nonSectionQuestions.length > 0 && (
                <div className="mt-4 pt-4 border-t flex flex-wrap justify-center gap-4 text-[11px] font-bold shrink-0 border-inherit">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-md bg-indigo-500 shadow-sm" />Đã làm</span>
                  <span className="flex items-center gap-1.5"><span className={clsx("h-3 w-3 rounded-md border", isDark ? "bg-slate-700/50 border-slate-600" : "bg-slate-50 border-slate-200")} />Chưa làm</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
      
      {/* Mobile Question Map (Bottom Sheet/Floating) could be implemented here as well */}
    </main>
  );
}
