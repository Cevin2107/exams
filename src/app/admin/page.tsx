"use client";

import { loginAdmin } from "@/lib/adminAuth";
import { useState } from "react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await loginAdmin(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Vào chế độ Admin</h1>
          <p className="text-sm text-slate-600">Nhập mật khẩu admin để tiếp tục.</p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <input
              type="password"
              name="password"
              placeholder="Mật khẩu admin"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-slate-400 focus:outline-none"
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              Đăng nhập
            </button>
          </form>
        </div>
        <Link href="/" className="text-center text-sm text-slate-600 hover:text-slate-800">
          ← Quay lại trang học sinh
        </Link>
      </div>
    </main>
  );
}
