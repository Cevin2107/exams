'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { addToast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email.trim()) {
      setError('Vui lòng nhập email');
      setLoading(false);
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu');
      setLoading(false);
      return;
    }

    const { createBrowserClient } = await import('@supabase/ssr');
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: {
          maxAge: rememberMe ? 365 * 24 * 60 * 60 : undefined, // 1 year or Session
        }
      }
    );

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    addToast({
      title: 'Đăng nhập thành công!',
      description: 'Chào mừng bạn quay trở lại.',
      variant: 'success',
      duration: 3000,
    });
    router.push('/');
    router.refresh(); // Refresh to update server components with new auth state
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="rounded-2xl bg-white/80 backdrop-blur-lg border border-white/80 shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Đăng nhập</h1>
            <p className="text-sm text-slate-600 mt-1">Đăng nhập để làm bài tập</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 pr-12 text-base transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
                  disabled={loading}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-slate-700 font-medium">
                Luôn giữ tôi đăng nhập
              </label>
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
              Đăng nhập
            </Button>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="w-full text-center text-sm text-indigo-600 hover:text-indigo-500 transition"
            >
              Quên mật khẩu?
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-600">Chưa có tài khoản?</span>{' '}
            <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
              Đăng ký ngay
            </Link>
          </div>

          <div className="mt-4">
            <Link
              href="/admin"
              className="flex w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              Đăng nhập dưới quyền quản trị
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
