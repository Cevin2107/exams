"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    assignmentId: string;
    assignmentTitle: string;
    subject: string;
    grade: string;
    startedAt: string;
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

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/admin/stats");
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
        setLoading(false);
      }
    }
    loadStats();
  }, []);

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
              totalQuestions: data.questions.length,
              startedAt: session.startedAt,
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
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }

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
        const statsRes = await fetch("/api/admin/stats");
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStudents(data);
        }
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
      <main className="min-h-screen bg-slate-50">
        <div className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Thống kê học sinh</h1>
              <p className="text-sm text-slate-600">Xem kết quả bài làm của học sinh</p>
            </div>
            <Link
              href="/admin/dashboard"
              className="text-sm text-slate-600 hover:text-slate-800"
            >
              ← Quay lại Dashboard
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-8 text-center">
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Thống kê học sinh</h1>
            <p className="text-sm text-slate-600">Xem kết quả bài làm của học sinh</p>
          </div>
          <Link
            href="/admin/dashboard"
            className="text-sm text-slate-600 hover:text-slate-800"
          >
            ← Quay lại Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {students.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">Chưa có học sinh nào nộp bài.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((student) => {
              const avgScore = student.submissions.length
                ? (
                    student.submissions.reduce((sum, s) => sum + s.score, 0) /
                    student.submissions.length
                  ).toFixed(2)
                : "0";
              const isExpanded = expandedStudent === student.studentName;

              return (
                <div key={student.studentName} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 hover:bg-slate-50 transition"
                  >
                    <div className="flex-1 cursor-pointer" onClick={() => toggleStudent(student.studentName)}>
                      <h3 className="font-semibold text-slate-900">{student.studentName}</h3>
                      <p className="text-sm text-slate-600">
                        Đã làm {student.totalSubmissions} bài · Điểm TB: {avgScore}
                        {student.inProgressCount > 0 && (
                          <span className="ml-2 text-amber-600 font-medium">
                            · Đang làm {student.inProgressCount} bài
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAllStudentData(student.studentName);
                        }}
                        disabled={deleting}
                        className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50"
                      >
                        🗑️ Xóa tất cả
                      </button>
                      <button className="text-slate-400 hover:text-slate-600" onClick={() => toggleStudent(student.studentName)}>
                        {isExpanded ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      <div className="space-y-4">
                        {/* Bài đang làm dở */}
                        {student.inProgress.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-amber-700">📝 Đang làm dở ({student.inProgress.length})</h4>
                              {selectedSessions.size > 0 && (
                                <button
                                  onClick={() => deleteSelectedItems()}
                                  disabled={deleting}
                                  className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50"
                                >
                                  Xóa đã chọn ({selectedSessions.size})
                                </button>
                              )}
                            </div>
                            <div className="space-y-2">
                              {student.inProgress.map((session) => {
                                const date = new Date(session.startedAt).toLocaleString("vi-VN");
                                const isSelected = selectedSessions.has(session.sessionId);
                                
                                return (
                                  <div
                                    key={session.sessionId}
                                    className={`rounded-lg border p-3 text-sm transition ${
                                      isSelected 
                                        ? 'border-amber-400 bg-amber-100' 
                                        : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleSessionSelect(session.sessionId);
                                        }}
                                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                      />
                                      <div 
                                        className="flex-1 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          viewDetail('session', session.sessionId, student.studentName, session.assignmentTitle);
                                        }}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <p className="font-medium text-amber-900">{session.assignmentTitle}</p>
                                            <p className="text-xs text-amber-700">
                                              {session.subject} · {session.grade} · Bắt đầu: {date}
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-semibold text-amber-900">
                                              Đã làm: {session.questionsAnswered} câu
                                            </p>
                                            <p className="text-xs text-amber-600">Click để xem chi tiết</p>
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

                        {/* Bài đã nộp */}
                        {student.submissions.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-slate-700">✅ Đã nộp ({student.submissions.length})</h4>
                              {selectedSubmissions.size > 0 && (
                                <button
                                  onClick={() => deleteSelectedItems()}
                                  disabled={deleting}
                                  className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50"
                                >
                                  Xóa đã chọn ({selectedSubmissions.size})
                                </button>
                              )}
                            </div>
                            <div className="space-y-2">
                              {student.submissions.map((sub) => {
                                const date = new Date(sub.submittedAt).toLocaleString("vi-VN");
                                const duration = Math.round(sub.durationSeconds / 60);
                                const isSelected = selectedSubmissions.has(sub.id);
                                
                                return (
                                  <div
                                    key={sub.id}
                                    className={`rounded-lg border p-3 text-sm transition ${
                                      isSelected 
                                        ? 'border-blue-400 bg-blue-50' 
                                        : 'border-slate-200 bg-white hover:bg-slate-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleSubmissionSelect(sub.id);
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                      />
                                      <div 
                                        className="flex-1 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          viewDetail('submission', sub.id, student.studentName, sub.assignmentTitle);
                                        }}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <p className="font-medium text-slate-900">{sub.assignmentTitle}</p>
                                            <p className="text-xs text-slate-500">
                                              {sub.subject} · {sub.grade} · {date}
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-semibold text-slate-900">Điểm: {sub.score}</p>
                                            <p className="text-xs text-slate-500">Thời gian: {duration} phút · Click xem chi tiết</p>
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

      {/* Modal chi tiết */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {loadingDetail ? (
              <div className="p-8 text-center">
                <p className="text-slate-600">Đang tải...</p>
              </div>
            ) : detailData ? (
              <div>
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedItem.type === 'submission' ? '✅ Bài đã nộp' : '📝 Bài đang làm'}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {selectedItem.type === 'submission' 
                        ? `${detailData.submission?.studentName || ''} - ${detailData.submission?.assignmentTitle || ''}`
                        : `${detailData.session?.studentName || ''} - ${detailData.session?.assignmentTitle || ''}`
                      }
                    </p>
                    {selectedItem.type === 'session' && autoRefresh && (
                      <p className="text-xs text-green-600 mt-1">🔄 Đang cập nhật tự động (mỗi 3 giây)</p>
                    )}
                  </div>
                  <button
                    onClick={closeDetail}
                    className="text-slate-400 hover:text-slate-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                {/* Thông tin tổng quan */}
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  {selectedItem.type === 'submission' && detailData.submission ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-600">Điểm</p>
                        <p className="text-lg font-bold text-slate-900">{detailData.submission.score}/10</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Thời gian làm bài</p>
                        <p className="text-lg font-bold text-slate-900">
                          {Math.round(detailData.submission.durationSeconds / 60)} phút
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Nộp lúc</p>
                        <p className="text-sm font-medium text-slate-900">
                          {new Date(detailData.submission.submittedAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </div>
                  ) : detailData.session ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600">Đã làm</p>
                        <p className="text-lg font-bold text-amber-900">
                          {detailData.session.questionsAnswered}/{detailData.session.totalQuestions} câu
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Bắt đầu lúc</p>
                        <p className="text-sm font-medium text-slate-900">
                          {new Date(detailData.session.startedAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Danh sách câu hỏi */}
                <div className="p-4 space-y-4">
                  {detailData.questions.map((q: QuestionDetail) => {
                    return (
                      <div
                        key={q.questionId}
                        className={`rounded-lg border-2 p-4 ${
                          q.isCorrect === true
                            ? 'border-green-500 bg-green-50'
                            : q.isCorrect === false
                            ? 'border-red-500 bg-red-50'
                            : q.studentAnswer
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-xs font-semibold uppercase text-slate-600">
                              Câu {q.order}
                              {q.isCorrect === true && <span className="ml-2 text-green-600">✓ Đúng</span>}
                              {q.isCorrect === false && <span className="ml-2 text-red-600">✗ Sai</span>}
                              {q.isCorrect === null && q.studentAnswer && selectedItem?.type === 'session' && <span className="ml-2 text-blue-600">● Đã trả lời</span>}
                              {!q.studentAnswer && <span className="ml-2 text-slate-400">○ Chưa làm</span>}
                            </p>
                            {q.content && (
                              <p className="text-sm font-medium text-slate-900 mt-1">{q.content}</p>
                            )}
                          </div>
                          <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md">
                            {Number(q.points).toFixed(1)} đ
                          </span>
                        </div>

                        {q.imageUrl && (
                          <div className="my-2">
                            <img src={q.imageUrl} alt="Câu hỏi" className="max-h-48 rounded border" />
                          </div>
                        )}

                        {q.type === 'mcq' && (
                          <div className="grid gap-2 mt-3">
                            {/* Hiển thị các lựa chọn - nếu có choices thì dùng, không thì tạo 4 options trống */}
                            {(q.choices && q.choices.length > 0 
                              ? q.choices 
                              : ['', '', '', ''] // 4 lựa chọn trống cho câu chỉ có ảnh
                            ).map((choice: string, idx: number) => {
                              const optionLabel = String.fromCharCode(65 + idx);
                              const isStudentAnswer = q.studentAnswer === optionLabel;
                              const isCorrectAnswer = q.answerKey === optionLabel;
                              
                              return (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                    isStudentAnswer && isCorrectAnswer
                                      ? 'border-green-500 bg-green-100 font-semibold'
                                      : isStudentAnswer && !isCorrectAnswer
                                      ? 'border-red-500 bg-red-100 font-semibold'
                                      : isCorrectAnswer
                                      ? 'border-green-400 bg-green-50'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  <span className="font-bold">{optionLabel}.</span>
                                  <span className="flex-1">{choice || '(Xem đáp án trong ảnh)'}</span>
                                  {isStudentAnswer && <span className="ml-auto text-blue-600 font-semibold">← Học sinh chọn</span>}
                                  {isCorrectAnswer && !isStudentAnswer && <span className="ml-auto text-green-600 font-semibold">← Đáp án đúng</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {selectedItem.type === 'submission' && q.pointsAwarded !== undefined && (
                          <div className="mt-2 text-sm">
                            <p className="text-slate-600">
                              Điểm đạt được: <span className="font-semibold">{q.pointsAwarded.toFixed(2)}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-red-600">Không thể tải dữ liệu</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
