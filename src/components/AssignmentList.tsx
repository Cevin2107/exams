"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Assignment } from "@/lib/types";
import { isBefore } from "date-fns";
import clsx from "clsx";
import Link from "next/link";

interface AssignmentListProps {
  assignments: Assignment[];
}

export function AssignmentList({ assignments }: AssignmentListProps) {
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("Tất cả");
  const [statusFilter, setStatusFilter] = useState("Tất cả");
  const [now, setNow] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatRemaining = (dueAt?: string | null) => {
    if (!dueAt) return "Không đặt hạn";
    if (now === null) return "Đang tính...";
    const target = new Date(dueAt).getTime();
    if (Number.isNaN(target)) return "Không đặt hạn";
    const diff = target - now;
    if (diff <= 0) return "Đã hết hạn";
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (days) parts.push(`${days} ngày`);
    if (hours) parts.push(`${hours} giờ`);
    if (minutes) parts.push(`${minutes} phút`);
    if (seconds) parts.push(`${seconds} giây`);
    return parts.length ? parts.join(" ") : "Đã hết hạn";
  };

  const getDerivedStatus = useCallback((assignment: Assignment) => {
    if (now !== null && assignment.dueAt && isBefore(new Date(assignment.dueAt), new Date(now))) return "overdue" as const;
    return assignment.latestSubmission ? "completed" : "not_started";
  }, [now]);

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      const derivedStatus = getDerivedStatus(a);
      const matchSearch = a.title.toLowerCase().includes(search.toLowerCase());
      const matchSubject = subjectFilter === "Tất cả" || a.subject === subjectFilter;
      const matchStatus = statusFilter === "Tất cả" || derivedStatus === statusFilter;
      return matchSearch && matchSubject && matchStatus;
    });
  }, [assignments, getDerivedStatus, search, subjectFilter, statusFilter]);

  const subjects = Array.from(new Set(assignments.map((a) => a.subject)));

  const renderStatus = (assignment: Assignment) => {
    const status = getDerivedStatus(assignment);
    const tone = status === "overdue"
      ? "bg-red-100 text-red-700"
      : status === "completed"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-slate-100 text-slate-700";
    const display = status === "overdue" ? "Quá hạn" : status === "completed" ? "Đã làm" : "Chưa làm";
    return <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", tone)}>{display}</span>;
  };

  return (
    <div className="space-y-4" suppressHydrationWarning>
      {!mounted && (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3" suppressHydrationWarning>
          <div className="h-10 rounded-lg bg-slate-100" />
          <div className="h-10 rounded-lg bg-slate-100" />
          <div className="h-10 rounded-lg bg-slate-100" />
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3" suppressHydrationWarning>
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-slate-400 focus:outline-none"
          placeholder="Tìm kiếm theo tên bài"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option>Tất cả</option>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>Tất cả</option>
          <option value="not_started">Chưa làm</option>
          <option value="completed">Đã làm</option>
          <option value="overdue">Quá hạn</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2" suppressHydrationWarning>
        {filtered.map((assignment) => {
          const overdue = now !== null && assignment.dueAt ? isBefore(new Date(assignment.dueAt), new Date(now)) : false;
          const latest = assignment.latestSubmission;
          const dueText = formatRemaining(assignment.dueAt);
          return (
            <div
              key={assignment.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              suppressHydrationWarning
            >
              <div className="flex items-start justify-between gap-2" suppressHydrationWarning>
                <div suppressHydrationWarning>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{assignment.subject} · {assignment.grade}</p>
                  <h2 className="text-lg font-semibold text-slate-900">{assignment.title}</h2>
                </div>
                {renderStatus(assignment)}
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600" suppressHydrationWarning>
                <span>Hạn nộp: {dueText}</span>
                {assignment.durationMinutes ? <span>Thời gian: {assignment.durationMinutes} phút</span> : null}
              </div>
              <div className="flex items-center justify-between" suppressHydrationWarning>
                <span className={clsx("text-sm font-medium", overdue ? "text-red-600" : "text-slate-700")}>Tổng điểm: {assignment.totalScore}</span>
                <div className="flex gap-2">
                  {latest ? (
                    <>
                      <Link
                        href={`/assignments/${assignment.id}/result?sid=${latest.id}`}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                      >
                        Lịch sử
                      </Link>
                      <Link
                        href={`/assignments/${assignment.id}`}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                      >
                        Làm lại
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={overdue ? "#" : `/assignments/${assignment.id}`}
                      aria-disabled={overdue}
                      className={clsx(
                        "rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition",
                        overdue
                          ? "cursor-not-allowed bg-slate-200 text-slate-500"
                          : "bg-slate-900 text-white hover:-translate-y-0.5 hover:shadow"
                      )}
                    >
                      {overdue ? "Quá hạn" : "Làm bài"}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Không có bài tập phù hợp.
          </div>
        )}
      </div>
    </div>
  );
}
