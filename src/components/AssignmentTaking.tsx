"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { Assignment, Question } from "@/lib/types";

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
  // Chuyển sang múi giờ Việt Nam (UTC+7)
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
  const initialSeconds = hasTimer ? (assignment.durationMinutes ?? 0) * 60 : 0;
  const [remaining, setRemaining] = useState(initialSeconds);
  const [currentVietnamTime, setCurrentVietnamTime] = useState(new Date());
  const [serverDeadline, setServerDeadline] = useState<Date | null>(null);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [essayImages, setEssayImages] = useState<Record<string, string>>({}); // questionId -> uploaded image URL
  const [essayImageUploading, setEssayImageUploading] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [startTime] = useState(Date.now());
  const draftKey = useMemo(() => `assignment-draft-${assignment.id}`, [assignment.id]);
  const hasAutoSubmitted = useRef(false);

  // Log initial questions để debug
  useEffect(() => {
    console.log("📸 Initial questions with images:", initialQuestions.map(q => ({
      id: q.id,
      content: q.content?.substring(0, 30),
      imageUrl: q.imageUrl
    })));
  }, [initialQuestions]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Mount flag để tránh hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Kiểm tra xem học sinh đã nhập tên chưa và lấy deadline từ server
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const savedName = localStorage.getItem(`student-name-${assignment.id}`);
    const savedSessionId = localStorage.getItem(`session-${assignment.id}`);
    
    console.log("Checking session - savedName:", savedName, "savedSessionId:", savedSessionId);
    
    if (!savedName || !savedSessionId) {
      // Chưa nhập tên, chuyển đến trang start
      console.log("No session found, redirecting to start page");
      router.push(`/assignments/${assignment.id}/start`);
      return;
    }
    
    setStudentName(savedName);
    setSessionId(savedSessionId);

    // Lấy deadline từ server
    fetch(`/api/student-sessions/check-deadline?sessionId=${savedSessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.deadlineAt) {
          setServerDeadline(new Date(data.deadlineAt));
        }
      })
      .catch(err => console.error("Failed to fetch deadline:", err));
  }, [assignment.id, router]);

  // Cập nhật đồng hồ thời gian thực Việt Nam
  useEffect(() => {
    const id = setInterval(() => {
      setCurrentVietnamTime(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Tính thời gian còn lại dựa trên server deadline
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

  useEffect(() => {
    if (typeof window === "undefined" || !sessionId) return;
    
    // Load draft từ database thay vì localStorage
    const loadDraft = async () => {
      try {
        console.log("Loading draft from database for session:", sessionId);
        const res = await fetch(`/api/student-sessions/${sessionId}/draft`);
        if (res.ok) {
          const data = await res.json();
          if (data.draftAnswers && Object.keys(data.draftAnswers).length > 0) {
            console.log("Loaded answers from database:", data.draftAnswers);
            setAnswers(data.draftAnswers);
          } else {
            console.log("No draft found in database");
          }
        }
      } catch (err) {
        console.warn("Không thể tải nháp từ database", err);
        // Fallback: thử load từ localStorage
        try {
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            const parsed = JSON.parse(saved) as { answers: Record<string, string> };
            if (parsed?.answers) {
              console.log("Loaded answers from localStorage fallback:", parsed.answers);
              setAnswers(parsed.answers);
            }
          }
        } catch (localErr) {
          console.warn("Không thể tải nháp từ localStorage", localErr);
        }
      }
    };
    
    loadDraft();
  }, [sessionId, draftKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lưu draft vào database thay vì localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !sessionId) return;
    
    const saveDraft = async () => {
      try {
        console.log("Saving draft to database, session:", sessionId, "answers:", answers);
        await fetch(`/api/student-sessions/${sessionId}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftAnswers: answers }),
        });
        // Backup vào localStorage
        localStorage.setItem(draftKey, JSON.stringify({ answers }));
      } catch (err) {
        console.warn("Không thể lưu nháp vào database, fallback to localStorage", err);
        try {
          localStorage.setItem(draftKey, JSON.stringify({ answers }));
        } catch (localErr) {
          console.warn("Không thể lưu nháp", localErr);
        }
      }
    };

    const timeoutId = setTimeout(saveDraft, 500); // Debounce 500ms
    return () => clearTimeout(timeoutId);
  }, [answers, sessionId, draftKey]);

  // Polling: Tự động cập nhật câu hỏi mỗi 3 giây
  useEffect(() => {
    if (!sessionId || submitting || hasSubmitted) return;

    const fetchQuestions = async () => {
      try {
        const res = await fetch(`/api/assignments/${assignment.id}/questions`);
        if (!res.ok) {
          console.warn(`Failed to fetch questions: ${res.status}`);
          return;
        }
        
        const data = await res.json();
        const newQuestions = data.questions as Question[];
        
        if (!newQuestions || !Array.isArray(newQuestions)) {
          console.warn("Invalid questions data received");
          return;
        }
        
        // Chỉ update nếu có thay đổi (số lượng hoặc nội dung)
        if (newQuestions.length !== questions.length) {
          console.log(`📝 Cập nhật: ${Math.abs(newQuestions.length - questions.length)} câu hỏi ${newQuestions.length > questions.length ? 'mới' : 'đã xóa'}`);
          setQuestions(newQuestions);
        } else if (newQuestions.length > 0) {
          // Kiểm tra từng câu hỏi có thay đổi không
          const updatedQuestions = questions.map((oldQ, idx) => {
            const newQ = newQuestions.find(q => q.id === oldQ.id);
            if (!newQ) return oldQ; // Giữ nguyên nếu không tìm thấy
            
            // So sánh các trường quan trọng
            const hasContentChange = newQ.content !== oldQ.content;
            const hasChoicesChange = JSON.stringify(newQ.choices || []) !== JSON.stringify(oldQ.choices || []);
            const hasImageChange = (newQ.imageUrl || '') !== (oldQ.imageUrl || '');
            
            // Nếu có thay đổi, dùng câu hỏi mới, nhưng bảo toàn imageUrl nếu mới bị null
            if (hasContentChange || hasChoicesChange || hasImageChange) {
              // Nếu imageUrl mới là null/undefined nhưng cũ có giá trị, giữ lại giá trị cũ
              if (!newQ.imageUrl && oldQ.imageUrl) {
                console.log(`⚠️ Giữ lại ảnh cho câu ${idx + 1}: ${oldQ.imageUrl}`);
                return { ...newQ, imageUrl: oldQ.imageUrl };
              }
              return newQ;
            }
            
            return oldQ; // Không thay đổi gì
          });
          
          // Kiểm tra có thay đổi thực sự không
          const hasRealChanges = updatedQuestions.some((q, idx) => q !== questions[idx]);
          if (hasRealChanges) {
            console.log("📝 Cập nhật: Nội dung câu hỏi đã thay đổi");
            setQuestions(updatedQuestions);
          }
        }
      } catch (err) {
        console.error("Error fetching questions:", err);
      }
    };

    // KHÔNG fetch ngay lần đầu, chỉ bắt đầu polling sau 3 giây
    // Vì initialQuestions đã có đầy đủ dữ liệu từ server
    const intervalId = setInterval(fetchQuestions, 3000);
    
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment.id, sessionId, questions.length, submitting, hasSubmitted]);

  const timeUp = hasTimer && remaining === 0;
  const locked = timeUp;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const nonSectionQuestions = useMemo(() => questions.filter(q => q.type !== 'section'), [questions]);

  const handleSubmit = useCallback(async (isAutoSubmit = false) => {
    if (submitting || (locked && !isAutoSubmit)) return;
    if (!studentName || !sessionId) {
      console.error("Missing studentName or sessionId:", { studentName, sessionId });
      return;
    }

    setSubmitting(true);
    setHasSubmitted(true);
    try {
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      console.log("Submitting with sessionId:", sessionId);
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
          studentName,
          sessionId,
          answers,
          essayImages,
          durationSeconds,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        try {
          localStorage.removeItem(draftKey);
        } catch (err) {
          console.warn("Không thể xóa nháp", err);
        }
        window.location.href = `/assignments/${assignment.id}/result?sid=${data.submissionId}`;
      } else {
        console.error("Lỗi nộp bài:", data.error);
        setSubmitting(false);
      }
    } catch (error) {
      console.error("Lỗi kết nối:", error);
      setSubmitting(false);
    }
  }, [assignment.id, studentName, sessionId, answers, essayImages, startTime, draftKey, locked, submitting]);

  // Tự động nộp bài khi hết giờ
  useEffect(() => {
    if (timeUp && !hasAutoSubmitted.current && !submitting && studentName) {
      hasAutoSubmitted.current = true;
      handleSubmit(true);
    }
  }, [timeUp, submitting, studentName, handleSubmit]);

  // Cập nhật trạng thái session khi rời trang hoặc chuyển tab
  useEffect(() => {
    if (!sessionId || !studentName) return;

    let hasExited = false;

    // Phát hiện chuyển tab (trang bị ẩn)
    const handleVisibilityChange = () => {
      if (document.hidden && !hasSubmitted && !hasExited) {
        // Học sinh chuyển sang tab khác
        fetch("/api/student-sessions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, status: "exited" }),
        }).catch(err => console.error("Failed to update session on tab switch:", err));
        hasExited = true;
      } else if (!document.hidden && hasExited && !hasSubmitted) {
        // Học sinh quay lại tab
        fetch("/api/student-sessions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, status: "active" }),
        }).catch(err => console.error("Failed to update session on return:", err));
        hasExited = false;
      }
    };

    // Phát hiện đóng tab/trình duyệt
    const handleBeforeUnload = () => {
      if (hasSubmitted) return;
      
      // Cập nhật trạng thái thành "exited" khi đóng tab/thoát
      fetch("/api/student-sessions", {
        method: "PUT",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status: "exited" }),
      }).catch(err => console.error("Failed to update session on exit:", err));
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sessionId, studentName, hasSubmitted]);

  const setChoice = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    
    // Cập nhật last_activity_at để admin theo dõi
    if (sessionId) {
      fetch("/api/student-sessions/activity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(err => console.error("Failed to update activity:", err));
    }
  };

  const scrollToQuestion = (questionId: string) => {
    const el = document.getElementById(`q-${questionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleExitClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (answeredCount > 0) {
      setShowExitConfirm(true);
    } else {
      router.push("/");
    }
  };

  const handleExitConfirm = async (saveProgress: boolean) => {
    if (saveProgress && sessionId) {
      // Giữ nguyên session và answers trong localStorage để tiếp tục sau
      console.log("Saving progress for session:", sessionId);
      // Cập nhật status thành exited
      try {
        await fetch("/api/student-sessions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, status: "exited" }),
        });
        console.log("Session marked as exited");
      } catch (err) {
        console.error("Failed to update session:", err);
      }
      // Xóa localStorage để buộc phải qua trang start lần sau
      localStorage.removeItem(`session-${assignment.id}`);
      localStorage.removeItem(`student-name-${assignment.id}`);
      // Giữ draft để tiếp tục
      console.log("Cleared session from localStorage, kept draft");
    } else {
      // Xóa session và draft
      if (sessionId) {
        fetch(`/api/student-sessions/${sessionId}`, { method: "DELETE" })
          .catch(err => console.error("Failed to delete session:", err));
      }
      localStorage.removeItem(draftKey);
      localStorage.removeItem(`session-${assignment.id}`);
      localStorage.removeItem(`student-name-${assignment.id}`);
    }
    setShowExitConfirm(false);
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-slate-100">
      {/* Top header bar */}
      <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0 flex-1" suppressHydrationWarning>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg brand-gradient shadow-sm">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{assignment.title}</p>
                <p className="text-xs text-slate-500">{assignment.subject} · {assignment.grade}{studentName ? ` · ${studentName}` : ''}</p>
              </div>
            </div>
          </div>

          {/* Countdown and progress in header */}
          <div className="flex items-center gap-3 shrink-0">
            {isMounted && hasTimer && (
              <div className={clsx(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums",
                remaining <= 300 ? "bg-red-50 text-red-700 ring-1 ring-red-200" :
                remaining <= 900 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" :
                "bg-slate-100 text-slate-700"
              )}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatClock(remaining)}
              </div>
            )}
            {isMounted && (
              <div className="hidden items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 sm:flex">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatVietnamTime(currentVietnamTime)}
              </div>
            )}
            <button
              onClick={handleExitClick}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Thoát
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full brand-gradient transition-all duration-500"
            style={{ width: `${nonSectionQuestions.length > 0 ? (answeredCount / nonSectionQuestions.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Thoát bài tập?</h3>
                <p className="text-sm text-slate-500">Đã làm {answeredCount}/{nonSectionQuestions.length} câu</p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleExitConfirm(true)}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Lưu tiến độ và thoát
              </button>
              <button
                onClick={() => handleExitConfirm(false)}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                Xóa bài và thoát
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full rounded-xl px-4 py-2 text-sm text-slate-500 transition hover:text-slate-700"
              >
                Tiếp tục làm bài
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid gap-5 md:grid-cols-[1fr,260px]">
          {/* Questions panel */}
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const questionNumber = questions.slice(0, idx + 1).filter(q2 => q2.type !== 'section').length;
              const isAnswered = q.type !== 'section' && Boolean(answers[q.id]);
              return (
                <div
                  key={q.id}
                  id={`q-${q.id}`}
                  className={clsx(
                    "rounded-2xl p-5 transition-all",
                    q.type === "section"
                      ? "border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50"
                      : isAnswered
                        ? "border border-emerald-200 bg-white shadow-sm ring-1 ring-emerald-100"
                        : "border border-slate-200 bg-white shadow-sm"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {q.type === "section" ? (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                            <svg className="h-4 w-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">Thông báo</p>
                            {q.imageUrl && (
                              <div className="mb-3 overflow-hidden rounded-xl border border-indigo-100">
                                <img src={q.imageUrl} alt="Thông báo" className="max-h-64 w-auto" loading="eager"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              </div>
                            )}
                            <p className="text-sm font-semibold text-slate-900 leading-relaxed">{q.content}</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={clsx(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                              isAnswered ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                            )}>
                              {questionNumber}
                            </span>
                            {isAnswered && (
                              <span className="text-xs font-semibold text-emerald-600">✓ Đã trả lời</span>
                            )}
                          </div>
                          {q.imageUrl && (
                            <div className="mb-3 overflow-hidden rounded-xl border border-slate-200">
                              <img src={q.imageUrl} alt="Câu hỏi" className="max-h-64 w-auto" loading="eager"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                          )}
                          {q.content && (
                            <p className="text-sm font-semibold text-slate-900 leading-relaxed mb-3">{q.content}</p>
                          )}
                        </>
                      )}
                    </div>
                    {q.type !== "section" && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                        {Number(q.points ?? 0).toFixed(3)}đ
                      </span>
                    )}
                  </div>

                  {/* Answer inputs */}
                  {q.type === "mcq" && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(q.choices && q.choices.length > 0 ? q.choices : ["", "", "", ""]).map((choice, ci) => {
                        const val = String.fromCharCode(65 + ci);
                        const checked = answers[q.id] === val;
                        return (
                          <label
                            key={ci}
                            className={clsx(
                              "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all",
                              checked
                                ? "border-indigo-400 bg-indigo-600 text-white shadow-sm"
                                : "border-slate-200 bg-slate-50 text-slate-800 hover:border-indigo-300 hover:bg-indigo-50"
                            )}
                          >
                            <span className={clsx(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                              checked ? "bg-white/20 text-white" : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-200"
                            )}>
                              {val}
                            </span>
                            <input type="radio" name={`q-${q.id}`} className="sr-only" checked={checked} disabled={locked} onChange={() => setChoice(q.id, val)} />
                            {choice && <span className="flex-1">{choice}</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.type === "essay" && (
                    <div className="mt-3 space-y-3">
                      <textarea
                        className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        placeholder="Nhập câu trả lời của bạn..."
                        disabled={locked}
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setChoice(q.id, e.target.value)}
                      />
                      {/* Essay image upload */}
                      {!locked && (
                        <div>
                          {essayImages[q.id] ? (
                            <div className="relative overflow-hidden rounded-xl border border-emerald-200">
                              <img src={essayImages[q.id]} alt="Ảnh bài làm" className="max-h-64 w-auto" />
                              <button
                                type="button"
                                onClick={() => setEssayImages(prev => { const n = { ...prev }; delete n[q.id]; return n; })}
                                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow transition hover:bg-red-700"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <label className={clsx(
                              "flex cursor-pointer items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition",
                              essayImageUploading[q.id]
                                ? "border-indigo-300 bg-indigo-50 text-indigo-500 cursor-wait"
                                : "border-slate-300 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                            )}>
                              {essayImageUploading[q.id] ? (
                                <>
                                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                  <span>Đang tải lên...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>Đính kèm ảnh bài làm (tuỳ chọn)</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={essayImageUploading[q.id]}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setEssayImageUploading(prev => ({ ...prev, [q.id]: true }));
                                  try {
                                    const fd = new FormData();
                                    fd.append("file", file);
                                    const res = await fetch("/api/upload-answer-image", { method: "POST", body: fd });
                                    const data = await res.json();
                                    if (res.ok && data.url) {
                                      setEssayImages(prev => ({ ...prev, [q.id]: data.url }));
                                    }
                                  } catch {
                                    // silently ignore
                                  } finally {
                                    setEssayImageUploading(prev => ({ ...prev, [q.id]: false }));
                                    e.target.value = "";
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                      {/* Show uploaded image when locked */}
                      {locked && essayImages[q.id] && (
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                          <img src={essayImages[q.id]} alt="Ảnh bài làm" className="max-h-64 w-auto" />
                        </div>
                      )}
                    </div>
                  )}

                  {q.type === "short_answer" && (
                    <input
                      type="text"
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      placeholder="Nhập câu trả lời ngắn..."
                      disabled={locked}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setChoice(q.id, e.target.value)}
                    />
                  )}

                  {q.type === "true_false" && q.subQuestions && q.subQuestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {q.subQuestions.map((sq, si) => {
                        const tfAnswers = (() => { try { return JSON.parse(answers[q.id] || "{}"); } catch { return {}; } })();
                        const selected = tfAnswers[sq.id];
                        return (
                          <div key={sq.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <span className="w-5 text-xs font-bold text-slate-400">{String.fromCharCode(97 + si)}.</span>
                            <span className="flex-1 text-sm text-slate-800">
                              {sq.content || <em className="not-italic text-slate-400">Câu {String.fromCharCode(97 + si)}</em>}
                            </span>
                            <div className="flex gap-1.5">
                              {["true", "false"].map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  disabled={locked}
                                  onClick={() => {
                                    const updated = { ...tfAnswers, [sq.id]: val };
                                    setChoice(q.id, JSON.stringify(updated));
                                  }}
                                  className={clsx(
                                    "rounded-lg px-3 py-1 text-xs font-semibold transition",
                                    selected === val
                                      ? val === "true" ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
                                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                                  )}
                                >
                                  {val === "true" ? "Đúng" : "Sai"}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Submit button */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 text-center">
                <p className="text-sm text-slate-600">
                  Đã hoàn thành <span className="font-bold text-slate-900">{answeredCount}</span>/<span className="font-bold text-slate-900">{nonSectionQuestions.length}</span> câu
                </p>
                {answeredCount < nonSectionQuestions.length && !locked && (
                  <p className="mt-1 text-xs text-amber-600">Còn {nonSectionQuestions.length - answeredCount} câu chưa trả lời</p>
                )}
              </div>
              <button
                className={clsx(
                  "w-full rounded-xl px-6 py-3 text-sm font-bold transition-all",
                  locked || submitting
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "brand-gradient text-white shadow-sm hover:opacity-90 hover:shadow-md"
                )}
                type="button"
                disabled={locked || submitting}
                onClick={() => handleSubmit(false)}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Đang nộp bài...
                  </span>
                ) : locked ? "Đã khóa bài" : "Nộp bài"}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 md:sticky md:top-20 md:self-start">
            {/* Vietnam clock */}
            {isMounted && (
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Giờ hiện tại</p>
                <p className="mt-1 font-mono text-2xl font-bold text-indigo-900 tabular-nums">
                  {formatVietnamTime(currentVietnamTime)}
                </p>
              </div>
            )}

            {/* Timer */}
            {isMounted && hasTimer && (
              <div className={clsx(
                "rounded-2xl border p-4 text-center transition-colors",
                timeUp ? "border-red-200 bg-red-50" :
                remaining <= 300 ? "border-red-200 bg-red-50" :
                remaining <= 900 ? "border-amber-200 bg-amber-50" :
                "border-slate-200 bg-white"
              )}>
                <p className={clsx(
                  "text-xs font-semibold uppercase tracking-widest",
                  timeUp || remaining <= 300 ? "text-red-500" : remaining <= 900 ? "text-amber-600" : "text-slate-500"
                )}>
                  Thời gian còn lại
                </p>
                <p className={clsx(
                  "mt-1 font-mono text-4xl font-bold tabular-nums",
                  timeUp || remaining <= 300 ? "text-red-600" : remaining <= 900 ? "text-amber-700" : "text-slate-900"
                )}>
                  {formatClock(remaining)}
                </p>
                {timeUp && <p className="mt-1 text-xs font-bold text-red-600">Hết giờ!</p>}
                {!timeUp && hasTimer && (
                  <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={clsx(
                        "h-full rounded-full transition-all duration-1000",
                        remaining <= 300 ? "bg-red-500" : remaining <= 900 ? "bg-amber-500" : "bg-indigo-500"
                      )}
                      style={{ width: `${(remaining / ((assignment.durationMinutes ?? 1) * 60)) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Progress */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Tiến độ</p>
                <span className="text-sm font-bold text-slate-900">{answeredCount}/{nonSectionQuestions.length}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 rounded-full"
                  style={{ width: `${nonSectionQuestions.length > 0 ? (answeredCount / nonSectionQuestions.length) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {nonSectionQuestions.length > 0 ? Math.round((answeredCount / nonSectionQuestions.length) * 100) : 0}% hoàn thành
              </p>
            </div>

            {/* Question navigator */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Câu hỏi</p>
              <div className="grid grid-cols-5 gap-1.5">
                {nonSectionQuestions.map((q, idx) => {
                  const done = Boolean(answers[q.id]);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => scrollToQuestion(q.id)}
                      className={clsx(
                        "flex h-9 w-full items-center justify-center rounded-xl text-xs font-bold transition-all",
                        done
                          ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                          : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                      )}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              {nonSectionQuestions.length > 0 && (
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-indigo-600" />Đã làm</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded border border-slate-300 bg-slate-50" />Chưa làm</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
