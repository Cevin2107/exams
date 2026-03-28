"use client";

import Link from "next/link";
import { useAdminAssignments } from "@/features/admin/hooks/useAdminAssignments";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { LayoutList, Plus, Search, Filter, Edit, Eye, EyeOff, Clock, Award } from "lucide-react";
import { useState } from "react";

export default function AssignmentsPage() {
  const { data: assignments = [], isLoading } = useAdminAssignments();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"title" | "date" | "score">("title");

  const filtered = assignments.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (a.subject && a.subject.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    
    if (filter === "hidden") return a.is_hidden;
    if (filter === "visible") return !a.is_hidden;
    return true;
  });

  // Sort assignments
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "title") return a.title.localeCompare(b.title);
    if (sortBy === "date") {
      const dateA = a.due_at ? new Date(a.due_at).getTime() : 0;
      const dateB = b.due_at ? new Date(b.due_at).getTime() : 0;
      return dateB - dateA;
    }
    if (sortBy === "score") return (b.total_score || 0) - (a.total_score || 0);
    return 0;
  });

  return (
    <div className="container-custom py-6 md:py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Quản lý bài tập</h1>
          <p className="text-sm text-slate-600 mt-1">Tìm kiếm, lọc và phân loại tất cả các đề thi trong hệ thống.</p>
        </div>
        <Link href="/admin/assignments/new">
          <Button variant="brand">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Tạo bài tập mới</span>
            <span className="sm:hidden">Tạo mới</span>
          </Button>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên hoặc môn học..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition outline-none"
              aria-label="Tìm kiếm bài tập"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                aria-label="Xóa tìm kiếm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter & Sort */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select 
                value={filter} 
                onChange={e => setFilter(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none pr-1"
                aria-label="Lọc trạng thái"
              >
                <option value="all">Tất cả</option>
                <option value="visible">Hiển thị</option>
                <option value="hidden">Đã ẩn</option>
              </select>
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none pr-1"
                aria-label="Sắp xếp theo"
              >
                <option value="title">Tên A-Z</option>
                <option value="date">Hạn nộp</option>
                <option value="score">Điểm cao nhất</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results count */}
        {(searchTerm || filter !== "all") && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Tìm thấy {sorted.length} kết quả</span>
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(""); setFilter("all"); }}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Assignment Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : sorted.length === 0 ? (
        <Card className="p-16">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-100">
              <LayoutList className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-base font-bold text-slate-700">Không tìm thấy bài tập nào!</p>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
              {searchTerm 
                ? "Hãy thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc."
                : "Tạo bài tập đầu tiên để bắt đầu."}
            </p>
            {!searchTerm && (
              <Link href="/admin/assignments/new">
                <Button variant="brand" className="mt-6">
                  <Plus className="h-4 w-4" />
                  Tạo bài tập ngay
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((a: any) => (
            <Card key={a.id} variant="elevated" className="flex flex-col p-5 hover-lift">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="info" size="sm">
                    {a.subject || "Chung"}
                  </Badge>
                  {a.grade && (
                    <Badge variant="secondary" size="sm">
                      {a.grade}
                    </Badge>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {a.is_hidden ? (
                    <Tooltip content="Đang ẩn">
                      <div className="p-1.5 rounded-lg bg-slate-100">
                        <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                    </Tooltip>
                  ) : (
                    <Tooltip content="Đang hiển thị">
                      <div className="p-1.5 rounded-lg bg-emerald-50">
                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Title */}
              <Tooltip content={a.title.length > 50 ? a.title : ""}>
                <h3 className="text-base font-bold text-slate-900 mb-3 line-clamp-2 leading-tight min-h-[2.5rem]">
                  {a.title}
                </h3>
              </Tooltip>

              {/* Meta Info */}
              <div className="space-y-2 text-sm text-slate-600 flex-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Thời gian
                  </span>
                  <span className="font-semibold text-slate-900">
                    {a.duration_minutes ? `${a.duration_minutes} phút` : "Không giới hạn"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-slate-400" />
                    Tổng điểm
                  </span>
                  <span className="font-semibold text-slate-900">{a.total_score || 0}</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <Link href={`/admin/assignments/${a.id}`}>
                  <Button variant="outline" className="w-full group">
                    <Edit className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    Quản lý & Chỉnh sửa
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
