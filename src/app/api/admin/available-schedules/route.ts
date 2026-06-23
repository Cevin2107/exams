import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteCalendarEvent } from "@/lib/googleCalendar";

export async function GET(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("available_schedules")
      .select("*");

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching available schedules:", error);
    return NextResponse.json({ error: "Failed to fetch available schedules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { schedules } = body as { schedules: { day_of_week: number, shift_id: string }[] };

    if (!Array.isArray(schedules)) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    // Since this is a bulk replace, we first delete all existing schedules.
    // However, if we delete them, it will CASCADE delete the student registrations!
    // We should be careful. A better approach is to compare and only delete/insert what's changed.
    
    // Get existing schedules
    const supabaseAdmin = createSupabaseAdmin();
    const { data: existingSchedulesData, error: getErr } = await supabaseAdmin
      .from("available_schedules")
      .select("*");
      
    if (getErr) throw getErr;
    const existingSchedules = (existingSchedulesData || []) as any[];

    const existingMap = new Set(existingSchedules.map(s => `${s.day_of_week}-${s.shift_id}`));
    const newMap = new Set(schedules.map(s => `${s.day_of_week}-${s.shift_id}`));

    const toInsert = schedules.filter(s => !existingMap.has(`${s.day_of_week}-${s.shift_id}`));
    const toDeleteIds = existingSchedules.filter(s => !newMap.has(`${s.day_of_week}-${s.shift_id}`)).map(s => s.id);

    // Perform deletions
    if (toDeleteIds.length > 0) {
      // Find all schedule_registrations that will be cascade-deleted
      const { data: regsToDelete, error: fetchErr } = await supabaseAdmin
        .from("schedule_registrations")
        .select("id, google_calendar_event_id")
        .in("available_schedule_id", toDeleteIds);

      if (!fetchErr && regsToDelete && regsToDelete.length > 0) {
        for (const reg of regsToDelete as any[]) {
          if (reg.google_calendar_event_id) {
            try {
              await deleteCalendarEvent(reg.google_calendar_event_id);
            } catch (calErr) {
              console.error(`Failed to delete calendar event for registration ${reg.id} on available schedule delete:`, calErr);
            }
          }
        }
      }

      const { error: delErr } = await supabaseAdmin
        .from("available_schedules")
        .delete()
        .in("id", toDeleteIds);
      if (delErr) throw delErr;
    }

    // Perform insertions
    if (toInsert.length > 0) {
      const { error: insErr } = await (supabaseAdmin.from("available_schedules") as any).insert(toInsert);
      if (insErr) throw insErr;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving available schedules:", error);
    return NextResponse.json({ error: "Failed to save available schedules" }, { status: 500 });
  }
}
