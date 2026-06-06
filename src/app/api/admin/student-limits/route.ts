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
      .from("student_profiles")
      .select("id, full_name, max_shifts")
      .order("full_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching student limits:", error);
    return NextResponse.json({ error: "Failed to fetch student limits" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, max_shifts } = body;

    if (!id || typeof max_shifts !== 'number') {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { error } = await (supabaseAdmin.from("student_profiles") as any)
      .update({ max_shifts })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating student limit:", error);
    return NextResponse.json({ error: "Failed to update student limit" }, { status: 500 });
  }
}
