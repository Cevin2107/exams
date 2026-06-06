import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
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
    const supabaseAdmin = createSupabaseAdmin();
    // 1. Fetch settings (max_shifts from student_profiles)
    const { data: profile } = await supabaseAdmin
      .from("student_profiles")
      .select("max_shifts")
      .eq("id", user.id)
      .single();
    
    const anyProfile = profile as any;
    const maxShifts = anyProfile?.max_shifts || 3;

    // 2. Fetch all shifts
    const { data: shifts } = await supabaseAdmin
      .from("shifts")
      .select("*")
      .order("start_time", { ascending: true });

    // 3. Fetch all available schedules
    const { data: availableSchedules } = await supabaseAdmin
      .from("available_schedules")
      .select("*");

    // 4. Fetch registrations to see what's locked and what's selected by the user
    const { data: registrationsData } = await supabaseAdmin
      .from("schedule_registrations")
      .select("student_id, available_schedule_id");

    const registrations = (registrationsData || []) as any[];

    const myRegistrations = registrations
      .filter((r) => r.student_id === user.id)
      .map((r) => r.available_schedule_id);

    const lockedSchedules = registrations
      .filter((r) => r.student_id !== user.id)
      .map((r) => r.available_schedule_id);

    return NextResponse.json({
      maxShifts,
      shifts: shifts || [],
      availableSchedules: availableSchedules || [],
      myRegistrations,
      lockedSchedules
    });

  } catch (error) {
    console.error("Error fetching student schedules:", error);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}
