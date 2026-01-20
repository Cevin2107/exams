"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function HeaderBar() {
  const [greeting, setGreeting] = useState("Xin chào");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Chào buổi sáng");
    else if (hour < 18) setGreeting("Chào buổi chiều");
    else setGreeting("Chào buổi tối");
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gia sư Đào Bá Anh Quân</p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Quản lý
        </Link>
      </div>
    </header>
  );
}
