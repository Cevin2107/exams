"use client";

import { useState, useEffect } from "react";
import { Clock, Plus, Trash2, Save, Users, RefreshCw, Edit2 } from "lucide-react";

type Shift = { id: string; name: string; start_time: string; end_time: string };
type AvailableSchedule = { id: string; day_of_week: number; shift_id: string };

type StudentRegistration = {
  registration_id: string;
  available_schedule_id: string;
  day_of_week: number;
  shift: Shift;
};

type StudentLimit = {
  id: string;
  full_name: string;
  max_shifts: number;
};

const DAYS = [
  { value: 2, label: "Thứ 2" },
  { value: 3, label: "Thứ 3" },
  { value: 4, label: "Thứ 4" },
  { value: 5, label: "Thứ 5" },
  { value: 6, label: "Thứ 6" },
  { value: 7, label: "Thứ 7" },
  { value: 8, label: "Chủ nhật" },
];

export default function TeachingSchedulePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [availableSchedules, setAvailableSchedules] = useState<AvailableSchedule[]>([]);
  const [studentLimits, setStudentLimits] = useState<StudentLimit[]>([]);
  const [registrationsByStudent, setRegistrationsByStudent] = useState<Record<string, StudentRegistration[]>>({});
  
  const [selectedProxyStudent, setSelectedProxyStudent] = useState<string>("");
  const [proxySelections, setProxySelections] = useState<string[]>([]);
  const [proxySaving, setProxySaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [newShift, setNewShift] = useState({ name: "", start_time: "", end_time: "" });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedProxyStudent) {
      const regs = registrationsByStudent[selectedProxyStudent] || [];
      setProxySelections(regs.map(r => r.available_schedule_id));
    } else {
      setProxySelections([]);
    }
  }, [selectedProxyStudent, registrationsByStudent]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [shiftsRes, availableRes, regsRes, limitsRes] = await Promise.all([
        fetch("/api/admin/shifts"),
        fetch("/api/admin/available-schedules"),
        fetch("/api/admin/schedule-registrations"),
        fetch("/api/admin/student-limits")
      ]);

      if (shiftsRes.ok) setShifts(await shiftsRes.json());
      if (availableRes.ok) setAvailableSchedules(await availableRes.json());
      
      if (regsRes.ok) {
        const regsData = await regsRes.json();
        // regsData is grouped by student_id
        const regMap: Record<string, StudentRegistration[]> = {};
        for (const r of regsData) {
          regMap[r.student_id] = r.registrations;
        }
        setRegistrationsByStudent(regMap);
      }

      if (limitsRes.ok) {
        setStudentLimits(await limitsRes.json());
      }
    } catch (err) {
      console.error(err);
      showMessage("error", "Lỗi khi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 3000);
  };

  const handleAddShift = async () => {
    if (!newShift.name || !newShift.start_time || !newShift.end_time) {
      showMessage("error", "Vui lòng nhập đủ thông tin ca.");
      return;
    }

    try {
      const res = await fetch("/api/admin/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newShift)
      });
      if (res.ok) {
        const added = await res.json();
        setShifts([...shifts, added]);
        setNewShift({ name: "", start_time: "", end_time: "" });
        showMessage("success", "Đã thêm ca học.");
      } else {
        showMessage("error", "Không thể thêm ca học.");
      }
    } catch {
      showMessage("error", "Lỗi kết nối.");
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xoá ca này? Lịch rảnh và đăng ký liên quan sẽ bị xoá.")) return;
    try {
      const res = await fetch(`/api/admin/shifts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setShifts(shifts.filter(s => s.id !== id));
        fetchData(); // reload all to reflect cascade deletes
        showMessage("success", "Đã xoá ca học.");
      } else {
        showMessage("error", "Không thể xoá ca học.");
      }
    } catch {
      showMessage("error", "Lỗi kết nối.");
    }
  };

  const toggleAvailability = (day: number, shiftId: string) => {
    const exists = availableSchedules.some(s => s.day_of_week === day && s.shift_id === shiftId);
    if (exists) {
      setAvailableSchedules(availableSchedules.filter(s => !(s.day_of_week === day && s.shift_id === shiftId)));
    } else {
      setAvailableSchedules([...availableSchedules, { id: "temp", day_of_week: day, shift_id: shiftId }]);
    }
  };

  const handleSaveAvailability = async () => {
    setSaving(true);
    try {
      const payload = availableSchedules.map(s => ({ day_of_week: s.day_of_week, shift_id: s.shift_id }));
      const res = await fetch("/api/admin/available-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules: payload })
      });
      if (res.ok) {
        showMessage("success", "Đã lưu lịch rảnh.");
        fetchData(); // refresh to get real IDs
      } else {
        showMessage("error", "Không thể lưu lịch rảnh.");
      }
    } catch {
      showMessage("error", "Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStudentLimit = async (studentId: string, newMax: number) => {
    if (newMax < 0) return;
    try {
      const res = await fetch("/api/admin/student-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studentId, max_shifts: newMax })
      });
      if (res.ok) {
        setStudentLimits(studentLimits.map(s => s.id === studentId ? { ...s, max_shifts: newMax } : s));
        showMessage("success", "Đã lưu số ca tối đa.");
      } else {
        showMessage("error", "Không thể lưu giới hạn.");
      }
    } catch {
      showMessage("error", "Lỗi kết nối.");
    }
  };

  const handleResetRegistration = async (studentId: string, studentName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn huỷ toàn bộ ca học đã đăng ký của học sinh ${studentName}?`)) return;
    try {
      const res = await fetch(`/api/admin/schedule-registrations?student_id=${studentId}`, { method: "DELETE" });
      if (res.ok) {
        const newRegs = { ...registrationsByStudent };
        delete newRegs[studentId];
        setRegistrationsByStudent(newRegs);
        showMessage("success", `Đã xoá đăng ký của ${studentName}.`);
      } else {
        showMessage("error", "Không thể xoá lịch đăng ký.");
      }
    } catch {
      showMessage("error", "Lỗi kết nối.");
    }
  };

  const toggleProxySelection = (availableScheduleId: string) => {
    if (proxySelections.includes(availableScheduleId)) {
      setProxySelections(proxySelections.filter(id => id !== availableScheduleId));
    } else {
      setProxySelections([...proxySelections, availableScheduleId]);
    }
  };

  const handleSaveProxy = async () => {
    if (!selectedProxyStudent) return;
    setProxySaving(true);
    try {
      const res = await fetch("/api/admin/schedule-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: selectedProxyStudent, scheduleIds: proxySelections })
      });
      if (res.ok) {
        showMessage("success", "Đã lưu đăng ký hộ thành công.");
        fetchData();
      } else {
        const data = await res.json();
        showMessage("error", data.error || "Không thể lưu đăng ký hộ.");
      }
    } catch {
      showMessage("error", "Lỗi kết nối.");
    } finally {
      setProxySaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Clock className="h-6 w-6 text-indigo-600" />
          Đăng ký lịch dạy
        </h1>
        <p className="text-slate-500 mt-1">Quản lý ca học, lịch rảnh và danh sách học sinh đăng ký.</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* 1. Shifts */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" /> Quản lý Ca học
        </h2>
        <div className="space-y-4 max-w-2xl">
          {shifts.map(shift => (
            <div key={shift.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="font-semibold text-slate-800">{shift.name}</span>
                <span className="text-sm text-slate-500 ml-2">({shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)})</span>
              </div>
              <button onClick={() => handleDeleteShift(shift.id)} className="text-red-500 hover:text-red-700 p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 items-center mt-2">
            <input type="text" placeholder="Tên ca (Ca 1)" value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} className="flex-1 min-w-[120px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
            <input type="time" value={newShift.start_time} onChange={e => setNewShift({...newShift, start_time: e.target.value})} className="w-24 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
            <span className="text-slate-400">-</span>
            <input type="time" value={newShift.end_time} onChange={e => setNewShift({...newShift, end_time: e.target.value})} className="w-24 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
            <button onClick={handleAddShift} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Availability Matrix */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-800">Chọn lịch rảnh</h2>
          <button 
            onClick={handleSaveAvailability} 
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu lịch rảnh
          </button>
        </div>

        {shifts.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Chưa có ca học nào. Vui lòng thêm ca học trước.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 rounded-tl-xl w-32">Thứ \ Ca</th>
                {shifts.map(shift => (
                  <th key={shift.id} className="px-4 py-3 border-b border-slate-200 text-center">
                    <div className="font-semibold">{shift.name}</div>
                    <div className="text-xs text-slate-400 font-normal">{shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day.value} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 font-medium text-slate-700">{day.label}</td>
                  {shifts.map(shift => {
                    const isAvailable = availableSchedules.some(s => s.day_of_week === day.value && s.shift_id === shift.id);
                    return (
                      <td key={shift.id} className="px-4 py-3 text-center">
                        <label className="relative flex items-center justify-center cursor-pointer p-2">
                          <input 
                            type="checkbox" 
                            checked={isAvailable}
                            onChange={() => toggleAvailability(day.value, shift.id)}
                            className="sr-only peer"
                          />
                          <div className="w-6 h-6 border-2 border-slate-300 rounded-md peer-checked:bg-indigo-600 peer-checked:border-indigo-600 flex items-center justify-center transition-all">
                            <svg className={`w-4 h-4 text-white ${isAvailable ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} transition-all`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 3. Proxy Registration */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Edit2 className="h-5 w-5" /> Đăng ký hộ lịch cho học sinh
          </h2>
          <select 
            value={selectedProxyStudent} 
            onChange={e => setSelectedProxyStudent(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[250px]"
          >
            <option value="">-- Chọn học sinh --</option>
            {studentLimits.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>

        {selectedProxyStudent ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm font-medium text-slate-600 text-center sm:text-left">
                Đã chọn: <span className="text-indigo-600 font-bold">{proxySelections.length}</span> / {studentLimits.find(s => s.id === selectedProxyStudent)?.max_shifts || 0} ca
              </div>
              <button 
                onClick={handleSaveProxy} 
                disabled={proxySaving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition disabled:opacity-50"
              >
                {proxySaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu đăng ký hộ
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-medium">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200 rounded-tl-xl w-32">Thứ \ Ca</th>
                    {shifts.map(shift => (
                      <th key={shift.id} className="px-4 py-3 border-b border-slate-200 text-center">
                        <div className="font-semibold">{shift.name}</div>
                        <div className="text-xs text-slate-400 font-normal">{shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => (
                    <tr key={day.value} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 font-medium text-slate-700">{day.label}</td>
                      {shifts.map(shift => {
                        const availableSchedule = availableSchedules.find(s => s.day_of_week === day.value && s.shift_id === shift.id);
                        if (!availableSchedule) {
                          return <td key={shift.id} className="px-4 py-3 text-center text-slate-300">-</td>;
                        }

                        // Check if registered by someone else
                        let isLockedByOther = false;
                        for (const [studentId, regs] of Object.entries(registrationsByStudent)) {
                          if (studentId !== selectedProxyStudent && regs.some(r => r.available_schedule_id === availableSchedule.id)) {
                            isLockedByOther = true;
                            break;
                          }
                        }

                        const isSelected = proxySelections.includes(availableSchedule.id);

                        return (
                          <td key={shift.id} className="px-4 py-3 text-center">
                            {isLockedByOther ? (
                              <div className="mx-auto w-6 h-6 rounded-md bg-slate-200 border border-slate-300 flex items-center justify-center cursor-not-allowed" title="Đã có người đăng ký">
                                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                            ) : (
                              <label className="relative flex items-center justify-center cursor-pointer p-2">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => toggleProxySelection(availableSchedule.id)}
                                  className="sr-only peer"
                                />
                                <div className="w-6 h-6 border-2 border-slate-300 rounded-md peer-checked:bg-green-600 peer-checked:border-green-600 flex items-center justify-center transition-all">
                                  <svg className={`w-4 h-4 text-white ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} transition-all`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </label>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">Vui lòng chọn một học sinh ở mục trên để bắt đầu đăng ký hộ.</p>
        )}
      </div>

      {/* 4. Students Limits & Registrations */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" /> Cấu hình giới hạn & Danh sách Học sinh đã đăng ký
        </h2>

        {studentLimits.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Chưa có học sinh nào trên hệ thống.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {studentLimits.map(student => {
              const regs = registrationsByStudent[student.id] || [];
              return (
                <div key={student.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="font-bold text-slate-800 text-base flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {student.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{student.full_name}</span>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-sm font-medium text-slate-600 whitespace-nowrap">Số ca tối đa:</span>
                      <input 
                        type="number"
                        min="0"
                        value={student.max_shifts}
                        onChange={(e) => {
                          const newLimits = studentLimits.map(s => s.id === student.id ? { ...s, max_shifts: Number(e.target.value) } : s);
                          setStudentLimits(newLimits);
                        }}
                        onBlur={(e) => handleUpdateStudentLimit(student.id, Number(e.target.value))}
                        className="w-16 px-2 py-1 text-center font-bold border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        title="Thay đổi sẽ tự động lưu"
                      />
                    </div>
                  </div>
                  
                  {regs.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã đăng ký ({regs.length}/{student.max_shifts})</p>
                        <button 
                          onClick={() => handleResetRegistration(student.id, student.full_name)}
                          className="text-xs flex items-center gap-1 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reset lịch
                        </button>
                      </div>
                      {regs.map(reg => {
                        const dayLabel = DAYS.find(d => d.value === reg.day_of_week)?.label;
                        return (
                          <div key={reg.registration_id} className="flex items-center gap-2 text-sm bg-white border border-slate-100 px-3 py-2 rounded-lg">
                            <span className="font-medium text-indigo-600 w-16">{dayLabel}</span>
                            <span className="text-slate-700">{reg.shift?.name}</span>
                            <span className="text-slate-400 text-xs ml-auto">
                              {reg.shift?.start_time.substring(0,5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Chưa đăng ký ca nào.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
