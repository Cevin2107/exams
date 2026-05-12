"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CheckSquare, Square, Users, Save } from "lucide-react";
import clsx from "clsx";

interface Student {
  id: string;
  full_name: string;
  isAssigned: boolean;
}

export function AssignTab({ assignmentId }: { assignmentId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch(`/api/admin/assignments/${assignmentId}/assign`);
        if (res.ok) {
          const data = await res.json();
          setStudents(data.students);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [assignmentId]);

  const toggleStudent = (id: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, isAssigned: !s.isAssigned } : s));
  };

  const toggleAll = () => {
    const allAssigned = students.every(s => s.isAssigned);
    setStudents(prev => prev.map(s => ({ ...s, isAssigned: !allAssigned })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const assignedIds = students.filter(s => s.isAssigned).map(s => s.id);
      const res = await fetch(`/api/admin/assignments/${assignmentId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedIds }),
      });
      if (res.ok) {
        addToast({
          title: "Thành công",
          description: "Đã cập nhật danh sách giao bài",
          variant: "success",
        });
      } else {
        throw new Error("Lỗi lưu");
      }
    } catch (err) {
      addToast({
        title: "Lỗi",
        description: "Không thể lưu phân công",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const assignedCount = students.filter(s => s.isAssigned).length;
  const allAssigned = students.length > 0 && assignedCount === students.length;

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Đang tải danh sách học sinh...</div>;
  }

  return (
    <div className="bg-white/80 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 p-6 rounded-3xl shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Giao bài cho học sinh
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Chỉ hiển thị bài tập này cho những học sinh được chọn.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} variant="brand">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Đang lưu..." : "Lưu phân công"}
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
        >
          {allAssigned ? (
            <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Square className="w-5 h-5 text-slate-400" />
          )}
          Chọn tất cả ({assignedCount}/{students.length})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {students.map(student => (
          <div
            key={student.id}
            onClick={() => toggleStudent(student.id)}
            className={clsx(
              "flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200",
              student.isAssigned
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/50"
                : "border-transparent bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800"
            )}
          >
            {student.isAssigned ? (
              <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            ) : (
              <Square className="w-5 h-5 text-slate-400 shrink-0" />
            )}
            <span className={clsx(
              "font-medium truncate text-sm",
              student.isAssigned ? "text-indigo-900 dark:text-indigo-200" : "text-slate-700 dark:text-slate-300"
            )}>
              {student.full_name}
            </span>
          </div>
        ))}
      </div>
      
      {students.length === 0 && (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          Chưa có học sinh nào đăng ký tài khoản.
        </div>
      )}
    </div>
  );
}
