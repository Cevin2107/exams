import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/googleCalendar";

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
    
    // 1. Fetch registrations to get their google_calendar_event_id before deleting
    let selectQuery = supabaseAdmin.from("schedule_registrations").select("id, google_calendar_event_id");
    if (studentId) {
      selectQuery = selectQuery.eq("student_id", studentId);
    }
    const { data: regsToDelete, error: fetchErr } = await selectQuery;
    if (fetchErr) throw fetchErr;

    // 2. Delete events from Google Calendar
    if (regsToDelete && regsToDelete.length > 0) {
      for (const reg of regsToDelete as any[]) {
        if (reg.google_calendar_event_id) {
          try {
            await deleteCalendarEvent(reg.google_calendar_event_id);
          } catch (calErr) {
            console.error(`Failed to delete calendar event for registration ${reg.id}:`, calErr);
          }
        }
      }
    }

    // 3. Delete from Supabase
    let query = supabaseAdmin.from("schedule_registrations").delete();
    
    if (studentId) {
      query = query.eq("student_id", studentId);
    } else {
      // Must have some condition to delete all, or not eq at all works for Supabase.
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
    
    // 1. Check max_shifts and get full_name for the student
    const { data: profile } = await supabaseAdmin
      .from("student_profiles")
      .select("full_name, max_shifts")
      .eq("id", student_id)
      .single();
    
    const anyProfile = profile as any;
    const maxShifts = anyProfile?.max_shifts || 3;
    const studentName = anyProfile?.full_name || "Học sinh";

    if (scheduleIds.length > maxShifts) {
      return NextResponse.json({ error: `Học sinh này chỉ được chọn tối đa ${maxShifts} ca.` }, { status: 400 });
    }

    // 2. Find current registrations for this student
    const { data: currentRegsData, error: currentErr } = await supabaseAdmin
      .from("schedule_registrations")
      .select("id, available_schedule_id, google_calendar_event_id")
      .eq("student_id", student_id);

    if (currentErr) throw currentErr;
    const currentRegs = (currentRegsData || []) as any[];

    const currentMap = new Set(currentRegs.map(r => r.available_schedule_id));
    const newMap = new Set(scheduleIds);

    const toDeleteRegs = currentRegs.filter(r => !newMap.has(r.available_schedule_id));
    const toDeleteIds = toDeleteRegs.map(r => r.id);

    const toInsertIds = scheduleIds.filter(id => !currentMap.has(id));

    // 3. Perform deletions first (including Google Calendar cleanup)
    if (toDeleteIds.length > 0) {
      for (const reg of toDeleteRegs) {
        if (reg.google_calendar_event_id) {
          try {
            await deleteCalendarEvent(reg.google_calendar_event_id);
          } catch (calErr) {
            console.error(`Failed to delete calendar event for registration ${reg.id}:`, calErr);
          }
        }
      }

      const { error: delErr } = await supabaseAdmin
        .from("schedule_registrations")
        .delete()
        .in("id", toDeleteIds);
      if (delErr) throw delErr;
    }

    // 4. Perform insertions (including Google Calendar creation)
    if (toInsertIds.length > 0) {
      const { data: schedDetails, error: schedErr } = await supabaseAdmin
        .from("available_schedules")
        .select(`
          id,
          day_of_week,
          shifts (
            name,
            start_time,
            end_time
          )
        `)
        .in("id", toInsertIds);

      if (schedErr) throw schedErr;

      const toInsert = [];
      for (const sched of (schedDetails || []) as any[]) {
        const shift = sched.shifts;
        let eventId: string | null = null;
        if (shift) {
          eventId = await createCalendarEvent(
            studentName,
            sched.day_of_week,
            shift.name,
            shift.start_time,
            shift.end_time
          );
        }
        toInsert.push({
          available_schedule_id: sched.id,
          student_id: student_id,
          google_calendar_event_id: eventId
        });
      }

      const { error: insErr } = await (supabaseAdmin.from("schedule_registrations") as any).insert(toInsert);
        
      if (insErr) {
        // Cleanup created events on database error
        for (const item of toInsert) {
          if (item.google_calendar_event_id) {
            try {
              await deleteCalendarEvent(item.google_calendar_event_id);
            } catch (cleanupErr) {
              console.error("Failed to cleanup created event after insertion failure:", cleanupErr);
            }
          }
        }

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
