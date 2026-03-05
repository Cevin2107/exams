import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createClient } from "@supabase/supabase-js";

// POST: Gia hạn thời gian làm bài cho tất cả học sinh đang active
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: assignmentId } = await params;
    const body = await req.json();
    const extraMinutes = Number(body.extraMinutes);

    if (!extraMinutes || extraMinutes <= 0 || !Number.isInteger(extraMinutes)) {
      return NextResponse.json({ error: "extraMinutes must be a positive integer" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Lấy tất cả sessions đang active (chưa nộp bài) của bài tập này có deadline
    const { data: sessions, error: fetchError } = await supabase
      .from("student_sessions")
      .select("id, deadline_at")
      .eq("assignment_id", assignmentId)
      .neq("status", "submitted")
      .not("deadline_at", "is", null);

    if (fetchError) throw fetchError;

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: "Không có học sinh đang làm bài có deadline", updatedCount: 0 });
    }

    // Cộng thêm extraMinutes vào deadline_at của từng session
    const extraMs = extraMinutes * 60 * 1000;
    const updates = sessions.map((s) => ({
      id: s.id,
      deadline_at: new Date(new Date(s.deadline_at).getTime() + extraMs).toISOString(),
    }));

    // Upsert từng session
    const { error: updateError } = await supabase
      .from("student_sessions")
      .upsert(updates, { onConflict: "id" });

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, updatedCount: updates.length });
  } catch (error) {
    console.error("Error extending time:", error);
    return NextResponse.json({ error: "Failed to extend time" }, { status: 500 });
  }
}
