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
    <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <p className="text-sm text-slate-500">Gia sư Đào Bá Anh Quân</p>
          <h1 className="text-xl font-semibold text-slate-900">{greeting}</h1>
        </div>
        <Link
          href="/admin"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
        >
          Vào chế độ Admin
        </Link>
      </div>
    </header>
  );
}
