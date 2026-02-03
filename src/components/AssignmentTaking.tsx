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
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [startTime] = useState(Date.now());
  const draftKey = useMemo(() => `assignment-draft-${assignment.id}`, [assignment.id]);
  const hasAutoSubmitted = useRef(false);
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
          // Kiểm tra nội dung có thay đổi không
          const hasChanges = newQuestions.some((newQ, idx) => {
            const oldQ = questions[idx];
            if (!oldQ) return true;
            
            return newQ.content !== oldQ.content || 
                   JSON.stringify(newQ.choices || []) !== JSON.stringify(oldQ.choices || []) ||
                   (newQ.imageUrl || '') !== (oldQ.imageUrl || '');
          });
          
          if (hasChanges) {
            console.log("📝 Cập nhật: Nội dung câu hỏi đã thay đổi");
            setQuestions(newQuestions);
          }
        }
      } catch (err) {
        // Silent fail để không spam console
        // console.error("Lỗi khi cập nhật câu hỏi:", err);
      }
    };

    // Fetch ngay lần đầu
    fetchQuestions();

    // Sau đó fetch mỗi 3 giây
    const intervalId = setInterval(fetchQuestions, 3000);
    
    return () => clearInterval(intervalId);
  }, [assignment.id, sessionId, questions.length, submitting, hasSubmitted]);

  const timeUp = hasTimer && remaining === 0;
  const locked = timeUp;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

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
  }, [assignment.id, studentName, sessionId, answers, startTime, draftKey, locked, submitting]);

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
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600">{assignment.subject} · {assignment.grade}</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{assignment.title}</h1>
            {studentName && (
              <p className="text-sm text-slate-600 mt-1">Học sinh: <span className="font-semibold">{studentName}</span></p>
            )}
            {assignment.durationMinutes && (
              <p className="text-sm text-slate-600 mt-1">Thời gian làm bài: {assignment.durationMinutes} phút</p>
            )}
          </div>
          <button
            onClick={handleExitClick}
            className="text-sm text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline"
          >
            ← Quay lại
          </button>
        </div>

        {/* Popup xác nhận thoát */}
        {showExitConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                ⚠️ Bạn muốn thoát bài tập?
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Bạn đã làm {answeredCount}/{questions.length} câu. Bạn có muốn lưu lại để làm tiếp lần sau không?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleExitConfirm(true)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Lưu lại và thoát
                </button>
                <button
                  onClick={() => handleExitConfirm(false)}
                  className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition"
                >
                  Xóa và thoát
                </button>
              </div>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full mt-3 text-sm text-slate-600 hover:text-slate-900 py-2"
              >
                Tiếp tục làm bài
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[1fr,280px]">
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            {questions.map((q, idx) => (
              <div 
                key={q.id} 
                id={`q-${q.id}`} 
                className={clsx(
                  "space-y-3 rounded-lg p-4",
                  q.type === "section" 
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300" 
                    : "bg-slate-50 border border-slate-200"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {q.type === "section" ? (
                      // Thông báo - Hiển thị nổi bật
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-blue-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold uppercase tracking-wide text-blue-700 mb-1">📢 Thông báo</p>
                          {q.imageUrl && (
                            <div className="my-3 rounded-lg border border-blue-200 p-2 bg-white">
                              <img src={q.imageUrl} alt="Thông báo" className="max-h-64 w-auto rounded" />
                            </div>
                          )}
                          <p className="text-base font-semibold text-slate-900 leading-relaxed">{q.content}</p>
                        </div>
                      </div>
                    ) : (
                      // Câu hỏi thường
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Câu {idx + 1}</p>
                        {q.imageUrl && (
                          <div className="my-3 rounded-lg border border-slate-200 p-2 bg-white">
                            <img src={q.imageUrl} alt="Câu hỏi" className="max-h-64 w-auto rounded" />
                          </div>
                        )}
                        {q.content && <p className="text-base font-medium text-slate-900 mt-2">{q.content}</p>}
                      </>
                    )}
                  </div>
                  {q.type !== "section" && (
                    <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md">{Number(q.points ?? 0).toFixed(3)} đ</span>
                  )}
                </div>
                
                {/* Chỉ hiển thị phần trả lời cho MCQ và Essay, không cho Section */}
                {q.type === "mcq" ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {[0, 1, 2, 3].map((ci) => {
                      const choice = q.choices?.[ci] || "";
                      const val = String.fromCharCode(65 + ci);
                      const checked = answers[q.id] === val;
                      return (
                        <label
                          key={ci}
                          className={clsx(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition",
                            checked 
                              ? "border-slate-900 bg-slate-900 text-white" 
                              : "border-slate-300 bg-white hover:border-slate-400"
                          )}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            className="accent-slate-900"
                            checked={checked}
                            disabled={locked}
                            onChange={() => setChoice(q.id, val)}
                          />
                          <span className="font-semibold">{val}.</span>
                          {choice && <span>{choice}</span>}
                        </label>
                      );
                    })}
                  </div>
                ) : q.type === "essay" ? (
                  <textarea
                    className="min-h-[120px] w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    placeholder="Nhập câu trả lời của bạn"
                    disabled={locked}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setChoice(q.id, e.target.value)}
                  />
                ) : null}
              </div>
            ))}
            <button
              className={clsx(
                "w-full rounded-lg px-6 py-3 text-sm font-semibold transition",
                locked || submitting 
                  ? "bg-slate-300 text-slate-600 cursor-not-allowed" 
                  : "bg-slate-900 text-white hover:bg-slate-800"
              )}
              type="button"
              disabled={locked || submitting}
              onClick={() => handleSubmit(false)}
            >
              {submitting ? "Đang nộp..." : locked ? "Đã khóa bài" : "Nộp bài"}
            </button>
          </div>

          <div className="space-y-4 sticky top-4 self-start">
            {/* Đồng hồ thời gian thực Việt Nam */}
            {isMounted && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center shadow-sm">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Giờ Việt Nam</p>
                <p className="text-2xl font-bold text-blue-900 mt-2 font-mono">
                  {formatVietnamTime(currentVietnamTime)}
                </p>
              </div>
            )}

            {isMounted && hasTimer && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Thời gian còn lại</p>
                <p className={clsx(
                  "text-4xl font-bold mt-2",
                  timeUp ? "text-red-600" : "text-slate-900"
                )}>
                  {formatClock(remaining)}
                </p>
                {timeUp && <p className="text-sm text-red-600 mt-1">Hết giờ</p>}
              </div>
            )}
            
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-3">Tiến độ</div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Đã làm</span>
                <span className="text-lg font-bold text-slate-900">{answeredCount}/{questions.length}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-900 transition-all duration-300"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-3">Câu hỏi</div>
              <div className="grid grid-cols-4 gap-2">
                {questions.map((q, idx) => {
                  const done = Boolean(answers[q.id]);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => scrollToQuestion(q.id)}
                      className={clsx(
                        "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold transition",
                        done 
                          ? "bg-slate-900 text-white" 
                          : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                      )}
                      aria-label={`Chuyển đến câu ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
