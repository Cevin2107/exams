'use client'

import Link from "next/link";
import { useAdminAssignments } from "@/features/admin/hooks/useAdminAssignments";
import DatabaseSizeCard from "@/components/DatabaseSizeCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Eye, EyeOff, LayoutList, BarChart3, Plus, RefreshCw } from "lucide-react";

export default function AdminDashboardPage() {
  const { data: assignments = [], isLoading, isRefetching, refetch } = useAdminAssignments();

  const visibleCount = assignments.filter((a) => !a.is_hidden).length;
  const hiddenCount = assignments.filter((a) => a.is_hidden).length;

  return (
    <div className="container-custom py-6 md:py-8 space-y-6 animate-fade-in">
      {/* Header with Glassmorphic Card */}
      <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-slate-200/50 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Tổng quan hệ thống</h1>
            <p className="text-sm text-slate-600 mt-1.5">Quản lý bài tập và theo dõi số liệu chung.</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()} 
              disabled={isRefetching} 
              loading={isRefetching}
              className="bg-white/50 backdrop-blur-sm border-white/80 hover:bg-white/80"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>
            <Link href="/admin/assignments/new">
              <Button variant="brand" size="sm" className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/30">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Tạo bài mới</span>
                <span className="sm:hidden">Tạo mới</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stat cards - Enhanced Glassmorphic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <div className="group rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-slate-200/50 p-6 hover:shadow-2xl hover:shadow-indigo-200/40 transition-all duration-300">
              <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white mb-4 shadow-xl shadow-indigo-500/40 group-hover:scale-110 transition-transform duration-300">
                <LayoutList className="h-7 w-7" />
              </div>
              <p className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{assignments.length}</p>
              <p className="text-sm font-semibold text-slate-500 mt-2">Tổng bài tập</p>
            </div>
            
            <div className="group rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-slate-200/50 p-6 hover:shadow-2xl hover:shadow-emerald-200/40 transition-all duration-300">
              <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white mb-4 shadow-xl shadow-emerald-500/40 group-hover:scale-110 transition-transform duration-300">
                <Eye className="h-7 w-7" />
              </div>
              <p className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{visibleCount}</p>
              <p className="text-sm font-semibold text-slate-500 mt-2">Đang công khai</p>
            </div>
            
            <div className="group rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-slate-200/50 p-6 hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-300">
              <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-400 to-slate-500 text-white mb-4 shadow-xl shadow-slate-400/30 group-hover:scale-110 transition-transform duration-300">
                <EyeOff className="h-7 w-7" />
              </div>
              <p className="text-4xl font-bold text-slate-700">{hiddenCount}</p>
              <p className="text-sm font-semibold text-slate-500 mt-2">Đang ẩn</p>
            </div>
          </>
        )}
      </div>

      {/* Content Grid - Stacks on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignment list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Danh sách bài tập</h2>
            <Link href="/admin/stats">
              <Button variant="outline" size="sm" className="bg-white/50 backdrop-blur-sm border-white/80 hover:bg-white/80">
                <BarChart3 className="h-4 w-4 mr-2 text-slate-500" />
                Thống kê chi tiết
              </Button>
            </Link>
          </div>

          <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl shadow-slate-200/50 overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Đang tải dữ liệu...</div>
            ) : assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 ring-4 ring-slate-50">
                  <LayoutList className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Chưa có bài tập nào</p>
                <p className="mt-1 text-sm text-slate-500 max-w-xs">Tạo bài tập đầu tiên để bắt đầu quá trình giảng dạy!</p>
                <Link href="/admin/assignments/new">
                  <Button variant="brand" className="mt-6 bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30">
                    Tạo bài tập ngay
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/50">
                {assignments.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between px-6 py-5 transition hover:bg-slate-50/50 hover:backdrop-blur-sm">
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-[15px] font-semibold text-slate-900 truncate">{a.title}</h3>
                        {a.is_hidden && (
                          <Badge variant="secondary" className="shrink-0 text-[10px] py-0 bg-slate-100/80 backdrop-blur-sm">Đang ẩn</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-indigo-600 bg-indigo-50/80 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[11px]">{a.subject}</span>
                        <span>&bull;</span>
                        <span>{a.grade}</span>
                        <span>&bull;</span>
                        <span className="font-semibold">{a.total_score} điểm</span>
                      </div>
                    </div>
                    <Link href={`/admin/assignments/${a.id}`}>
                      <Button variant="secondary" size="sm" className="bg-slate-50/80 backdrop-blur-sm hover:bg-slate-100/80">
                        Chi tiết
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Database size overview on the right */}
        <div className="lg:col-span-1">
           <DatabaseSizeCard />
        </div>
      </div>
    </div>
  );
}
