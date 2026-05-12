'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  useEffect(() => {
    // Check if we have a hash fragment from Supabase
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) {
      addToast({
        title: 'Link không hợp lệ',
        description: 'Vui lòng yêu cầu gửi lại link đặt lại mật khẩu.',
        variant: 'error',
        duration: 5000,
      });
      router.push('/forgot-password');
    }
  }, [router, addToast]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    addToast({
      title: 'Đặt lại mật khẩu thành công!',
      description: 'Vui lòng đăng nhập với mật khẩu mới.',
      variant: 'success',
      duration: 3000,
    });
    setTimeout(() => router.push('/login'), 2000);
  };

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="rounded-2xl bg-white/80 backdrop-blur-lg border border-white/80 shadow-xl p-6 sm:p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Đặt lại mật khẩu thành công!</h1>
            <p className="text-sm text-slate-600 mt-2">Đang chuyển hướng đến trang đăng nhập...</p>
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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7.5a5.5 5.5 0 00-9.2 3.8 3.5 3.5 0 002.2 6.7h1.5m9-6.5a5.5 5.5 0 01-9.2 3.8 3.5 3.5 0 01-2.2-6.7h-1.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Đặt lại mật khẩu</h1>
            <p className="text-sm text-slate-600 mt-1">Tạo mật khẩu mới cho tài khoản của bạn</p>
          </div>

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Mật khẩu mới
              </label>
              <input
                id="password"
                type="password"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-base transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <p className="mt-1 text-xs text-slate-500">Phải có ít nhất 6 ký tự</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-700">
                Xác nhận mật khẩu
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-base transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              Đặt lại mật khẩu
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
