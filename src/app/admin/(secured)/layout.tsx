import { checkAdminAuth } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    redirect("/admin");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 relative">
      {/* Soft background elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-200/20 to-indigo-200/15 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-violet-200/20 to-purple-200/15 blur-[120px]" />
      </div>
      
      <AdminSidebar />
      <main className="flex-1 overflow-auto relative">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
