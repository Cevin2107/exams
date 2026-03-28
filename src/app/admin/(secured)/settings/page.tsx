"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Lock, Save, ShieldCheck } from "lucide-react";
import Toast from "@/components/Toast";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setToast({ message: "Mật khẩu xác nhận không khớp", type: "error" });
      return;
    }
    
    if (newPassword.length < 6) {
      setToast({ message: "Mật khẩu mới phải có ít nhất 6 ký tự", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể đổi mật khẩu");
      }
      
      setToast({ message: "Đổi mật khẩu thành công!", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setToast({ message: err.message || "Có lỗi xảy ra", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-8 py-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cài đặt hệ thống</h1>
        <p className="text-sm text-slate-500 mt-1">Quản lý bảo mật, mật khẩu quản trị và cấu hình chung.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
           <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Tính bảo mật</h2>
           </div>
           <p className="text-sm text-slate-500 leading-relaxed">
             Bảo vệ tài khoản quản trị của bạn bằng cách sử dụng mật khẩu mạnh. Khuyến nghị thay đổi mật khẩu định kỳ 3 tháng một lần để đảm bảo an toàn.
           </p>
        </div>

        <div className="md:col-span-2">
           <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Mật khẩu hiện tại</label>
                    <div className="relative">
                       <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                       <input 
                         type="password" 
                         required
                         value={currentPassword}
                         onChange={e => setCurrentPassword(e.target.value)}
                         className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition"
                         placeholder="Nhập mật khẩu đang dùng"
                       />
                    </div>
                 </div>

                 <div className="pt-4 border-t border-slate-100 grid gap-6">
                    <div>
                       <label className="text-sm font-semibold text-slate-700 block mb-2">Mật khẩu mới</label>
                       <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input 
                            type="password" 
                            required
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition"
                            placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                          />
                       </div>
                    </div>
                    <div>
                       <label className="text-sm font-semibold text-slate-700 block mb-2">Xác nhận mật khẩu mới</label>
                       <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input 
                            type="password" 
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition"
                            placeholder="Nhập lại mật khẩu mới"
                          />
                       </div>
                    </div>
                 </div>

                 <div className="flex justify-end pt-2">
                    <Button type="submit" variant="brand" disabled={loading || !currentPassword || !newPassword || !confirmPassword}>
                       <Save className="h-4 w-4 mr-2" /> {loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
                    </Button>
                 </div>
              </form>
           </Card>
        </div>
      </div>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
