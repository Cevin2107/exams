'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { addToast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!fullName.trim()) {
      setError('Vui lòng nhập họ và tên');
      setLoading(false);
      return;
    }
    if (!email.trim()) {
      setError('Vui lòng nhập email');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    addToast({
      title: 'Đăng ký thành công!',
      description: 'Vui lòng đăng nhập để tiếp tục.',
      variant: 'success',
      duration: 3000,
    });
    router.push('/login');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="rounded-2xl bg-white/80 backdrop-blur-lg border border-white/80 shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Đăng ký tài khoản</h1>
            <p className="text-sm text-slate-600 mt-1">Tạo tài khoản để làm bài tập</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-base transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email <span className="text-red-500">*</span>
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
                Mật khẩu <span className="text-red-500">*</span>
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
              <p className="mt-1 text-xs text-slate-500">Mật khẩu phải có ít nhất 6 ký tự</p>
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
              Đăng ký
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-600">Đã có tài khoản?</span>{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Đăng nhập ngay
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
