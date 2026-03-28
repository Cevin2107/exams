import React from "react";
import clsx from "clsx";

interface FilterBarProps {
  search: string;
  setSearch: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  subjectFilter: string;
  setSubjectFilter: (s: string) => void;
  subjects: string[];
  resultCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search, setSearch, statusFilter, setStatusFilter, subjectFilter, setSubjectFilter, subjects, resultCount
}) => {
  return (
    <div className="space-y-3" suppressHydrationWarning>
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
          {resultCount} kết quả &bull;{" "}
          <button
            onClick={() => { setSearch(""); setSubjectFilter("Tất cả"); setStatusFilter("Tất cả"); }}
            className="text-indigo-600 hover:underline"
          >
            Xóa bộ lọc
          </button>
        </p>
      )}
    </div>
  );
};
