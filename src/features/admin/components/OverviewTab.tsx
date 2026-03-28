"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useQuery } from "@tanstack/react-query";
import { formatVietnamTime } from "@/utils/date";
import Toast from "@/components/Toast";
import { Trash2, Save, BarChart3, Clock, Target, Calendar } from "lucide-react";

export function OverviewTab({ assignmentId, initialData }: { assignmentId: string; initialData: any }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [editForm, setEditForm] = useState(() => ({
    title: initialData?.title || "",
    subject: initialData?.subject || "",
    grade: initialData?.grade || "",
    due_at: initialData?.due_at || initialData?.dueAt || null,
    duration_minutes: initialData?.duration_minutes ?? initialData?.durationMinutes ?? null,
    total_score: initialData?.total_score ?? initialData?.totalScore ?? 0,
    is_hidden: initialData?.is_hidden ?? initialData?.isHidden ?? false,
    hide_score: initialData?.hide_score ?? initialData?.hideScore ?? false,
  }));
  const [loading, setLoading] = useState(false);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["admin-analytics", assignmentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/assignments/${assignmentId}/analytics`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let dueAtISO = null;
      if (editForm.due_at) {
        const localDate = new Date(editForm.due_at);
        const vietnamOffset = 7 * 60;
        const localOffset = localDate.getTimezoneOffset();
        const adjustedDate = new Date(localDate.getTime() - (vietnamOffset + localOffset) * 60 * 1000);
        dueAtISO = adjustedDate.toISOString();
      }

      const payload = {
        title: editForm.title,
        subject: editForm.subject,
        grade: editForm.grade,
        dueAt: dueAtISO,
        durationMinutes: editForm.duration_minutes ? Number(editForm.duration_minutes) : null,
        totalScore: editForm.total_score ? Number(editForm.total_score) : 10,
        isHidden: editForm.is_hidden, 
        hideScore: editForm.hide_score,
      };

      const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Cập nhật thất bại");
      setToast({ message: "Cập nhật bài tập thành công", type: "success" });
      router.refresh(); // Refresh page data to ensure changes are reflected across React components
    } catch (err) {
      setToast({ message: "Không thể cập nhật bài tập", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Xóa bài tập này? Hành động này sẽ xóa cả câu hỏi và các lần nộp.")) return;
    try {
      const res = await fetch(`/api/admin/assignments/${assignmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xóa thất bại");
      router.push("/admin/dashboard");
    } catch (err) {
      setToast({ message: "Không thể xóa bài tập", type: "error" });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Settings Form */}
      <div className="lg:col-span-2 space-y-6">
        <form onSubmit={handleSave}>
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Thông tin cơ bản</h2>
              <div className="flex gap-2">
                {Boolean(editForm.is_hidden) && <Badge variant="secondary">Đang ẩn</Badge>}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Tên bài tập</label>
                <input
                  type="text"
                  value={editForm.title || ""}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="text-sm font-semibold text-slate-700">Môn học</label>
                  <input
                    type="text"
                    value={editForm.subject || ""}
                    onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Lớp</label>
                  <input
                    type="text"
                    value={editForm.grade || ""}
                    onChange={e => setEditForm({ ...editForm, grade: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Hạn nộp</label>
                  <input
                    type="datetime-local"
                    value={editForm.due_at ? editForm.due_at.substring(0, 16) : ""}
                    onChange={e => setEditForm({ ...editForm, due_at: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Thời gian (phút)</label>
                  <input
                    type="number"
                    value={editForm.duration_minutes || ""}
                    onChange={e => setEditForm({ ...editForm, duration_minutes: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Tổng điểm</label>
                  <input
                    type="number"
                    value={editForm.total_score || ""}
                    onChange={e => setEditForm({ ...editForm, total_score: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-4">
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={Boolean(editForm.is_hidden)} onChange={e => setEditForm({ ...editForm, is_hidden: e.target.checked })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-slate-700">Ẩn bài tập (Học sinh không thấy)</span>
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={Boolean(editForm.hide_score)} onChange={e => setEditForm({ ...editForm, hide_score: e.target.checked })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-slate-700">Ẩn điểm khi nộp bài</span>
                 </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
               <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
                 <Trash2 className="h-4 w-4 mr-2" /> Xóa bài
               </Button>
               <Button type="submit" variant="brand" disabled={loading}>
                 <Save className="h-4 w-4 mr-2" /> {loading ? "Đang lưu..." : "Lưu thay đổi"}
               </Button>
            </div>
          </Card>
        </form>
      </div>

      {/* Analytics sidebar */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="p-6">
           <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
             <BarChart3 className="h-5 w-5 text-indigo-600" />
             <h2 className="text-lg font-bold text-slate-900">Thống kê chung</h2>
           </div>
           
           {analyticsLoading ? (
             <div className="text-sm text-slate-500 py-4 text-center">Đang tải thống kê...</div>
           ) : analytics ? (
             <div className="space-y-4">
               <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                 <span className="text-sm text-slate-600">Số lượt nộp bài</span>
                 <span className="text-base font-bold text-slate-900">{analytics.submissionCount}</span>
               </div>
               <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                 <span className="text-sm text-emerald-700">Điểm trung bình</span>
                 <span className="text-base font-bold text-emerald-700">{analytics.averageScore?.toFixed(2) || 0}</span>
               </div>
               <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                 <span className="text-sm text-slate-600">Điểm cao nhất</span>
                 <span className="text-base font-bold text-slate-900">{analytics.maxScore?.toFixed(2) || 0}</span>
               </div>
               <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                 <span className="text-sm text-slate-600">Thời gian làm TB</span>
                 <span className="text-base font-bold text-slate-900">{Math.round(analytics.averageDuration / 60) || 0} phút</span>
               </div>
             </div>
           ) : (
             <div className="text-sm text-slate-500 py-4 text-center">Chưa có dữ liệu thống kê</div>
           )}
        </Card>
      </div>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
