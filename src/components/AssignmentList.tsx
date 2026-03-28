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
  const [statusFilter, setStatusFilter] = useState("not_started");
  const [now, setNow] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatRemaining = (dueAt?: string | null) => {
    if (!dueAt) return null;
    if (now === null) return "Đang tính...";
    const target = new Date(dueAt).getTime();
    if (Number.isNaN(target)) return null;
    const diff = target - now;
    if (diff <= 0) return null;
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (days) parts.push(`${days}n`);
    if (hours) parts.push(`${hours}g`);
    if (minutes) parts.push(`${minutes}p`);
    if (!days && seconds) parts.push(`${seconds}s`);
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
    return `${hours}:${minutes} · ${day}/${month}/${year}`;
  };

  const getDerivedStatus = useCallback((assignment: Assignment) => {
    if (now !== null && assignment.dueAt && isBefore(new Date(assignment.dueAt), new Date(now))) return "overdue" as const;
    return assignment.latestSubmission ? "completed" : "not_started";
  }, [now]);

  const isUrgent = useCallback((assignment: Assignment) => {
    if (!assignment.dueAt || now === null) return false;
    const diff = new Date(assignment.dueAt).getTime() - now;
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
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

  const StatusBadge = ({ assignment }: { assignment: Assignment }) => {
    const status = getDerivedStatus(assignment);
    const urgent = isUrgent(assignment);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {urgent && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            Gấp!
          </span>
        )}
        <span className={clsx(
          "rounded-full px-2.5 py-1 text-xs font-semibold",
          status === "overdue"
            ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20"
            : status === "completed"
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700"
        )}>
          {status === "overdue" ? "Quá hạn" : status === "completed" ? "✓ Đã làm" : "Chưa làm"}
        </span>
      </div>
    );
  };

  const subjectColor = (subject: string) => {
    const map: Record<string, string> = {
      "Toán": "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
      "Lý": "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
      "Hóa": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
      "Văn": "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400",
      "Anh": "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
      "Sinh": "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400",
    };
    for (const key of Object.keys(map)) {
      if (subject?.includes(key)) return map[key];
    }
    return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400";
  };

  if (!mounted) {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/80 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none p-5">
          <div className="skeleton dark:bg-slate-700/50 h-12 mb-3 rounded-2xl" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton dark:bg-slate-700/50 h-9 w-24 rounded-2xl" />)}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/80 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none p-6">
              <div className="skeleton dark:bg-slate-700/50 h-6 w-3/4 mb-4 rounded-xl" />
              <div className="skeleton dark:bg-slate-700/50 h-4 w-full mb-2 rounded-lg" />
              <div className="skeleton dark:bg-slate-700/50 h-4 w-2/3 mb-4 rounded-lg" />
              <div className="skeleton dark:bg-slate-700/50 h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-slide-up" suppressHydrationWarning>
      <div className="space-y-3 rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/80 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none p-5" suppressHydrationWarning>
        <div className="relative">
          <svg className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full rounded-2xl border-2 border-slate-200/60 dark:border-slate-700 bg-white/60 dark:bg-slate-900/50 backdrop-blur-sm py-3 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 transition-all focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-100/50 dark:focus:ring-indigo-500/20"
            placeholder="Tìm kiếm bài tập..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "not_started", label: "Chưa làm" },
            { value: "completed", label: "Đã làm" },
            { value: "overdue", label: "Quá hạn" },
            { value: "Tất cả", label: "Tất cả" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={clsx(
                "rounded-2xl px-4 py-2 text-sm font-semibold transition-all duration-300",
                statusFilter === tab.value
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30"
                  : "bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-white/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400"
              )}
            >
              {tab.label}
            </button>
          ))}

          {subjects.length > 1 && (
            <select
              className="ml-auto rounded-2xl border-2 border-slate-200/60 dark:border-slate-700 bg-white/60 dark:bg-slate-900/50 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition focus:border-indigo-400 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="Tất cả">Tất cả môn</option>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </div>

        {(search || subjectFilter !== "Tất cả" || statusFilter !== "Tất cả") && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm px-3 py-2">
            <svg className="h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {filtered.length} kết quả
            </p>
            <button
              onClick={() => { setSearch(""); setSubjectFilter("Tất cả"); setStatusFilter("Tất cả"); }}
              className="ml-auto text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold hover:underline"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" suppressHydrationWarning>
        {filtered.map((assignment) => {
          const status = getDerivedStatus(assignment);
          const overdue = status === "overdue";
          const completed = status === "completed";
          const urgent = isUrgent(assignment);
          const latest = assignment.latestSubmission;
          const remaining = formatRemaining(assignment.dueAt);
          const dueDateTime = formatDueDate(assignment.dueAt);

          return (
            <div
              key={assignment.id}
              className={clsx(
                "group flex flex-col rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/80 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none p-6 transition-all duration-300",
                urgent ? "ring-2 ring-red-400/50 dark:ring-red-500/30 shadow-red-200/50 hover:shadow-2xl hover:shadow-red-300/40" :
                overdue ? "opacity-75 hover:shadow-2xl hover:shadow-slate-300/40 dark:hover:shadow-black/40" :
                completed ? "hover:shadow-2xl hover:shadow-emerald-200/40 dark:hover:border-emerald-500/50" :
                "hover:shadow-2xl hover:shadow-indigo-200/40 dark:hover:border-indigo-500/50"
              )}
              suppressHydrationWarning
            >
              <div className="flex items-center justify-between gap-2 mb-4" suppressHydrationWarning>
                <div className="flex items-center gap-2">
                  <span className={clsx("rounded-xl px-3 py-1 text-xs font-bold backdrop-blur-sm", subjectColor(assignment.subject))}>
                    {assignment.subject}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{assignment.grade}</span>
                </div>
                <StatusBadge assignment={assignment} />
              </div>

              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-4">{assignment.title}</h2>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 dark:text-slate-400 flex-1 mb-5" suppressHydrationWarning>
                {dueDateTime && (
                  <span className="flex items-center gap-1.5 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {dueDateTime}
                  </span>
                )}
                {remaining && (
                  <span className={clsx("flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg backdrop-blur-sm", urgent ? "text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-500/10" : "text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50")}>
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Còn {remaining}
                  </span>
                )}
                {assignment.durationMinutes && (
                  <span className="flex items-center gap-1.5 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {assignment.durationMinutes} phút
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100/50 dark:border-slate-700/50 pt-4" suppressHydrationWarning>
                <div className="flex items-center gap-2 bg-amber-50/50 dark:bg-amber-500/10 backdrop-blur-sm px-3 py-1.5 rounded-xl">
                  <svg className="h-4 w-4 text-amber-500 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{assignment.totalScore} điểm</span>
                </div>

                <div className="flex items-center gap-2">
                  {latest ? (
                    <>
                      <Link
                        href={`/assignments/${assignment.id}/result?sid=${latest.id}`}
                        className="rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/80 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-white/80 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                      >
                        Xem kết quả
                      </Link>
                      <Link
                        href={`/assignments/${assignment.id}/start`}
                        className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-700 hover:to-violet-700 hover:shadow-xl dark:shadow-indigo-500/20"
                      >
                        Làm lại
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={overdue ? "#" : `/assignments/${assignment.id}/start`}
                      aria-disabled={overdue}
                      className={clsx(
                        "rounded-xl px-4 py-1.5 text-xs font-semibold transition shadow-lg",
                        overdue
                          ? "cursor-not-allowed bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-400 dark:text-slate-500 shadow-none border dark:border-slate-700"
                          : "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-500/30 dark:shadow-indigo-500/20 hover:from-indigo-700 hover:to-violet-700 hover:shadow-xl"
                      )}
                    >
                      {overdue ? "Đã hết hạn" : "Làm bài →"}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 flex flex-col items-center justify-center rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/80 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none p-16 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
              <svg className="h-10 w-10 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-lg font-bold text-slate-700 dark:text-white mb-2">Không tìm thấy bài tập phù hợp</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Thử thay đổi bộ lọc hoặc tìm kiếm khác</p>
          </div>
        )}
      </div>
    </div>
  );
}
