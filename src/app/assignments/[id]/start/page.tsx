"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StartAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [incompleteSession, setIncompleteSession] = useState<any>(null);
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
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Bắt đầu bài tập</h1>
            <p className="text-slate-600">Vui lòng nhập tên của bạn để tiếp tục</p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="studentName" className="block text-sm font-medium text-slate-700 mb-2">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                id="studentName"
                type="text"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20 text-slate-900"
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
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
              {checkingIncomplete && (
                <p className="mt-2 text-sm text-slate-500">Đang kiểm tra...</p>
              )}
              {incompleteSession && !checkingIncomplete && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-900 mb-2">
                    ⚠️ Bạn có bài làm chưa hoàn thành
                  </p>
                  <p className="text-xs text-amber-700 mb-1">
                    Học sinh: <span className="font-semibold">{incompleteSession.student_name}</span>
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    Bắt đầu lúc: {new Date(incompleteSession.started_at).toLocaleString("vi-VN")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStart(incompleteSession.id)}
                      disabled={loading}
                      className="flex-1 bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition disabled:bg-slate-300"
                    >
                      Tiếp tục làm
                    </button>
                    <button
                      onClick={async () => {
                        console.log("Starting new assignment, clearing incomplete session");
                        // Xóa session cũ
                        if (incompleteSession.id) {
                          try {
                            await fetch(`/api/student-sessions/${incompleteSession.id}`, { 
                              method: "DELETE" 
                            });
                            console.log("Old session deleted");
                          } catch (err) {
                            console.error("Failed to delete old session:", err);
                          }
                        }
                        setIncompleteSession(null);
                      }}
                      disabled={loading}
                      className="flex-1 bg-white text-slate-700 px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 hover:bg-slate-50 transition disabled:bg-slate-100"
                    >
                      Làm bài mới
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!incompleteSession && (
              <button
                onClick={() => handleStart()}
                disabled={loading || !studentName.trim() || checkingIncomplete}
                className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {loading ? "Đang tải..." : "Bắt đầu làm bài"}
              </button>
            )}

            <Link 
              href="/"
              className="block text-center text-sm text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline"
            >
              ← Quay lại trang chủ
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>💡 Mẹo: Nhớ tên của bạn để xem kết quả sau này</p>
        </div>
      </div>
    </main>
  );
}
