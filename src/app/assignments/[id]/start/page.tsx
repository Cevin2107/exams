"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StartAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [incompleteSession, setIncompleteSession] = useState<{ id: string; student_name: string; started_at: string } | null>(null);
  const [checkingIncomplete, setCheckingIncomplete] = useState(false);
  const router = useRouter();
  const [assignmentId, setAssignmentId] = useState<string>("");

  useEffect(() => {
    params.then(p => setAssignmentId(p.id));
  }, [params]);

  // Kiểm tra bài làm dở khi nhập tên
  useEffect(() => {
    const checkIncomplete = async () => {
      const trimmedName = studentName.trim();
      if (!trimmedName || trimmedName.length < 2 || !assignmentId) {
        setIncompleteSession(null);
        return;
      }

      setCheckingIncomplete(true);
      try {
        const res = await fetch(
          `/api/student-sessions?assignmentId=${assignmentId}&studentName=${encodeURIComponent(trimmedName)}&findIncomplete=true`
        );
        if (res.ok) {
          const data = await res.json();
          console.log("Check incomplete response:", data);
          if (data.hasIncomplete && data.session) {
            console.log("Found incomplete session:", data.session);
            setIncompleteSession(data.session);
          } else {
            console.log("No incomplete session found");
            setIncompleteSession(null);
          }
        } else {
          console.error("API error:", res.status);
          setIncompleteSession(null);
        }
      } catch (err) {
        console.error("Error checking incomplete:", err);
        setIncompleteSession(null);
      } finally {
        setCheckingIncomplete(false);
      }
    };

    const timeoutId = setTimeout(checkIncomplete, 500);
    return () => clearTimeout(timeoutId);
  }, [studentName, assignmentId]);

  const handleStart = async (resumeSessionId?: string) => {
    const trimmedName = studentName.trim();
    if (!trimmedName) {
      setError("Vui lòng nhập tên của bạn");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Tên phải có ít nhất 2 ký tự");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let sessionId = resumeSessionId;

      if (!sessionId) {
        // Tạo session mới
        const res = await fetch("/api/student-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId,
            studentName: trimmedName,
            status: "active"
          }),
        });

        if (!res.ok) {
          throw new Error("Không thể bắt đầu bài tập");
        }

        const data = await res.json();
        sessionId = data.sessionId;
      } else {
        // Resume session - cập nhật status về active
        const res = await fetch("/api/student-sessions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            status: "active"
          }),
        });

        if (!res.ok) {
          throw new Error("Không thể tiếp tục bài tập");
        }
      }
      
      if (!sessionId) {
        throw new Error("Không thể lấy session ID");
      }
      
      // Lưu session ID và tên học sinh vào localStorage
      localStorage.setItem(`session-${assignmentId}`, sessionId);
      localStorage.setItem(`student-name-${assignmentId}`, trimmedName);

      // Chuyển đến trang làm bài
      router.push(`/assignments/${assignmentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && !checkingIncomplete) {
      // Không cho phép Enter khi có bài làm dở (phải click nút rõ ràng)
      if (!incompleteSession) {
        handleStart();
      }
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-100 opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-violet-100 opacity-50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient shadow-lg mb-3">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Bắt đầu bài tập</h1>
          <p className="text-sm text-slate-500 mt-0.5">Nhập tên để tiếp tục làm bài</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="space-y-5">
            <div>
              <label htmlFor="studentName" className="mb-1.5 block text-xs font-bold text-slate-700">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                id="studentName"
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-inner transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={studentName}
                onChange={(e) => {
                  setStudentName(e.target.value);
                  setError("");
                }}
                onKeyPress={handleKeyPress}
                disabled={loading}
                autoFocus
              />
              {error && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}
              {checkingIncomplete && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Đang kiểm tra...
                </div>
              )}

              {incompleteSession && !checkingIncomplete && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <svg className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-xs font-bold text-amber-900">Bài làm chưa hoàn thành</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Bắt đầu lúc {new Date(incompleteSession.started_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleStart(incompleteSession.id)}
                      disabled={loading}
                      className="rounded-xl bg-amber-600 py-2 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
                    >
                      Tiếp tục làm
                    </button>
                    <button
                      onClick={async () => {
                        if (incompleteSession.id) {
                          try {
                            await fetch(`/api/student-sessions/${incompleteSession.id}`, { method: "DELETE" });
                          } catch (err) {
                            console.error("Failed to delete old session:", err);
                          }
                        }
                        setIncompleteSession(null);
                      }}
                      disabled={loading}
                      className="rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Làm mới
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!incompleteSession && (
              <button
                onClick={() => handleStart()}
                disabled={loading || !studentName.trim() || checkingIncomplete}
                className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-50 brand-gradient shadow-sm hover:opacity-90 hover:shadow-md"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Đang tải...
                  </span>
                ) : "Bắt đầu làm bài →"}
              </button>
            )}

            <Link
              href="/"
              className="block text-center text-sm text-slate-500 transition hover:text-indigo-600"
            >
              ← Quay lại trang chủ
            </Link>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          Nhớ đúng tên để xem lại kết quả bài làm nhé!
        </p>
      </div>
    </main>
  );
}
