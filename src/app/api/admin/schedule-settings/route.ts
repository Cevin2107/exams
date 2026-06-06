import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("admin_settings")
      .select("max_shifts_per_student")
      .eq("id", 1)
      .single();

    if (error) throw error;
    
    // Default to 3 if not set or row missing
    const anyData = data as any;
    return NextResponse.json({ max_shifts_per_student: anyData?.max_shifts_per_student || 3 });
  } catch (error) {
    console.error("Error fetching schedule settings:", error);
    return NextResponse.json({ max_shifts_per_student: 3 }); // default fallback
  }
}

export async function PUT(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { max_shifts_per_student } = body;

    if (typeof max_shifts_per_student !== 'number') {
      return NextResponse.json({ error: "Invalid value" }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { error } = await (supabaseAdmin.from("admin_settings") as any)
      .update({ max_shifts_per_student })
      .eq("id", 1);

    if (error) throw error;

    return NextResponse.json({ success: true, max_shifts_per_student });
  } catch (error) {
    console.error("Error updating schedule settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
