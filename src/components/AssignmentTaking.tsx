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
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">{assignment.subject} · {assignment.grade}</p>
            <h1 className="text-2xl font-semibold text-slate-900">{assignment.title}</h1>
            {assignment.durationMinutes ? (
              <p className="text-sm text-slate-600">Thời gian làm bài: {assignment.durationMinutes} phút</p>
            ) : (
              <p className="text-sm text-slate-600">Không giới hạn thời gian</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {hasTimer ? (
              <span className={clsx("rounded-full px-4 py-2 font-semibold", timeUp ? "bg-red-100 text-red-700" : "bg-slate-900 text-white") }>
                {timeUp ? "Hết giờ" : `Còn lại: ${formatClock(remaining)}`}
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-700">
              Đã làm: {answeredCount}/{questions.length}
            </span>
            <Link href="/" className="text-slate-600 underline-offset-4 hover:text-slate-800 hover:underline">← Quay lại</Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[240px,1fr]">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-800">Tóm tắt câu hỏi</div>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const done = Boolean(answers[q.id]);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => scrollToQuestion(q.id)}
                    className={clsx(
                      "flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition",
                      done ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    )}
                    aria-label={`Chuyển đến câu ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {questions.map((q, idx) => (
              <div key={q.id} id={`q-${q.id}`} className="space-y-3 rounded-lg border border-slate-100 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Câu {idx + 1}</p>
                    {q.imageUrl && (
                      <div className="my-3 rounded-lg border border-slate-200 p-2">
                        <img src={q.imageUrl} alt="Câu hỏi" className="max-h-64 w-auto rounded" />
                      </div>
                    )}
                    {q.content && <p className="text-base font-medium text-slate-900">{q.content}</p>}
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{Number(q.points ?? 0).toFixed(3)} điểm</span>
                </div>
                {q.type === "mcq" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {[0, 1, 2, 3].map((ci) => {
                      const choice = q.choices?.[ci] || "";
                      const val = String.fromCharCode(65 + ci);
                      const checked = answers[q.id] === val;
                      return (
                        <label
                          key={ci}
                          className={clsx(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-inner transition",
                            checked ? "border-slate-500 bg-slate-50" : "border-slate-200 hover:border-slate-400"
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
                    className="min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-slate-400 focus:outline-none"
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
                "w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition",
                locked || submitting ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:-translate-y-0.5 hover:shadow"
              )}
              type="button"
              disabled={locked || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Đang nộp..." : locked ? "Đã khóa bài" : "Nộp bài"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
