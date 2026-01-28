import { checkAdminAuth, logoutAdmin } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { fetchAllAssignmentsAdmin } from "@/lib/supabaseHelpers";
import DatabaseSizeCard from "@/components/DatabaseSizeCard";

// Disable caching để luôn hiển thị dữ liệu mới nhất
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) redirect("/admin");

  const assignments = await fetchAllAssignmentsAdmin();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Admin Dashboard</h1>
            <p className="text-sm text-slate-600">Quản lý bài tập</p>
          </div>
          <div className="flex gap-3">
            <Link href="/" className="text-sm text-slate-600 hover:text-slate-800">
              Xem trang học sinh
            </Link>
            <form action={logoutAdmin}>
              <button className="text-sm text-red-600 hover:text-red-800">Đăng xuất</button>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* Database size card */}
        <DatabaseSizeCard />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Danh sách bài tập</h2>
          <div className="flex gap-3">
            <Link
              href="/admin/stats"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              📊 Thống kê học sinh
            </Link>
            <Link
              href="/admin/assignments/new"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              + Tạo bài tập mới
            </Link>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">Chưa có bài tập nào. Tạo bài tập đầu tiên!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <h3 className="font-semibold text-slate-900">{a.title}</h3>
                  <p className="text-sm text-slate-600">
                    {a.subject} · {a.grade} · {a.total_score} điểm
                    {a.is_hidden && <span className="ml-2 text-red-600">(Ẩn)</span>}
                  </p>
                </div>
                <Link
                  href={`/admin/assignments/${a.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400"
                >
                  Chi tiết
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
