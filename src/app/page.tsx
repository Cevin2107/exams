import { HeaderBar } from "@/components/HeaderBar";
import { AssignmentList } from "@/components/AssignmentList";
import { fetchAssignmentsWithHistory } from "@/lib/supabaseHelpers";
import type { Metadata } from "next";

// Disable caching để luôn hiển thị dữ liệu mới nhất
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Danh sách bài tập - Gia sư Đào Bá Anh Quân",
  description: "Xem và làm bài tập trực tuyến. Hoàn thành đúng hạn, được làm lại nhiều lần, tự động lưu nháp.",
  openGraph: {
    title: "Danh sách bài tập - Gia sư Đào Bá Anh Quân",
    description: "Xem và làm bài tập trực tuyến. Hoàn thành đúng hạn, được làm lại nhiều lần.",
    siteName: "Gia sư Đào Bá Anh Quân",
  },
};

export default async function HomePage() {
  const assignments = await fetchAssignmentsWithHistory();

  return (
    <main className="min-h-screen transition-colors duration-500 bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 dark:from-[#0B1120] dark:via-[#0B1120] dark:to-[#111827] relative">
      {/* Soft background elements (Light) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden dark:hidden">
        <div className="absolute -top-40 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-200/20 to-indigo-200/15 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-violet-200/20 to-purple-200/15 blur-[120px]" />
      </div>
      
      {/* Soft background elements (Dark) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden hidden dark:block">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-900/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <HeaderBar />

      {/* Hero Section - Glassmorphic */}
      <div className="relative">
        <div className="container-custom relative py-6 md:py-10">
          <div className="mx-auto max-w-4xl">
            {/* Brand Title - Prominent */}
            <div className="text-center mb-2">
              <div className="mb-6 relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                <h1 className="relative text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.15]">
                  <span className="inline-block bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-500 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] drop-shadow-sm whitespace-normal sm:whitespace-nowrap pb-2">
                    Gia sư Đào Bá Anh Quân
                  </span>
                </h1>
                <div className="mt-2 sm:mt-4 h-1.5 w-32 sm:w-48 mx-auto rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 shadow-lg shadow-indigo-500/30" />
              </div>
              
              <div className="mb-4 inline-flex px-4 py-1.5 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/80 dark:border-slate-700 shadow-lg">
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                  Hệ thống bài tập trực tuyến
                </span>
              </div>
              
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
                Danh sách bài tập
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base md:text-lg max-w-2xl mx-auto px-4">
                Hoàn thành đúng hạn · Được làm lại nhiều lần · Tự động lưu nháp
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-custom py-0 md:py-1 relative" suppressHydrationWarning>
        <AssignmentList assignments={assignments} />
      </div>
    </main>
  );
}
