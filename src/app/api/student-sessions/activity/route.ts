import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// PATCH: Cập nhật last_activity_at khi học sinh có hoạt động
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Cập nhật last_activity_at
    const { error } = await supabase
      .from("student_sessions")
      .update({
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      console.error("Activity update error:", error);
      return NextResponse.json({ error: "Failed to update activity" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating activity:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
