import { createClient, SupabaseClient } from "@supabase/supabase-js";

const getEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase URL hoặc anon key chưa được cấu hình.");
  }
  return { url, anonKey };
};

import { createBrowserClient } from "@supabase/ssr";

// Browser client (cho use client components)
export const createSupabaseBrowserClient = () => {
  const { url, anonKey } = getEnv();
  return createBrowserClient(url, anonKey);
};

// Server client (dùng trong server components và API routes)
// Không dùng cookies ở đây - để middleware xử lý
export const createSupabaseServerClient = (): SupabaseClient => {
  const { url, anonKey } = getEnv();
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};
