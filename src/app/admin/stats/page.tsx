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

  const toggleStudent = (studentName: string) => {
    setExpandedStudent(expandedStudent === studentName ? null : studentName);
    setSelectedItem(null);
    setDetailData(null);
  };

  const viewDetail = async (type: 'submission' | 'session', id: string, studentName: string, assignmentTitle: string) => {
    setSelectedItem({ type, id });
    setLoadingDetail(true);
    try {
      const endpoint = type === 'submission' 
        ? `/api/admin/submissions/${id}/detail`
        : `/api/admin/sessions/${id}/detail`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        
        // Tìm thông tin từ students list
        const student = students.find(s => s.studentName === studentName);
        let detailWithMeta: DetailData = { questions: data.questions };
        
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
              questionsAnswered: session.questionsAnswered,
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
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition"
                    onClick={() => toggleStudent(student.studentName)}
                  >
                    <div>
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
                    <button className="text-slate-400 hover:text-slate-600">
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      <div className="space-y-4">
                        {/* Bài đang làm dở */}
                        {student.inProgress.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-amber-700 mb-2">📝 Đang làm dở ({student.inProgress.length})</h4>
                            <div className="space-y-2">
                              {student.inProgress.map((session) => {
                                const date = new Date(session.startedAt).toLocaleString("vi-VN");
                                
                                return (
                                  <div
                                    key={session.sessionId}
                                    className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm cursor-pointer hover:bg-amber-100 transition"
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
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Bài đã nộp */}
                        {student.submissions.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">✅ Đã nộp ({student.submissions.length})</h4>
                            <div className="space-y-2">
                              {student.submissions.map((sub) => {
                                const date = new Date(sub.submittedAt).toLocaleString("vi-VN");
                                const duration = Math.round(sub.durationSeconds / 60);
                                
                                return (
                                  <div
                                    key={sub.id}
                                    className="rounded-lg border border-slate-200 bg-white p-3 text-sm cursor-pointer hover:bg-slate-100 transition"
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
                  {detailData.questions.map((q: QuestionDetail) => (
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

                      {q.type === 'mcq' && q.choices && (
                        <div className="grid gap-2 mt-3">
                          {q.choices.map((choice: string, idx: number) => {
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
                                <span>{choice}</span>
                                {isStudentAnswer && <span className="ml-auto text-blue-600">← Học sinh chọn</span>}
                                {isCorrectAnswer && !isStudentAnswer && <span className="ml-auto text-green-600">← Đáp án đúng</span>}
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
                  ))}
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
