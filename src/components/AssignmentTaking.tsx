"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
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

export function AssignmentTaking({ assignment, questions }: Props) {
  const hasTimer = Boolean(assignment.durationMinutes);
  const initialSeconds = hasTimer ? (assignment.durationMinutes ?? 0) * 60 : 0;
  const [remaining, setRemaining] = useState(initialSeconds);
  const [dueRemaining, setDueRemaining] = useState<number | null>(
    assignment.dueAt ? Math.max(0, Math.floor((new Date(assignment.dueAt).getTime() - Date.now()) / 1000)) : null
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const draftKey = useMemo(() => `assignment-draft-${assignment.id}`, [assignment.id]);

  useEffect(() => {
    if (!hasTimer) return;
    setRemaining(initialSeconds);
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(id);
  }, [hasTimer, initialSeconds]);

  useEffect(() => {
    if (!assignment.dueAt) return;
    const id = setInterval(() => {
      const next = Math.floor((new Date(assignment.dueAt).getTime() - Date.now()) / 1000);
      setDueRemaining(Math.max(next, 0));
    }, 1000);
    return () => clearInterval(id);
  }, [assignment.dueAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { answers: Record<string, string> };
        if (parsed?.answers) setAnswers(parsed.answers);
      }
    } catch (err) {
      console.warn("Không thể tải nháp", err);
    }
  }, [draftKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers }));
    } catch (err) {
      console.warn("Không thể lưu nháp", err);
    }
  }, [answers, draftKey]);

  const timeUp = hasTimer && remaining === 0;
  const dueExpired = dueRemaining !== null && dueRemaining <= 0;
  const locked = timeUp || dueExpired;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  const handleSubmit = async () => {
    if (submitting || locked) return;

    setSubmitting(true);
    try {
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
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
  };

  const setChoice = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const scrollToQuestion = (questionId: string) => {
    const el = document.getElementById(`q-${questionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600">{assignment.subject} · {assignment.grade}</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{assignment.title}</h1>
            {assignment.durationMinutes && (
              <p className="text-sm text-slate-600 mt-1">Thời gian làm bài: {assignment.durationMinutes} phút</p>
            )}
          </div>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline">
            ← Quay lại
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr,280px]">
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            {questions.map((q, idx) => (
              <div key={q.id} id={`q-${q.id}`} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Câu {idx + 1}</p>
                    {q.imageUrl && (
                      <div className="my-3 rounded-lg border border-slate-200 p-2 bg-white">
                        <img src={q.imageUrl} alt="Câu hỏi" className="max-h-64 w-auto rounded" />
                      </div>
                    )}
                    {q.content && <p className="text-base font-medium text-slate-900 mt-2">{q.content}</p>}
                  </div>
                  <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md">{Number(q.points ?? 0).toFixed(3)} đ</span>
                </div>
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
                ) : (
                  <textarea
                    className="min-h-[120px] w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    placeholder="Nhập câu trả lời của bạn"
                    disabled={locked}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setChoice(q.id, e.target.value)}
                  />
                )}
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
              onClick={handleSubmit}
            >
              {submitting ? "Đang nộp..." : locked ? "Đã khóa bài" : "Nộp bài"}
            </button>
          </div>

          <div className="space-y-4 sticky top-4 self-start">
            {hasTimer && (
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
