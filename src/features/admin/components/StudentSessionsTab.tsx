import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatVietnamTime } from "@/utils/date";
import { useToast } from "@/components/ui/Toast";
import { StudentWorkReviewPanel } from "./StudentWorkReviewPanel";
import { 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  User, 
  Eye, 
  Search,
  Target,
  Timer,
  Zap,
  FileCheck,
  LogOut
} from "lucide-react";

export function StudentSessionsTab({ assignmentId }: { assignmentId: string }) {
  const { addToast } = useToast();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["student-sessions", assignmentId],
    queryFn: async () => {
      const res = await fetch(`/api/student-sessions?assignmentId=${assignmentId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return data.sessions || [];
    },
    refetchInterval: 2000, // Giảm từ 3s xuống 2s để realtime tốt hơn
    staleTime: 0, // Data luôn được coi là stale, refetch ngay lập tức
  });

  const { data: detailData, isLoading: detailLoading, refetch: refetchDetail } = useQuery({
    queryKey: ["session-detail", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return null;
      const session = sessions.find((s: any) => s.id === selectedSessionId);
      if (!session) return null;

      if (session.submissions?.id) {
        const res = await fetch(`/api/admin/submissions/${session.submissions.id}/detail`, { cache: 'no-store' });
        if (!res.ok) throw new Error("Failed to fetch submission detail");
        return res.json();
      } else {
        const res = await fetch(`/api/admin/sessions/${session.id}/detail`, { cache: 'no-store' });
        if (!res.ok) throw new Error("Failed to fetch session detail");
        return res.json();
      }
    },
    enabled: !!selectedSessionId,
    staleTime: 0, // Data luôn được coi là stale
    refetchInterval: (query) => {
      const session = sessions.find((s: any) => s.id === selectedSessionId);
      return (session && !session.submissions?.id) ? 3000 : false; // Giảm từ 5s xuống 3s
    }
  });

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Xóa phiên làm bài này? Toàn bộ quá trình của học sinh sẽ bị mất.")) return;
    try {
      const res = await fetch(`/api/student-sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xóa thất bại");
      addToast({ title: "Xóa thành công", variant: "success" });
      setSelectedSessionId(null);
      refetch();
    } catch {
      addToast({ title: "Không thể xóa phiên làm bài", variant: "error" });
    }
  };

  // Filter sessions by search term
  const filteredSessions = sessions.filter((s: any) => 
    s.student_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedSessionId) {
    const session = sessions.find((s: any) => s.id === selectedSessionId);
    if (!session) return null;
    const isSubmitted = !!session.submissions?.id;
    
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Header Section - Glassmorphism */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-50/95 backdrop-blur-xl border border-slate-200/80 shadow-lg shadow-slate-200/40 p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/40 pointer-events-none" />
          
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedSessionId(null)}
                className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-md shadow-slate-200/50 text-slate-600 hover:text-indigo-600 hover:shadow-lg transition-all duration-300 group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              
              <div className="flex items-center gap-2.5">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-md shadow-indigo-500/30">
                    <User className="h-5 w-5" />
                  </div>
                </div>
                
                <div className="min-w-0">
                  <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent truncate">
                    {session.student_name}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <p className="text-xs text-slate-500">Bắt đầu: {formatVietnamTime(new Date(session.started_at))}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {isSubmitted ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30">
                  <FileCheck className="h-4 w-4" />
                  <span className="font-bold text-xs">Đã nộp · {session.submissions.score}đ</span>
                </div>
              ) : session.status === "exited" ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/30">
                  <LogOut className="h-4 w-4" />
                  <span className="font-bold text-xs">Đã thoát</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30 animate-pulse">
                  <Zap className="h-4 w-4" />
                  <span className="font-bold text-xs">Đang làm</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail Card - Glassmorphism */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-50/95 backdrop-blur-xl border border-slate-200/80 shadow-lg shadow-slate-200/40 p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 pointer-events-none" />
          
          <div className="relative">
            {detailLoading ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
                  <RefreshCw className="relative h-10 w-10 text-indigo-500 animate-spin" />
                </div>
                <p className="text-slate-600 text-xs mt-4 font-medium">Đang tải chi tiết bài làm...</p>
              </div>
            ) : detailData ? (
              <div className="space-y-4">
                <StudentWorkReviewPanel
                  questions={detailData.questions || []}
                  startedAt={session.started_at}
                  isSubmitted={isSubmitted}
                  isPaused={session.status === "exited"}
                  pausedAt={session.last_activity_at}
                  submissionId={session.submissions?.id}
                  submissionScore={session.submissions?.score}
                  answeredCountOverride={
                    detailData?.draft_answers
                      ? Object.keys(detailData.draft_answers).length
                      : undefined
                  }
                  onRefresh={async () => {
                    await Promise.all([refetchDetail(), refetch()]);
                  }}
                  notify={(message, type) => {
                    addToast({ title: message, variant: type });
                  }}
                />
              </div>
            ) : (
              <div className="text-center py-10">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium text-sm">Không tìm thấy chi tiết bài làm.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main sessions list view
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header Section - Glassmorphism */}
      <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-lg shadow-slate-200/50 p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-violet-50/50 pointer-events-none" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-1.5">
              <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Danh sách học sinh
              </h2>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-md ${
                sessions.length > 0 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-blue-500/30'
                  : 'bg-slate-200 text-slate-500'
              }`}>
                {sessions.length} {sessions.length === 1 ? 'học sinh' : 'học sinh'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur animate-pulse" />
                <RefreshCw className="relative h-3.5 w-3.5 animate-spin" />
              </div>
              <span className="font-medium">Tự động đồng bộ mỗi 3 giây</span>
            </div>
          </div>
          
          {sessions.length > 0 && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm kiếm học sinh..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 shadow-md shadow-slate-200/50 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all outline-none"
                aria-label="Tìm kiếm học sinh"
              />
            </div>
          )}
        </div>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-lg shadow-slate-200/50 p-10">
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
              <RefreshCw className="relative h-10 w-10 text-indigo-500 animate-spin" />
            </div>
            <p className="text-slate-600 font-medium text-sm">Đang tải danh sách...</p>
          </div>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-lg shadow-slate-200/50 p-10">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 via-transparent to-slate-50/50 pointer-events-none" />
          
          <div className="relative text-center">
            {searchTerm ? (
              <>
                <div className="relative inline-block mb-3">
                  <div className="absolute inset-0 bg-slate-300/20 rounded-full blur-xl" />
                  <AlertCircle className="relative h-12 w-12 text-slate-300 mx-auto" />
                </div>
                <p className="text-base font-bold text-slate-700 mb-1.5">Không tìm thấy học sinh</p>
                <p className="text-xs text-slate-500">Thử tìm kiếm với từ khóa khác</p>
              </>
            ) : (
              <>
                <div className="relative inline-block mb-3">
                  <div className="absolute inset-0 bg-indigo-300/20 rounded-full blur-xl" />
                  <User className="relative h-12 w-12 text-slate-300 mx-auto" />
                </div>
                <p className="text-base font-bold text-slate-700 mb-1.5">Chưa có học sinh nào</p>
                <p className="text-xs text-slate-500">Khi học sinh truy cập bài tập, danh sách sẽ hiển thị tại đây.</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredSessions.map((s: any) => (
            <div 
              key={s.id} 
              className="group relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-4"
            >
              {/* Top gradient indicator */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                s.submissions?.id 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : s.status === "exited"
                  ? 'bg-gradient-to-r from-rose-500 to-red-500'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`} />
              
              <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Student Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Avatar */}
                    <div className="relative group/avatar flex-shrink-0">
                      <div className={`absolute inset-0 rounded-xl blur opacity-30 group-hover/avatar:opacity-50 transition-opacity ${
                        s.submissions?.id 
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                          : s.status === "exited"
                          ? 'bg-gradient-to-br from-rose-500 to-red-600'
                          : 'bg-gradient-to-br from-amber-500 to-orange-600'
                      }`} />
                      <div className={`relative flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md ${
                        s.submissions?.id 
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                          : s.status === "exited"
                          ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30'
                          : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30'
                      }`}>
                        <User className="h-5 w-5" />
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 truncate">{s.student_name}</h3>
                        {s.submissions?.id ? (
                          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/30">
                            <FileCheck className="h-3 w-3" />
                            Đã nộp
                          </div>
                        ) : s.status === "exited" ? (
                          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-500 text-white text-xs font-bold shadow-md shadow-rose-500/30">
                            <LogOut className="h-3 w-3" />
                            Đã thoát
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-md shadow-amber-500/30 animate-pulse">
                            <Zap className="h-3 w-3" />
                            Đang làm
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-500 mt-2">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 flex-shrink-0 text-blue-500" />
                          <span className="truncate">Bắt đầu: {formatVietnamTime(new Date(s.started_at))}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                          <span className="truncate">Cập nhật lúc: {formatVietnamTime(new Date(s.last_activity_at))}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3 flex-shrink-0 text-rose-500" />
                          <span className="truncate">Số lần thoát: <strong className="text-rose-600">{s.exit_count || 0}</strong> lần</span>
                        </div>
                      </div>
                      
                      {/* Real-time stats for active sessions */}
                      {!s.submissions?.id && (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          {s.draft_answers && Object.keys(s.draft_answers || {}).length > 0 && (
                            <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                              <Target className="h-3 w-3" />
                              <span>{Object.keys(s.draft_answers || {}).length} câu đã lưu</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-sm font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
                            <Timer className="h-3 w-3" />
                            <span>{Math.floor((new Date().getTime() - new Date(s.started_at).getTime()) / 60000)} phút</span>
                          </div>
                        </div>
                      )}
                      
                      {s.submissions?.id && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <div className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200/50">
                            <span className="text-base font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                              {s.submissions.score} điểm
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setSelectedSessionId(s.id)}
                    className="group/btn flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl font-semibold text-xs shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 transition-all duration-300"
                  >
                    <Eye className="h-3.5 w-3.5 group-hover/btn:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Xem chi tiết</span>
                    <span className="sm:hidden">Chi tiết</span>
                  </button>
                  
                  <button
                    onClick={() => handleDeleteSession(s.id)}
                    className="group/del flex items-center justify-center h-9 w-9 bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all duration-300"
                    aria-label="Xóa phiên làm bài"
                  >
                    <Trash2 className="h-3.5 w-3.5 group-hover/del:scale-110 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
