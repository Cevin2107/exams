'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email.trim()) {
      setError('Vui lòng nhập email');
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    addToast({
      title: 'Đã gửi email!',
      description: 'Vui lòng kiểm tra hộp thư để đặt lại mật khẩu.',
      variant: 'success',
      duration: 5000,
    });
  };

  if (sent) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="rounded-2xl bg-white/80 backdrop-blur-lg border border-white/80 shadow-xl p-6 sm:p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Kiểm tra email của bạn</h1>
            <p className="text-sm text-slate-600 mt-2">
              Chúng tôi đã gửi link đặt lại mật khẩu đến <strong>{email}</strong>. Vui lòng kiểm tra hộp thư.
            </p>
            <div className="mt-6">
              <Link href="/login">
                <Button variant="secondary" className="w-full">
                  Quay lại đăng nhập
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="rounded-2xl bg-white/80 backdrop-blur-lg border border-white/80 shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7.5a5.5 5.5 0 00-9.2 3.8 3.5 3.5 0 002.2 6.7h1.5m9-6.5a5.5 5.5 0 01-9.2 3.8 3.5 3.5 0 01-2.2-6.7h-1.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Quên mật khẩu?</h1>
            <p className="text-sm text-slate-600 mt-1">Nhập email để nhận link đặt lại mật khẩu</p>
          </div>

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-base transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="brand"
              className="w-full"
              disabled={loading}
              loading={loading}
            >
              Gửi link đặt lại mật khẩu
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-indigo-600 hover:text-indigo-500 transition">
              ← Quay lại đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
