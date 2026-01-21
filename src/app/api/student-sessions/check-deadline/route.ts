import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET: Kiểm tra xem session đã hết hạn chưa
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Lấy thông tin session
    const { data: session, error } = await supabase
      .from("student_sessions")
      .select("started_at, deadline_at, status")
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Nếu đã submitted rồi thì không cần check
    if (session.status === "submitted") {
      return NextResponse.json({ 
        expired: false, 
        message: "Already submitted",
        startedAt: session.started_at,
        deadlineAt: session.deadline_at
      });
    }

    // Kiểm tra deadline
    const now = new Date();
    const deadlineAt = session.deadline_at ? new Date(session.deadline_at) : null;
    const expired = deadlineAt ? now >= deadlineAt : false;

    // Tính số giây còn lại
    const remainingSeconds = deadlineAt 
      ? Math.max(0, Math.floor((deadlineAt.getTime() - now.getTime()) / 1000))
      : null;

    return NextResponse.json({ 
      expired,
      remainingSeconds,
      startedAt: session.started_at,
      deadlineAt: session.deadline_at,
      currentTime: now.toISOString()
    });
  } catch (err) {
    console.error("Error checking deadline:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
