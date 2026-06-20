"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut, CalendarPlus } from "lucide-react";

export function HeaderBar({ studentName }: { studentName?: string }) {
  const [greeting, setGreeting] = useState("");
  const [greetingEmoji, setGreetingEmoji] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) { setGreeting("Chào buổi sáng"); setGreetingEmoji("🌤️"); }
    else if (hour < 18) { setGreeting("Chào buổi chiều"); setGreetingEmoji("☀️"); }
    else { setGreeting("Chào buổi tối"); setGreetingEmoji("🌙"); }
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const { createSupabaseBrowserClient } = await import("@/lib/supabaseClient");
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
    }
  };

  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith('/admin');

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800 bg-white/95 dark:bg-[#0B1120]/80 shadow-sm backdrop-blur-md transition-colors duration-500">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3" suppressHydrationWarning>
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-85 transition-opacity" suppressHydrationWarning>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 dark:bg-indigo-500">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div suppressHydrationWarning>
            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Gia sư Đào Bá Anh Quân</p>
            {greeting && (
              <p className="text-xs text-slate-400 leading-tight">
                {greetingEmoji} {greeting}{studentName ? `, ${studentName}` : ''}
              </p>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {/* Hide theme toggle on admin pages */}
          {!isAdminPath && <ThemeToggle />}
          
          {pathname === "/register-schedule" ? (
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-400"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Về trang chủ</span>
            </Link>
          ) : (
            <Link
              href="/register-schedule"
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 transition hover:border-indigo-300 dark:hover:border-indigo-500/70 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Đăng ký lịch học</span>
            </Link>
          )}

          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-400"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Quản lý
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-700/50 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 transition hover:border-red-300 dark:hover:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
            title="Đăng xuất"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
}
