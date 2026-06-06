"use client";

import { useState, useEffect } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import { CalendarDays, Save, RefreshCw, AlertCircle, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Shift = { id: string; name: string; start_time: string; end_time: string };
type AvailableSchedule = { id: string; day_of_week: number; shift_id: string };

const DAYS = [
  { value: 2, label: "Thứ 2" },
  { value: 3, label: "Thứ 3" },
  { value: 4, label: "Thứ 4" },
  { value: 5, label: "Thứ 5" },
  { value: 6, label: "Thứ 6" },
  { value: 7, label: "Thứ 7" },
  { value: 8, label: "Chủ nhật" },
];

export default function RegisterSchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [maxShifts, setMaxShifts] = useState(3);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [availableSchedules, setAvailableSchedules] = useState<AvailableSchedule[]>([]);
  
  // This state holds the currently selected IDs by the user
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // This holds schedules registered by OTHERS
  const [lockedSchedules, setLockedSchedules] = useState<Set<string>>(new Set());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/student/schedules");
      if (res.status === 401) {
        // Not logged in
        router.push("/login");
        return;
      }
      
      if (!res.ok) throw new Error("Failed to fetch schedules");
      
      const data = await res.json();
      setMaxShifts(data.maxShifts);
      setShifts(data.shifts);
      setAvailableSchedules(data.availableSchedules);
      
      // Initialize selectedIds with what user already registered
      setSelectedIds(new Set(data.myRegistrations));
      setLockedSchedules(new Set(data.lockedSchedules));
      
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (scheduleId: string) => {
    if (lockedSchedules.has(scheduleId)) return; // Locked by others

    const newSet = new Set(selectedIds);
    if (newSet.has(scheduleId)) {
      newSet.delete(scheduleId);
    } else {
      if (newSet.size >= maxShifts) {
        setError(`Bạn chỉ được chọn tối đa ${maxShifts} ca.`);
        setTimeout(() => setError(""), 3000);
        return;
      }
      newSet.add(scheduleId);
    }
    setSelectedIds(newSet);
  };

  const handleRegister = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      const res = await fetch("/api/student/schedules/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleIds: Array.from(selectedIds) })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể đăng ký lịch");
      }
      
      setSuccess("Đăng ký lịch thành công!");
      setTimeout(() => setSuccess(""), 3000);
      
      // Refresh to get latest locks
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-[#0B1120]">
        <HeaderBar />
        <div className="flex h-[60vh] items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#0B1120] transition-colors duration-500 pb-12">
      <HeaderBar />

      <div className="container-custom py-4 sm:py-8 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                <CalendarDays className="h-6 w-6" />
              </div>
              Đăng ký Lịch học
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              Vui lòng chọn các ca học phù hợp với bạn. Bạn có thể chọn tối đa <span className="font-bold text-indigo-600 dark:text-indigo-400">{maxShifts} ca</span>.
            </p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col md:items-end shadow-sm">
            <span className="text-sm text-slate-500 dark:text-slate-400">Đã chọn</span>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              <span className={selectedIds.size === maxShifts ? "text-indigo-600 dark:text-indigo-400" : ""}>
                {selectedIds.size}
              </span>
              <span className="text-slate-400 text-lg"> / {maxShifts}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-xl animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-2 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 rounded-xl animate-in fade-in slide-in-from-top-2">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p>{success}</p>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"></div>
            <span className="text-slate-600 dark:text-slate-400">Trống</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-500 border border-indigo-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <span className="text-slate-600 dark:text-slate-400">Bạn đã chọn</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center opacity-60">
              <span className="block w-2.5 h-0.5 bg-slate-400 rounded-full rotate-45 relative"><span className="absolute block w-full h-full bg-slate-400 rounded-full -rotate-90"></span></span>
            </div>
            <span className="text-slate-600 dark:text-slate-400">Đã có người đăng ký</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium">
                <tr>
                  <th className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 w-32 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">
                    Thứ \ Ca
                  </th>
                  {shifts.map(shift => (
                    <th key={shift.id} className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 text-center min-w-[120px]">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{shift.name}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, idx) => (
                  <tr key={day.value} className={`${idx !== DAYS.length - 1 ? 'border-b border-slate-100 dark:border-slate-800/50' : ''} hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors`}>
                    <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-900/90 z-10 border-r border-slate-100 dark:border-slate-800/50">
                      {day.label}
                    </td>
                    {shifts.map(shift => {
                      const schedule = availableSchedules.find(s => s.day_of_week === day.value && s.shift_id === shift.id);
                      
                      if (!schedule) {
                        return (
                          <td key={shift.id} className="px-4 py-4 text-center">
                            <div className="mx-auto w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 flex items-center justify-center opacity-50 cursor-not-allowed" title="Ca này không mở">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                            </div>
                          </td>
                        );
                      }

                      const isSelected = selectedIds.has(schedule.id);
                      const isLocked = lockedSchedules.has(schedule.id);

                      return (
                        <td key={shift.id} className="px-4 py-4 text-center relative group">
                          {isLocked ? (
                            <div 
                              className="mx-auto w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-not-allowed opacity-60"
                              title="Đã có học sinh đăng ký ca này"
                            >
                              <span className="block w-3 h-0.5 bg-slate-400 dark:bg-slate-500 rounded-full rotate-45 relative"><span className="absolute block w-full h-full bg-slate-400 dark:bg-slate-500 rounded-full -rotate-90"></span></span>
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleSelection(schedule.id)}
                              className={`mx-auto w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                isSelected 
                                  ? "bg-indigo-500 hover:bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-500/20 scale-105" 
                                  : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 shadow-sm"
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800/30 p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 text-center md:text-left">
              <Info className="w-4 h-4" />
              <span>Nhấn vào ô trống để đăng ký, nhấn lại để huỷ chọn.</span>
            </div>
            
            <button
              onClick={handleRegister}
              disabled={saving}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/30"
            >
              {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Xác nhận đăng ký
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
