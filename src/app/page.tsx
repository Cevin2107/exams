import { HeaderBar } from "@/components/HeaderBar";
import { AssignmentList } from "@/components/AssignmentList";
import { fetchAssignmentsWithHistory } from "@/lib/supabaseHelpers";

// Disable caching để luôn hiển thị dữ liệu mới nhất
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const assignments = await fetchAssignmentsWithHistory();

  const total = assignments.length;
  const done = assignments.filter(a => a.latestSubmission).length;
  const pending = total - done;

  return (
    <main className="min-h-screen bg-slate-50">
      <HeaderBar />

      {/* Hero */}
      <div className="bg-indigo-600 relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white opacity-[0.04]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-white/10" />
        <div className="relative mx-auto max-w-5xl px-4 pb-9 pt-8">
          <h2 className="text-2xl font-bold text-white">Danh sách bài tập</h2>
          <p className="mt-1 text-sm text-indigo-300">Hoàn thành đúng hạn &bull; Được làm lại nhiều lần</p>

          <div className="mt-6 flex flex-wrap items-start gap-6">
            {[
              { value: total, label: "Tổng bài" },
              { value: done, label: "Đã hoàn thành" },
              { value: pending, label: "Còn chưa làm" },
            ].map((s, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span className="text-4xl font-black tabular-nums text-white">{s.value}</span>
                <span className="text-sm text-indigo-300">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6" suppressHydrationWarning>
        <AssignmentList assignments={assignments} />
      </div>
    </main>
  );
}
