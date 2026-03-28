"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { countActualQuestions } from "@/lib/utils";
import { StudentWorkReviewPanel } from "@/features/admin/components/StudentWorkReviewPanel";
import { 
  GraduationCap, 
  Trophy,
  Clock, 
  CheckCircle2, 
  XCircle, 
  X as CloseIcon,
  FileText, 
  Trash2,
  RefreshCw,
  BarChart3
} from "lucide-react";

interface StudentStats {
  studentName: string;
  totalSubmissions: number;
  inProgressCount: number;
  submissions: Array<{
    id: string;
    assignmentTitle: string;
    subject: string;
    grade: string;
    score: number;
    submittedAt: string;
    durationSeconds: number;
  }>;
  inProgress: Array<{
    sessionId: string;
    status: "active" | "exited";
    assignmentId: string;
    assignmentTitle: string;
    subject: string;
    grade: string;
    startedAt: string;
    lastActivityAt?: string;
    questionsAnswered: number;
    draftAnswers: Record<string, string>;
  }>;
}

interface QuestionDetail {
  questionId: string;
  order: number;
  type: string;
  content: string;
  choices?: string[];
  answerKey?: string;
  points: number;
  imageUrl?: string;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  isAnswered?: boolean;
  pointsAwarded?: number;
}

interface DetailData {
  questions: QuestionDetail[];
  submission?: {
    studentName: string;
    assignmentTitle: string;
    score: number;
    durationSeconds: number;
    submittedAt: string;
  };
  session?: {
    studentName: string;
    assignmentTitle: string;
    questionsAnswered: number;
    totalQuestions: number;
    startedAt: string;
    status?: "active" | "exited";
    lastActivityAt?: string;
  };
}

export default function AdminStatsPage() {
  const [students, setStudents] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ type: 'submission' | 'session', id: string } | null>(null);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const loadStats = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/admin";
          return;
        }
        throw new Error("Failed to fetch stats");
      }
      const data = await res.json();
      setStudents(data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadStats(false);
  }, [loadStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadStats(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [loadStats]);

  // Auto-refresh khi xem chi tiết session đang làm
  useEffect(() => {
    if (!selectedItem || selectedItem.type !== 'session' || !autoRefresh) return;

    const interval = setInterval(async () => {
      // Reload chi tiết session
      try {
        const res = await fetch(`/api/admin/sessions/${selectedItem.id}/detail`);
        if (res.ok) {
          const data = await res.json();
          
          // Tìm thông tin từ students list
          const student = students.find(s => 
            s.inProgress.some(session => session.sessionId === selectedItem.id)
          );
          
          if (student) {
            const session = student.inProgress.find(s => s.sessionId === selectedItem.id);
            if (session) {
              setDetailData({
                questions: data.questions,
                session: {
                  studentName: student.studentName,
                  assignmentTitle: session.assignmentTitle,
                  questionsAnswered: Object.keys(data.draft_answers || {}).length,
                  totalQuestions: data.questions.length,
                  startedAt: session.startedAt,
                  status: session.status,
                  lastActivityAt: session.lastActivityAt,
                },
              });
            }
          }
        }
      } catch (err) {
        console.error("Error refreshing detail:", err);
      }
    }, 3000); // Refresh mỗi 3 giây

    return () => clearInterval(interval);
  }, [selectedItem, autoRefresh, students]);

  const toggleStudent = (studentName: string) => {
    setExpandedStudent(expandedStudent === studentName ? null : studentName);
    setSelectedItem(null);
    setDetailData(null);
  };

  const viewDetail = async (
    type: 'submission' | 'session',
    id: string,
    studentName: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _assignmentTitle: string
  ) => {
    setSelectedItem({ type, id });
    setLoadingDetail(true);
    setAutoRefresh(type === 'session'); // Bật auto-refresh cho session
    try {
      const endpoint = type === 'submission' 
        ? `/api/admin/submissions/${id}/detail`
        : `/api/admin/sessions/${id}/detail`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        
        // Tìm thông tin từ students list
        const student = students.find(s => s.studentName === studentName);
        const detailWithMeta: DetailData = { questions: data.questions };
        
        if (type === 'submission') {
          const submission = student?.submissions.find(s => s.id === id);
          if (submission) {
            detailWithMeta.submission = {
              studentName: studentName,
              assignmentTitle: submission.assignmentTitle,
              score: submission.score,
              durationSeconds: submission.durationSeconds,
              submittedAt: submission.submittedAt,
            };
          }
        } else {
          const session = student?.inProgress.find(s => s.sessionId === id);
          if (session) {
            detailWithMeta.session = {
              studentName: studentName,
              assignmentTitle: session.assignmentTitle,
              questionsAnswered: Object.keys(data.draft_answers || {}).length,
              totalQuestions: countActualQuestions(data.questions),
              startedAt: session.startedAt,
              status: session.status,
              lastActivityAt: session.lastActivityAt,
            };
          }
        }
        
        setDetailData(detailWithMeta);
      }
    } catch (err) {
      console.error("Error loading detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedItem(null);
    setDetailData(null);
    setAutoRefresh(false);
  };

  const toggleSubmissionSelect = (id: string) => {
    const newSet = new Set(selectedSubmissions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedSubmissions(newSet);
  };

  const toggleSessionSelect = (id: string) => {
    const newSet = new Set(selectedSessions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedSessions(newSet);
  };

  const deleteSelectedItems = async () => {
    if (selectedSubmissions.size === 0 && selectedSessions.size === 0) {
      alert("Vui lòng chọn ít nhất một bài để xóa");
      return;
    }

    if (!confirm(`Bạn có chắc muốn xóa ${selectedSubmissions.size} bài đã nộp và ${selectedSessions.size} bài đang làm?`)) {
      return;
    }

    setDeleting(true);
    try {
      // Xóa submissions
      for (const id of selectedSubmissions) {
        await fetch(`/api/admin/submissions/${id}`, { method: "DELETE" });
      }

      // Xóa sessions
      for (const id of selectedSessions) {
        await fetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
      }

      // Reload stats
      await loadStats(true);

      setSelectedSubmissions(new Set());
      setSelectedSessions(new Set());
      alert("Xóa thành công!");
    } catch (error) {
      console.error("Error deleting items:", error);
      alert("Có lỗi xảy ra khi xóa");
    } finally {
      setDeleting(false);
    }
  };

  const deleteAllStudentData = async (studentName: string) => {
    if (!confirm(`⚠️ BẠN CÓ CHẮC CHẮN muốn xóa TẤT CẢ dữ liệu của học sinh "${studentName}"?\n\nĐiều này sẽ xóa:\n- Tất cả bài đã nộp\n- Tất cả bài đang làm dở\n- Không thể khôi phục!\n\nNhấn OK để xóa.`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/stats/${encodeURIComponent(studentName)}`, { 
        method: "DELETE" 
      });

      if (res.ok) {
        // Reload stats
        await loadStats(true);
        alert("Đã xóa tất cả dữ liệu của học sinh!");
        setExpandedStudent(null);
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting student data:", error);
      alert("Có lỗi xảy ra khi xóa");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 relative overflow-hidden">
        {/* Background decoration */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 right-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-blue-200/40 via-indigo-200/30 to-violet-200/20 blur-[140px] animate-pulse-slow" />
          <div className="absolute -bottom-40 left-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-tl from-violet-200/40 via-purple-200/30 to-fuchsia-200/20 blur-[140px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative">
          {/* Header */}
          <div className="mb-8 px-4 py-6">
            <div className="mx-auto max-w-6xl">
              <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl blur opacity-30" />
                      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                        <GraduationCap className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                        Quản lý học sinh
                      </h1>
                      <p className="text-sm text-slate-600">Xem kết quả bài làm của học sinh</p>
                    </div>
                  </div>
                  <Link
                    href="/admin/dashboard"
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 hover:border-indigo-200 hover:bg-white/80 transition-all"
                  >
                    ← Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-6xl px-4 py-8 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-lg">
              <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-600 font-medium">Đang tải dữ liệu...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 relative overflow-hidden">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-blue-200/40 via-indigo-200/30 to-violet-200/20 blur-[140px] animate-pulse-slow" />
        <div className="absolute -bottom-40 left-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-tl from-violet-200/40 via-purple-200/30 to-fuchsia-200/20 blur-[140px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="mb-8 px-4 py-6">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-slate-200/50 p-6 hover:shadow-2xl hover:shadow-indigo-200/30 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                      <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                      Quản lý học sinh
                    </h1>
                    <p className="text-sm text-slate-600">Xem kết quả bài làm của học sinh</p>
                  </div>
                </div>
                <Link
                  href="/admin/dashboard"
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 hover:border-indigo-200 hover:bg-white/80 transition-all"
                >
                  ← Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-6 px-4 pb-8">
          {students.length === 0 ? (
            <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-slate-200/50 p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 mb-4">
                <BarChart3 className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">Chưa có học sinh nào nộp bài.</p>
              <p className="text-sm text-slate-500 mt-1">Danh sách sẽ hiển thị khi có học sinh làm bài</p>
            </div>
          ) : (
            <div className="space-y-4">
              {students.map((student) => {
                const avgScore = student.submissions.length
                  ? (
                      student.submissions.reduce((sum, s) => sum + s.score, 0) /
                      student.submissions.length
                    ).toFixed(1)
                  : "0";
                const isExpanded = expandedStudent === student.studentName;

                return (
                  <div 
                    key={student.studentName} 
                    className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-slate-200/50 overflow-hidden hover:shadow-2xl hover:shadow-indigo-200/30 transition-all duration-300"
                  >
                    {/* Student Card Header */}
                    <div className="flex items-center justify-between p-5 cursor-pointer group" onClick={() => toggleStudent(student.studentName)}>
                      <div className="flex items-center gap-4 flex-1">
                        {/* Avatar */}
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-2xl blur opacity-40 group-hover:opacity-60 transition-opacity" />
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
                            <span className="text-xl font-bold text-white">
                              {student.studentName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Student Info */}
                        <div className="flex-1">
                          <h3 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            {student.studentName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100/80 backdrop-blur-sm text-xs font-semibold text-emerald-700 border border-emerald-200/50">
                              <Trophy className="h-3.5 w-3.5" />
                              {student.totalSubmissions} bài
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-100/80 backdrop-blur-sm text-xs font-semibold text-blue-700 border border-blue-200/50">
                              <BarChart3 className="h-3.5 w-3.5" />
                              ĐTB: {avgScore}
                            </span>
                            {student.inProgressCount > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 backdrop-blur-sm text-xs font-semibold text-amber-700 border border-amber-200/50 animate-pulse">
                                <Clock className="h-3.5 w-3.5" />
                                {student.inProgressCount} đang làm
                              </span>
                            )}
                            {student.inProgressCount === 0 && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 backdrop-blur-sm text-xs font-semibold text-emerald-700 border border-emerald-200/50">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Đã nộp / đã thoát
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAllStudentData(student.studentName);
                          }}
                          disabled={deleting}
                          className="px-3 py-2 text-xs font-semibold text-red-600 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl hover:bg-red-100 hover:shadow-md hover:shadow-red-200/50 disabled:opacity-50 transition-all flex items-center gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa tất cả
                        </button>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100/80 backdrop-blur-sm text-slate-600 group-hover:bg-gradient-to-br group-hover:from-indigo-100 group-hover:to-violet-100 group-hover:text-indigo-600 transition-all ${isExpanded ? 'rotate-180' : ''}`}>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-white/60 bg-gradient-to-br from-slate-50/50 to-blue-50/30 backdrop-blur-sm p-5">
                        <div className="space-y-5">
                          {/* In Progress Sessions */}
                          {student.inProgress.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-amber-700 flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100/80 backdrop-blur-sm">
                                    <Clock className="h-4 w-4" />
                                  </div>
                                  Đang làm dở ({student.inProgress.length})
                                </h4>
                                {selectedSessions.size > 0 && (
                                  <button
                                    onClick={() => deleteSelectedItems()}
                                    disabled={deleting}
                                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl hover:bg-red-100 hover:shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Xóa ({selectedSessions.size})
                                  </button>
                                )}
                              </div>
                              <div className="space-y-3">
                                {student.inProgress.map((session) => {
                                  const date = new Date(session.startedAt).toLocaleString("vi-VN");
                                  const isSelected = selectedSessions.has(session.sessionId);
                                  const isActive = session.status === "active";
                                  
                                  return (
                                    <div
                                      key={session.sessionId}
                                      className={`rounded-2xl border p-4 text-sm transition-all duration-300 group cursor-pointer ${
                                        isSelected 
                                          ? 'border-amber-400/80 bg-amber-50/80 shadow-lg shadow-amber-200/50' 
                                          : 'border-amber-200/50 bg-white/60 hover:bg-white/80 hover:shadow-lg hover:shadow-amber-200/30'
                                      } backdrop-blur-sm`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        viewDetail('session', session.sessionId, student.studentName, session.assignmentTitle);
                                      }}
                                    >
                                      <div className="flex items-start gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            toggleSessionSelect(session.sessionId);
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-1 w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                                        />
                                        <div className="flex-1">
                                          <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                              <p className="font-bold text-amber-900 mb-1 group-hover:text-amber-700 transition-colors">{session.assignmentTitle}</p>
                                              <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700/80">
                                                <span className="px-2.5 py-1 rounded-full bg-amber-100/60 backdrop-blur-sm">{session.subject}</span>
                                                <span className="px-2.5 py-1 rounded-full bg-amber-100/60 backdrop-blur-sm">{session.grade}</span>
                                                <span
                                                  className={`px-2.5 py-1 rounded-full font-semibold ${
                                                    isActive
                                                      ? "bg-amber-200/80 text-amber-800"
                                                      : "bg-rose-100/90 text-rose-700"
                                                  }`}
                                                >
                                                  {isActive ? "Đang làm" : "Đã thoát"}
                                                </span>
                                                <span className="text-amber-600">• {date}</span>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100/80 backdrop-blur-sm border border-amber-200/50">
                                                <FileText className="h-4 w-4 text-amber-700" />
                                                <span className="font-bold text-amber-900">{session.questionsAnswered} câu</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Completed Submissions */}
                          {student.submissions.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100/80 backdrop-blur-sm">
                                    <CheckCircle2 className="h-4 w-4" />
                                  </div>
                                  Đã nộp ({student.submissions.length})
                                </h4>
                                {selectedSubmissions.size > 0 && (
                                  <button
                                    onClick={() => deleteSelectedItems()}
                                    disabled={deleting}
                                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl hover:bg-red-100 hover:shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Xóa ({selectedSubmissions.size})
                                  </button>
                                )}
                              </div>
                              <div className="space-y-3">
                                {student.submissions.map((sub) => {
                                  const date = new Date(sub.submittedAt).toLocaleString("vi-VN");
                                  const duration = Math.round(sub.durationSeconds / 60);
                                  const isSelected = selectedSubmissions.has(sub.id);
                                  
                                  // Score color based on value
                                  let scoreColorClass = "from-slate-500 to-slate-600";
                                  if (sub.score >= 8) scoreColorClass = "from-emerald-500 to-teal-600";
                                  else if (sub.score >= 6) scoreColorClass = "from-blue-500 to-cyan-600";
                                  else if (sub.score >= 4) scoreColorClass = "from-amber-500 to-orange-600";
                                  else scoreColorClass = "from-rose-500 to-red-600";
                                  
                                  return (
                                    <div
                                      key={sub.id}
                                      className={`rounded-2xl border p-4 text-sm transition-all duration-300 group cursor-pointer ${
                                        isSelected 
                                          ? 'border-indigo-400/80 bg-indigo-50/80 shadow-lg shadow-indigo-200/50' 
                                          : 'border-slate-200/50 bg-white/60 hover:bg-white/80 hover:shadow-lg hover:shadow-indigo-200/30'
                                      } backdrop-blur-sm`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        viewDetail('submission', sub.id, student.studentName, sub.assignmentTitle);
                                      }}
                                    >
                                      <div className="flex items-start gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            toggleSubmissionSelect(sub.id);
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <div className="flex-1">
                                          <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                              <p className="font-bold text-slate-900 mb-1 group-hover:text-indigo-700 transition-colors">{sub.assignmentTitle}</p>
                                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                                <span className="px-2 py-0.5 rounded-lg bg-slate-100/60 backdrop-blur-sm">{sub.subject}</span>
                                                <span className="px-2 py-0.5 rounded-lg bg-slate-100/60 backdrop-blur-sm">{sub.grade}</span>
                                                <span className="inline-flex items-center gap-1">
                                                  <Clock className="h-3 w-3" />
                                                  {duration} phút
                                                </span>
                                                <span className="text-slate-500">• {date}</span>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r shadow-md backdrop-blur-sm border border-white/50">
                                                <div className={`inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br ${scoreColorClass}`}>
                                                  <Trophy className="h-3.5 w-3.5 text-white" />
                                                </div>
                                                <span className={`font-bold text-lg bg-gradient-to-r ${scoreColorClass} bg-clip-text text-transparent`}>
                                                  {sub.score}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal - Glassmorphic */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-50/95 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-slate-300/40 border border-slate-200/80 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            {loadingDetail ? (
              <div className="p-12 text-center flex-1 flex items-center justify-center">
                <div className="space-y-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100">
                    <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="text-slate-600 font-medium">Đang tải chi tiết...</p>
                </div>
              </div>
            ) : detailData ? (
              <>
                {/* Sticky Header */}
                <div className="sticky top-0 bg-slate-50/95 backdrop-blur-xl border-b border-slate-200/80 p-6 flex items-center justify-between z-10">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl blur opacity-30" />
                      <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg ${
                        selectedItem.type === 'submission' 
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30' 
                          : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30'
                      }`}>
                        {selectedItem.type === 'submission' ? (
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        ) : (
                          <Clock className="h-6 w-6 text-white" />
                        )}
                      </div>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                        {selectedItem.type === 'submission' ? 'Bài đã nộp' : 'Bài đang làm'}
                      </h2>
                      <p className="text-sm text-slate-600 font-medium">
                        {selectedItem.type === 'submission' 
                          ? `${detailData.submission?.studentName || ''} - ${detailData.submission?.assignmentTitle || ''}`
                          : `${detailData.session?.studentName || ''} - ${detailData.session?.assignmentTitle || ''}`
                        }
                      </p>
                      {selectedItem.type === 'session' && autoRefresh && (
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse block" />
                          Cập nhật tự động (3s)
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={closeDetail}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100/80 backdrop-blur-sm text-slate-600 hover:bg-red-100 hover:text-red-600 hover:shadow-md transition-all"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-50 to-indigo-50/30">
                  <StudentWorkReviewPanel
                    questions={detailData.questions}
                    isSubmitted={selectedItem.type === 'submission'}
                    startedAt={selectedItem.type === 'submission' ? detailData.submission?.submittedAt || new Date().toISOString() : detailData.session?.startedAt || new Date().toISOString()}
                    isPaused={selectedItem.type === 'session' && detailData.session?.status === 'exited'}
                    pausedAt={selectedItem.type === 'session' ? detailData.session?.lastActivityAt : undefined}
                    submissionId={selectedItem.type === 'submission' ? selectedItem.id : undefined}
                    submissionScore={detailData.submission?.score}
                    submissionDurationSeconds={detailData.submission?.durationSeconds}
                    answeredCountOverride={selectedItem.type === 'session' ? detailData.session?.questionsAnswered : undefined}
                    onRefresh={async () => {
                      if (!selectedItem) return;

                      const detailRes = await fetch(`/api/admin/submissions/${selectedItem.id}/detail`);
                      if (detailRes.ok) {
                        const data = await detailRes.json();
                        setDetailData((prev) => {
                          if (!prev?.submission) return prev;
                          return {
                            questions: data.questions,
                            submission: prev.submission,
                          };
                        });
                      }

                      await loadStats(true);
                    }}
                    notify={(message, type) => {
                      if (type === "error") {
                        alert(message);
                        return;
                      }
                      alert(message);
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="p-12 text-center flex-1 flex items-center justify-center">
                <div className="space-y-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 to-rose-100">
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <p className="text-red-600 font-semibold">Không thể tải dữ liệu</p>
                  <p className="text-sm text-slate-600">Vui lòng thử lại sau</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
