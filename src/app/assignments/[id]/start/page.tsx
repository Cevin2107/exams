"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Copy, CheckCircle2, Clock, Award, Calendar, Share2 } from "lucide-react";

export default function StartAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [incompleteSession, setIncompleteSession] = useState<{ id: string; student_name: string; started_at: string } | null>(null);
  const [checkingIncomplete, setCheckingIncomplete] = useState(false);
  const [assignmentData, setAssignmentData] = useState<any>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const router = useRouter();
  const [assignmentId, setAssignmentId] = useState<string>("");
  const { addToast } = useToast();

  useEffect(() => {
    params.then(p => setAssignmentId(p.id));
  }, [params]);

  // Fetch assignment data
  useEffect(() => {
    if (!assignmentId) return;
    const fetchAssignment = async () => {
      setLoadingAssignment(true);
      try {
        const res = await fetch(`/api/assignments/${assignmentId}`);
        if (res.ok) {
          const data = await res.json();
          setAssignmentData(data);
        }
      } catch (error) {
        console.error("Error fetching assignment:", error);
      } finally {
        setLoadingAssignment(false);
      }
    };
    fetchAssignment();
  }, [assignmentId]);

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
          setIncompleteSession(data.hasIncomplete && data.session ? data.session : null);
        } else {
          setIncompleteSession(null);
        }
      } catch {
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
    if (!trimmedName) { setError("Vui lòng nhập tên của bạn"); return; }
    if (trimmedName.length < 2) { setError("Tên phải có ít nhất 2 ký tự"); return; }

    setLoading(true);
    setError("");
    try {
      let sessionId = resumeSessionId;
      if (!sessionId) {
        const res = await fetch("/api/student-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId, studentName: trimmedName, status: "active" }),
        });
        if (!res.ok) throw new Error("Không thể bắt đầu bài tập");
        const data = await res.json();
        sessionId = data.sessionId;
      } else {
        const res = await fetch("/api/student-sessions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, status: "active" }),
        });
        if (!res.ok) throw new Error("Không thể tiếp tục bài tập");
      }
      if (!sessionId) throw new Error("Không thể lấy session ID");
      localStorage.setItem(`session-${assignmentId}`, sessionId);
      localStorage.setItem(`student-name-${assignmentId}`, trimmedName);
      router.push(`/assignments/${assignmentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      addToast({
        title: "Đã sao chép!",
        description: "Link bài tập đã được sao chép vào clipboard",
        variant: "success",
        duration: 3000,
      });
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      addToast({
        title: "Lỗi",
        description: "Không thể sao chép link",
        variant: "error",
        duration: 3000,
      });
    });
  };

  const formatDueDate = (dueAt?: string | null) => {
    if (!dueAt) return null;
    const date = new Date(dueAt);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 flex flex-col items-center justify-center px-3 py-8 sm:px-4 sm:py-12 relative overflow-hidden">
      {/* Simplified Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-blue-200/30 via-indigo-200/20 to-violet-200/15 blur-[100px]" />
        <div className="absolute -bottom-40 left-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-tl from-violet-200/30 via-purple-200/20 to-fuchsia-200/15 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-2xl animate-fade-in">
        {/* Compact Hero Section */}
        <div className="mb-6 flex flex-col items-center text-center animate-slide-up">
          {/* Compact Badge */}
          <div className="mb-4 inline-flex px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-lg border border-white/80 shadow-md">
            <span className="text-xs sm:text-sm font-medium bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Hệ thống bài tập trực tuyến
            </span>
          </div>

          {/* Compact Logo */}
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          {/* Responsive Title */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent mb-2">
            Gia sư Đào Bá Anh Quân
          </h1>

          <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">Sẵn sàng làm bài?</h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-sm">Nhập tên và bắt đầu làm bài</p>
        </div>

        {/* Assignment Info Card */}
        {loadingAssignment ? (
          <div className="mb-4 rounded-2xl bg-white/70 backdrop-blur-lg border border-white/80 shadow-lg p-4">
            <div className="space-y-2">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
              <div className="flex gap-2">
                <div className="skeleton h-8 w-20" />
                <div className="skeleton h-8 w-20" />
              </div>
            </div>
          </div>
        ) : assignmentData ? (
          <div className="mb-4 rounded-2xl bg-white/70 backdrop-blur-lg border border-white/80 shadow-lg p-4 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate mb-1.5">
                  {assignmentData.title}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="info" size="sm" className="text-xs">
                    {assignmentData.subject}
                  </Badge>
                  <Badge variant="secondary" size="sm" className="text-xs">
                    {assignmentData.grade}
                  </Badge>
                </div>
              </div>
              <button
                onClick={handleCopyLink}
                className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 hover:bg-white transition text-sm"
                title="Chia sẻ link"
              >
                {copySuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Share2 className="h-4 w-4 text-slate-600" />
                )}
              </button>
            </div>
            
            {/* Compact Assignment Meta Info */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {assignmentData.dueAt && (
                <div className="flex items-center gap-1.5 bg-slate-50/80 rounded-lg p-2.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-slate-500">Hạn nộp</div>
                    <div className="font-semibold text-slate-700 truncate">{formatDueDate(assignmentData.dueAt)}</div>
                  </div>
                </div>
              )}
              {assignmentData.durationMinutes && (
                <div className="flex items-center gap-1.5 bg-slate-50/80 rounded-lg p-2.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-slate-500">Thời gian</div>
                    <div className="font-semibold text-slate-700">{assignmentData.durationMinutes}p</div>
                  </div>
                </div>
              )}
              {assignmentData.totalScore && (
                <div className="flex items-center gap-1.5 bg-slate-50/80 rounded-lg p-2.5">
                  <Award className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-slate-500">Điểm</div>
                    <div className="font-semibold text-slate-700">{assignmentData.totalScore}đ</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Input Card */}
        <div className="rounded-2xl bg-white/80 backdrop-blur-lg border border-white/80 shadow-xl p-4 sm:p-6 hover:shadow-2xl transition-shadow">
          <div className="space-y-4">
            <div>
              <label htmlFor="studentName" className="mb-2 block text-sm font-bold text-slate-900">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                id="studentName"
                type="text"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"
                placeholder="Ví dụ: Nguyễn Văn An"
                value={studentName}
                onChange={(e) => { setStudentName(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !loading && !checkingIncomplete && !incompleteSession) handleStart(); }}
                disabled={loading}
                autoFocus
                aria-label="Họ và tên"
                aria-required="true"
              />
              {error && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg p-2">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}
              {checkingIncomplete && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Đang kiểm tra...
                </div>
              )}
              {incompleteSession && !checkingIncomplete && (
                <div className="mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-3.5 shadow-md">
                  <div className="flex items-start gap-2.5 mb-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 shrink-0">
                      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-900">Bài làm còn dang dở</p>
                      <p className="text-xs text-amber-700 mt-0.5">{new Date(incompleteSession.started_at).toLocaleString("vi-VN")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStart(incompleteSession.id)}
                      disabled={loading}
                      className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 px-3 py-2 text-xs font-bold text-white transition"
                    >
                      Tiếp tục
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await fetch(`/api/student-sessions/${incompleteSession.id}`, { method: "DELETE" });
                        } catch {}
                        setIncompleteSession(null);
                      }}
                      disabled={loading}
                      className="flex-1 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 disabled:opacity-50 px-3 py-2 text-xs font-bold text-amber-700 transition"
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
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 px-4 py-2.5 text-sm font-bold text-white transition shadow-lg"
              >
                {loading ? "Đang tải..." : "Bắt đầu →"}
              </button>
            )}

            <Link
              href="/"
              className="block text-center text-xs text-slate-500 hover:text-indigo-600 transition font-medium"
            >
              ← Quay lại
            </Link>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <div className="inline-flex px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-lg border border-white/80 shadow-md">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Bảo mật
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
