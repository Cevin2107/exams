import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteCalendarEvent } from "@/lib/googleCalendar";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, start_time, end_time } = body;

    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await (supabaseAdmin.from("shifts") as any)
      .update({ name, start_time, end_time })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating shift:", error);
    return NextResponse.json({ error: "Failed to update shift" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const supabaseAdmin = createSupabaseAdmin();

    // 1. Find all available schedules for this shift
    const { data: availScheds, error: fetchSchedErr } = await supabaseAdmin
      .from("available_schedules")
      .select("id")
      .eq("shift_id", id);

    if (!fetchSchedErr && availScheds && availScheds.length > 0) {
      const availSchedIds = (availScheds as any[]).map(s => s.id);
      
      // 2. Find all registrations that will be cascade-deleted
      const { data: regsToDelete, error: fetchRegsErr } = await supabaseAdmin
        .from("schedule_registrations")
        .select("id, google_calendar_event_id")
        .in("available_schedule_id", availSchedIds);

      if (!fetchRegsErr && regsToDelete && regsToDelete.length > 0) {
        for (const reg of regsToDelete as any[]) {
          if (reg.google_calendar_event_id) {
            try {
              await deleteCalendarEvent(reg.google_calendar_event_id);
            } catch (calErr) {
              console.error(`Failed to delete calendar event for registration ${reg.id} on shift delete:`, calErr);
            }
          }
        }
      }
    }

    // 3. Now delete the shift (Supabase will automatically cascade delete from available_schedules and schedule_registrations due to foreign keys)
    const { error } = await supabaseAdmin
      .from("shifts")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shift:", error);
    return NextResponse.json({ error: "Failed to delete shift" }, { status: 500 });
  }
}
