"use client";

import { ThemeToggle } from "@/components/ThemeToggle";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  GraduationCap,
  Users,
  Settings,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Tổng quan", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Bài tập", href: "/admin/assignments", icon: GraduationCap },
  { name: "Học sinh", href: "/admin/stats", icon: Users },
  { name: "Cài đặt", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen flex flex-col border-r border-white/60 bg-white/80 backdrop-blur-xl shadow-2xl shadow-slate-200/50 transition-all duration-300",
          isCollapsed ? "w-20 translate-x-0" : "w-64 translate-x-0"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-white/40 px-3">
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex w-full items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-white hover:text-slate-900"
            aria-label={isCollapsed ? "Mo rong thanh ben" : "Thu gon thanh ben"}
            title={isCollapsed ? "Mo rong thanh ben" : "Thu gon thanh ben"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className={cn("flex h-16 shrink-0 items-center border-b border-white/40", isCollapsed ? "justify-center px-2" : "justify-between px-4")}>
          <Link href="/admin/dashboard" className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 flex-shrink-0">
                <GraduationCap className="h-5 w-5" />
              </div>
            </div>
            <div className={cn("min-w-0", isCollapsed && "hidden")}>
              <h1 className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent leading-tight truncate">Tutor Admin</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Workspace</p>
            </div>
          </Link>
          {!isCollapsed && <div className="hidden lg:block"><ThemeToggle /></div>}
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
                  "flex items-center rounded-2xl px-3 py-3 text-sm font-semibold transition-all",
                  isCollapsed ? "justify-center" : "gap-3",
                  isActive
                    ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30"
                    : "text-slate-600 hover:bg-slate-50/80 hover:backdrop-blur-sm hover:text-slate-900"
                )}
              >
                <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-white" : "text-slate-400")} />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer Nav */}
        <div className="shrink-0 border-t border-white/40 p-3 flex flex-col gap-2">
          <div className="lg:hidden flex justify-center w-full mb-2">
            <ThemeToggle />
          </div>
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className={cn(
                "flex w-full items-center rounded-2xl px-3 py-3 text-sm font-semibold text-slate-600 transition-all hover:bg-red-50/80 hover:backdrop-blur-sm hover:text-red-700",
                isCollapsed ? "justify-center" : "gap-3"
              )}
            >
              <LogOut className="h-5 w-5 text-slate-400 flex-shrink-0" />
              {!isCollapsed && <span>Đăng xuất</span>}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
