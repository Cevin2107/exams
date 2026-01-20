import { HeaderBar } from "@/components/HeaderBar";
import { AssignmentList } from "@/components/AssignmentList";
import { fetchAssignmentsWithHistory } from "@/lib/supabaseHelpers";

// Disable caching để luôn hiển thị dữ liệu mới nhất
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const assignments = await fetchAssignmentsWithHistory();

  return (
    <main className="min-h-screen bg-slate-50">
      <HeaderBar />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8" suppressHydrationWarning>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" suppressHydrationWarning>
          <h2 className="text-lg font-semibold text-slate-900">Danh sách bài tập</h2>
          <p className="text-sm text-slate-600">Học sinh cần hoàn thành bài tập, bài kiểm tra đúng hạn. Được phép làm lại và luyện tập lại nhiều lần.</p>
        </div>
        <AssignmentList assignments={assignments} />
      </div>
    </main>
  );
}
