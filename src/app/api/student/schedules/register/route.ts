import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/googleCalendar";

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

    // Get profile info (name and maxShifts limit)
    const supabaseAdmin = createSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from("student_profiles")
      .select("full_name, max_shifts")
      .eq("id", user.id)
      .single();
    const anyProfile = profile as any;
    const maxShifts = anyProfile?.max_shifts || 3;
    const studentName = anyProfile?.full_name || "Học sinh";

    if (scheduleIds.length > maxShifts) {
      return NextResponse.json({ error: `Bạn chỉ được chọn tối đa ${maxShifts} ca.` }, { status: 400 });
    }

    // Find current registrations for this user
    const { data: currentRegsData, error: currentErr } = await supabaseAdmin
      .from("schedule_registrations")
      .select("id, available_schedule_id, google_calendar_event_id")
      .eq("student_id", user.id);

    if (currentErr) throw currentErr;
    const currentRegs = (currentRegsData || []) as any[];

    const currentMap = new Set(currentRegs.map(r => r.available_schedule_id));
    const newMap = new Set(scheduleIds);

    const toDeleteRegs = currentRegs.filter(r => !newMap.has(r.available_schedule_id));
    const toDeleteIds = toDeleteRegs.map(r => r.id);

    const toInsertIds = scheduleIds.filter(id => !currentMap.has(id));

    // Perform deletions first (including Google Calendar cleanup)
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

    // Perform insertions (including Google Calendar creation)
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
          student_id: user.id,
          google_calendar_event_id: eventId
        });
      }

      const { error: insErr } = await (supabaseAdmin.from("schedule_registrations") as any).insert(toInsert);
        
      if (insErr) {
        // If DB insertion fails, we should ideally roll back/delete the created events, 
        // but since unique constraint is checked, we clean up the created events if there's error.
        for (const item of toInsert) {
          if (item.google_calendar_event_id) {
            try {
              await deleteCalendarEvent(item.google_calendar_event_id);
            } catch (cleanupErr) {
              console.error("Failed to cleanup created event after insertion failure:", cleanupErr);
            }
          }
        }

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
