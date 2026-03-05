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
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            Gấp!
          </span>
        )}
        <span className={clsx(
          "rounded-full px-2.5 py-1 text-xs font-semibold",
          status === "overdue"
            ? "bg-red-50 text-red-700 ring-1 ring-red-200"
            : status === "completed"
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
        )}>
          {status === "overdue" ? "Quá hạn" : status === "completed" ? "✓ Đã làm" : "Chưa làm"}
        </span>
      </div>
    );
  };

  // Subject color mapping
  const subjectColor = (subject: string) => {
    const map: Record<string, string> = {
      "Toán": "bg-blue-100 text-blue-700",
      "Lý": "bg-purple-100 text-purple-700",
      "Hóa": "bg-emerald-100 text-emerald-700",
      "Văn": "bg-pink-100 text-pink-700",
      "Anh": "bg-amber-100 text-amber-700",
      "Sinh": "bg-teal-100 text-teal-700",
    };
    for (const key of Object.keys(map)) {
      if (subject?.includes(key)) return map[key];
    }
    return "bg-indigo-100 text-indigo-700";
  };

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-10" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-slide-up" suppressHydrationWarning>
      {/* Filter bar */}
      <div className="space-y-3" suppressHydrationWarning>
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="Tìm kiếm bài tập..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status tabs + subject select */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "Tất cả", label: "Tất cả" },
            { value: "not_started", label: "Chưa làm" },
            { value: "completed", label: "Đã làm" },
            { value: "overdue", label: "Quá hạn" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                statusFilter === tab.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
              )}
            >
              {tab.label}
            </button>
          ))}

          {subjects.length > 1 && (
            <select
              className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition focus:border-indigo-300 focus:outline-none"
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
          <p className="text-xs text-slate-500">
            {filtered.length} kết quả &bull;{" "}
            <button
              onClick={() => { setSearch(""); setSubjectFilter("Tất cả"); setStatusFilter("Tất cả"); }}
              className="text-indigo-600 hover:underline"
            >
              Xóa bộ lọc
            </button>
          </p>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 md:grid-cols-2" suppressHydrationWarning>
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
                "group flex flex-col rounded-2xl bg-white p-5 transition-all duration-200",
                "border hover:shadow-md hover:-translate-y-0.5",
                urgent ? "border-red-200 shadow-sm shadow-red-50" :
                overdue ? "border-slate-200 opacity-75" :
                completed ? "border-slate-200 hover:border-emerald-200" :
                "border-slate-200 hover:border-indigo-200"
              )}
              suppressHydrationWarning
            >
              {/* Subject + grade + status */}
              <div className="flex items-center justify-between gap-2 mb-3" suppressHydrationWarning>
                <div className="flex items-center gap-2">
                  <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", subjectColor(assignment.subject))}>
                    {assignment.subject}
                  </span>
                  <span className="text-xs text-slate-400">{assignment.grade}</span>
                </div>
                <StatusBadge assignment={assignment} />
              </div>

              {/* Title */}
              <h2 className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2 mb-3">{assignment.title}</h2>

              {/* Meta info row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 flex-1" suppressHydrationWarning>
                {dueDateTime && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {dueDateTime}
                  </span>
                )}
                {remaining && (
                  <span className={clsx("flex items-center gap-1 font-semibold", urgent ? "text-red-500" : "text-slate-400")}>
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Còn {remaining}
                  </span>
                )}
                {assignment.durationMinutes && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {assignment.durationMinutes} phút
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3" suppressHydrationWarning>
                <div className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-bold text-slate-800">{assignment.totalScore} điểm</span>
                </div>

                <div className="flex items-center gap-2">
                  {latest ? (
                    <>
                      <Link
                        href={`/assignments/${assignment.id}/result?sid=${latest.id}`}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Xem kết quả
                      </Link>
                      <Link
                        href={`/assignments/${assignment.id}/start`}
                        className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                      >
                        Làm lại
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={overdue ? "#" : `/assignments/${assignment.id}/start`}
                      aria-disabled={overdue}
                      className={clsx(
                        "rounded-xl px-4 py-1.5 text-xs font-semibold transition",
                        overdue
                          ? "cursor-not-allowed bg-slate-100 text-slate-400"
                          : "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
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
          <div className="col-span-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <svg className="h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-medium text-slate-500">Không tìm thấy bài tập phù hợp</p>
            <p className="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc tìm kiếm khác</p>
          </div>
        )}
      </div>
    </div>
  );
}
