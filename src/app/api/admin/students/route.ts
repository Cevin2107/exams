import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    return NextResponse.json({ error: "Lỗi lấy danh sách học sinh" }, { status: 500 });
  }

  const students = (data?.users || []).map((user) => ({
    id: user.id,
    full_name: (user.user_metadata?.full_name as string | undefined)?.trim() || user.email || "Không xác định",
    email: user.email || "",
    created_at: user.created_at,
  })).sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));

  return NextResponse.json({ students });
}
