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

  const formatDueDate = (dueAt?: string | null) => {
    if (!dueAt) return null;
    const date = new Date(dueAt);
    if (isNaN(date.getTime())) return null;
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  };

  const getDerivedStatus = useCallback((assignment: Assignment) => {
    if (now !== null && assignment.dueAt && isBefore(new Date(assignment.dueAt), new Date(now))) return "overdue" as const;
    return assignment.latestSubmission ? "completed" : "not_started";
  }, [now]);

  const isUrgent = useCallback((assignment: Assignment) => {
    if (!assignment.dueAt || now === null) return false;
    const diff = new Date(assignment.dueAt).getTime() - now;
    return diff > 0 && diff < 24 * 60 * 60 * 1000; // < 1 ngày
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
    const urgent = isUrgent(assignment);
    
    return (
      <div className="flex flex-wrap gap-2">
        {urgent && (
          <span className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
            GẤP!
          </span>
        )}
        <span className={clsx(
          "rounded-md px-2.5 py-1 text-xs font-semibold",
          status === "overdue"
            ? "bg-red-100 text-red-700"
            : status === "completed"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-700"
        )}>
          {status === "overdue" ? "Quá hạn" : status === "completed" ? "Đã làm" : "Chưa làm"}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4" suppressHydrationWarning>
      {!mounted && (
        <div className="grid gap-3 rounded-lg bg-white border border-slate-200 p-4 md:grid-cols-3" suppressHydrationWarning>
          <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
        </div>
      )}

      <div className="grid gap-3 rounded-lg bg-white border border-slate-200 p-4 md:grid-cols-3" suppressHydrationWarning>
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          placeholder="Tìm kiếm bài tập"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option>Tất cả</option>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
          const urgent = isUrgent(assignment);
          const latest = assignment.latestSubmission;
          const dueText = formatRemaining(assignment.dueAt);
          const dueDateTime = formatDueDate(assignment.dueAt);
          return (
            <div
              key={assignment.id}
              className={clsx(
                "flex flex-col gap-3 rounded-lg border bg-white p-4 transition hover:shadow-md",
                urgent ? "border-red-300" : "border-slate-200"
              )}
              suppressHydrationWarning
            >
              <div className="flex items-start justify-between gap-2" suppressHydrationWarning>
                <div suppressHydrationWarning>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{assignment.subject} · {assignment.grade}</p>
                  <h2 className="text-base font-semibold text-slate-900 mt-1">{assignment.title}</h2>
                </div>
                {renderStatus(assignment)}
              </div>
              <div className="space-y-1 text-sm" suppressHydrationWarning>
                {dueDateTime && (
                  <div className="text-slate-600">
                    <span className="font-medium">Hạn nộp:</span> {dueDateTime}
                  </div>
                )}
                <div className={clsx(urgent && "font-semibold text-red-700", !urgent && "text-slate-600")}>
                  <span className="font-medium">Thời gian còn lại:</span> {dueText}
                </div>
                {assignment.durationMinutes && (
                  <div className="text-slate-600">
                    <span className="font-medium">Thời gian làm bài:</span> {assignment.durationMinutes} phút
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between" suppressHydrationWarning>
                <span className="text-sm font-medium text-slate-700">
                  {assignment.totalScore} điểm
                </span>
                <div className="flex gap-2">
                  {latest ? (
                    <>
                      <Link
                        href={`/assignments/${assignment.id}/result?sid=${latest.id}`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Lịch sử
                      </Link>
                      <Link
                        href={`/assignments/${assignment.id}/start`}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        Làm lại
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={overdue ? "#" : `/assignments/${assignment.id}/start`}
                      aria-disabled={overdue}
                      className={clsx(
                        "rounded-lg px-4 py-1.5 text-sm font-medium transition",
                        overdue
                          ? "cursor-not-allowed bg-slate-200 text-slate-500"
                          : "bg-slate-900 text-white hover:bg-slate-800"
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
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Không có bài tập phù hợp.
          </div>
        )}
      </div>
    </div>
  );
}
