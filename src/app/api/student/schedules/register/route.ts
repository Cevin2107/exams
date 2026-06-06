import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {}
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { scheduleIds } = body as { scheduleIds: string[] };

    if (!Array.isArray(scheduleIds)) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    // Get maxShifts limit from profile
    const supabaseAdmin = createSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from("student_profiles")
      .select("max_shifts")
      .eq("id", user.id)
      .single();
    const anyProfile = profile as any;
    const maxShifts = anyProfile?.max_shifts || 3;

    if (scheduleIds.length > maxShifts) {
      return NextResponse.json({ error: `Bạn chỉ được chọn tối đa ${maxShifts} ca.` }, { status: 400 });
    }

    // Find current registrations for this user
    const { data: currentRegsData, error: currentErr } = await supabaseAdmin
      .from("schedule_registrations")
      .select("id, available_schedule_id")
      .eq("student_id", user.id);

    if (currentErr) throw currentErr;
    const currentRegs = (currentRegsData || []) as any[];

    const currentMap = new Set(currentRegs.map(r => r.available_schedule_id));
    const newMap = new Set(scheduleIds);

    const toInsert = scheduleIds.filter(id => !currentMap.has(id)).map(id => ({
      available_schedule_id: id,
      student_id: user.id
    }));
    
    const toDeleteIds = currentRegs.filter(r => !newMap.has(r.available_schedule_id)).map(r => r.id);

    // Perform deletions first
    if (toDeleteIds.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("schedule_registrations")
        .delete()
        .in("id", toDeleteIds);
      if (delErr) throw delErr;
    }

    // Perform insertions
    if (toInsert.length > 0) {
      const { error: insErr } = await (supabaseAdmin.from("schedule_registrations") as any).insert(toInsert);
        
      if (insErr) {
        // Check for unique constraint violation (code 23505 usually in Postgres)
        if (insErr.code === '23505') {
          return NextResponse.json({ error: "Một trong các ca bạn chọn đã bị học sinh khác đăng ký. Vui lòng tải lại trang và chọn ca khác." }, { status: 409 });
        }
        throw insErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving student registrations:", error);
    return NextResponse.json({ error: "Failed to save registrations" }, { status: 500 });
  }
}
