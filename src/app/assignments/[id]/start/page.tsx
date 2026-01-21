"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StartAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const [assignmentId, setAssignmentId] = useState<string>("");

  useState(() => {
    params.then(p => setAssignmentId(p.id));
  });

  const handleStart = async () => {
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
      // Tạo session để tracking
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
      
      // Lưu session ID và tên học sinh vào localStorage
      localStorage.setItem(`session-${assignmentId}`, data.sessionId);
      localStorage.setItem(`student-name-${assignmentId}`, trimmedName);

      // Chuyển đến trang làm bài
      router.push(`/assignments/${assignmentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleStart();
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
            </div>

            <button
              onClick={handleStart}
              disabled={loading || !studentName.trim()}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {loading ? "Đang tải..." : "Bắt đầu làm bài"}
            </button>

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
