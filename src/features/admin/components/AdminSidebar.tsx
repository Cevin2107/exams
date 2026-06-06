"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  GraduationCap,
  Users,
  Settings,
  CalendarDays,
  LogOut,
  Menu,
  X,
  Clock,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Tổng quan", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Bài tập", href: "/admin/assignments", icon: GraduationCap },
  { name: "Lịch dạy", href: "/admin/schedule", icon: CalendarDays },
  { name: "Đăng ký lịch dạy", href: "/admin/teaching-schedule", icon: Clock },
  { name: "Học sinh", href: "/admin/stats", icon: Users },
  { name: "Cài đặt", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    if (typeof window !== "undefined") {
      checkDesktop();
      window.addEventListener("resize", checkDesktop);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", checkDesktop);
      }
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // ─── MOBILE: Bottom Tab Bar + Slide-over Drawer ────
  if (!isDesktop) {
    return (
      <>
        {/* Bottom Tab Bar – luôn hiển thị trên mobile */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex items-stretch justify-around">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[10px] font-semibold transition-colors relative",
                    isActive
                      ? "text-indigo-600"
                      : "text-slate-400 active:text-slate-600"
                  )}
                >
                  {isActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-indigo-600" />
                  )}
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform",
                      isActive ? "text-indigo-600 scale-110" : "text-slate-400"
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
            {/* More button for drawer */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[10px] font-semibold text-slate-400 active:text-slate-600 transition-colors"
            >
              <Menu className="h-5 w-5" />
              <span>Menu</span>
            </button>
          </div>
        </nav>

        {/* Slide-over Drawer */}
        {isMobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 z-[70] w-72 flex flex-col bg-white/95 backdrop-blur-2xl shadow-2xl border-l border-slate-200/60 animate-slide-in-right">
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Tutor Admin</h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Workspace</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drawer Nav */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all",
                        isActive
                          ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30"
                          : "text-slate-600 hover:bg-slate-50 active:bg-slate-100"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-white" : "text-slate-400")} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Drawer Footer */}
              <div className="border-t border-slate-100 p-3 space-y-2">
                  {/* Theme toggle removed for admin UI */}
                <form action="/api/admin/logout" method="POST">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 active:bg-red-100"
                  >
                    <LogOut className="h-5 w-5 flex-shrink-0" />
                    <span>Đăng xuất</span>
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // ─── DESKTOP: Classic Sticky Sidebar ────
  return (
    <aside className="sticky top-0 left-0 z-40 h-screen w-64 flex flex-col border-r border-white/60 bg-white/80 backdrop-blur-xl shadow-2xl shadow-slate-200/50">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/40 px-4">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 flex-shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent leading-tight truncate">Tutor Admin</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Workspace</p>
          </div>
        </Link>
        {/* Theme toggle removed for admin UI */}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-all",
                isActive
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30"
                  : "text-slate-600 hover:bg-slate-50/80 hover:backdrop-blur-sm hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-white" : "text-slate-400")} />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Nav */}
      <div className="shrink-0 border-t border-white/40 p-3">
        <form action="/api/admin/logout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-600 transition-all hover:bg-red-50/80 hover:text-red-700"
          >
            <LogOut className="h-5 w-5 text-slate-400 flex-shrink-0" />
            <span>Đăng xuất</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
