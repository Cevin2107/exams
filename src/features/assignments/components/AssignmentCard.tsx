import React from "react";
import Link from "next/link";
import clsx from "clsx";
import { Assignment } from "@/lib/types";
import { isBefore } from "date-fns";

interface AssignmentCardProps {
  assignment: Assignment;
  now: number | null;
}

export const AssignmentCard: React.FC<AssignmentCardProps> = ({ assignment, now }) => {
  const getDerivedStatus = () => {
    if (now !== null && assignment.dueAt && isBefore(new Date(assignment.dueAt), new Date(now))) return "overdue" as const;
    return assignment.latestSubmission ? "completed" : "not_started";
  };

  const isUrgent = () => {
    if (!assignment.dueAt || now === null) return false;
    const diff = new Date(assignment.dueAt).getTime() - now;
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  };

  const formatRemaining = () => {
    if (!assignment.dueAt) return null;
    if (now === null) return "Đang tính...";
    const target = new Date(assignment.dueAt).getTime();
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

  const formatDueDate = () => {
    if (!assignment.dueAt) return null;
    const date = new Date(assignment.dueAt);
    if (isNaN(date.getTime())) return null;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${hours}:${minutes} · ${day}/${month}/${year}`;
  };

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

  const status = getDerivedStatus();
  const overdue = status === "overdue";
  const completed = status === "completed";
  const urgent = isUrgent();
  const latest = assignment.latestSubmission;
  const remaining = formatRemaining();
  const dueDateTime = formatDueDate();

  return (
    <div
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
      <div className="flex items-center justify-between gap-2 mb-3" suppressHydrationWarning>
        <div className="flex items-center gap-2">
          <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", subjectColor(assignment.subject))}>
            {assignment.subject}
          </span>
          <span className="text-xs text-slate-400">{assignment.grade}</span>
        </div>
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
      </div>

      <h2 className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2 mb-3">{assignment.title}</h2>

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {assignment.durationMinutes} phút
          </span>
        )}
      </div>

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
};
