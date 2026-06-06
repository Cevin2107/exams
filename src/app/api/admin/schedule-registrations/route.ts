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
      .from("schedule_registrations")
      .select(`
        id,
        created_at,
        student_id,
        student_profiles (
          full_name
        ),
        available_schedules (
          id,
          day_of_week,
          shifts (
            id,
            name,
            start_time,
            end_time
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Format the response to group by student
    const grouped: Record<string, any> = {};
    
    data.forEach((reg: any) => {
      const studentId = reg.student_id;
      if (!grouped[studentId]) {
        grouped[studentId] = {
          student_id: studentId,
          full_name: reg.student_profiles?.full_name || "Unknown Student",
          registrations: []
        };
      }
      grouped[studentId].registrations.push({
        registration_id: reg.id,
        available_schedule_id: reg.available_schedules?.id,
        day_of_week: reg.available_schedules?.day_of_week,
        shift: reg.available_schedules?.shifts
      });
    });

    return NextResponse.json(Object.values(grouped));
  } catch (error) {
    console.error("Error fetching schedule registrations:", error);
    return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("student_id");

    const supabaseAdmin = createSupabaseAdmin();
    
    let query = supabaseAdmin.from("schedule_registrations").delete();
    
    if (studentId) {
      query = query.eq("student_id", studentId);
    } else {
      // Must have some condition to delete all, or not eq at all works for Supabase.
      // But Supabase requires a filter for delete unless we specify we want to delete all.
      // To delete all, we can just filter by id is not null.
      query = query.not("id", "is", null);
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting schedule registrations:", error);
    return NextResponse.json({ error: "Failed to delete registrations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { student_id, scheduleIds } = body as { student_id: string, scheduleIds: string[] };

    if (!student_id || !Array.isArray(scheduleIds)) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    
    // 1. Check max_shifts for the student
    const { data: profile } = await supabaseAdmin
      .from("student_profiles")
      .select("max_shifts")
      .eq("id", student_id)
      .single();
    
    const anyProfile = profile as any;
    const maxShifts = anyProfile?.max_shifts || 3;

    if (scheduleIds.length > maxShifts) {
      return NextResponse.json({ error: `Học sinh này chỉ được chọn tối đa ${maxShifts} ca.` }, { status: 400 });
    }

    // 2. Find current registrations for this student
    const { data: currentRegsData, error: currentErr } = await supabaseAdmin
      .from("schedule_registrations")
      .select("id, available_schedule_id")
      .eq("student_id", student_id);

    if (currentErr) throw currentErr;
    const currentRegs = (currentRegsData || []) as any[];

    const currentMap = new Set(currentRegs.map(r => r.available_schedule_id));
    const newMap = new Set(scheduleIds);

    const toInsert = scheduleIds.filter(id => !currentMap.has(id)).map(id => ({
      available_schedule_id: id,
      student_id: student_id
    }));
    
    const toDeleteIds = currentRegs.filter(r => !newMap.has(r.available_schedule_id)).map(r => r.id);

    // 3. Perform deletions first
    if (toDeleteIds.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("schedule_registrations")
        .delete()
        .in("id", toDeleteIds);
      if (delErr) throw delErr;
    }

    // 4. Perform insertions
    if (toInsert.length > 0) {
      const { error: insErr } = await (supabaseAdmin.from("schedule_registrations") as any).insert(toInsert);
        
      if (insErr) {
        if (insErr.code === '23505') {
          return NextResponse.json({ error: "Một trong các ca bạn chọn đã bị học sinh khác đăng ký." }, { status: 409 });
        }
        throw insErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error proxy saving student registrations:", error);
    return NextResponse.json({ error: "Failed to save registrations" }, { status: 500 });
  }
}
