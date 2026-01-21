import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST: Tạo session mới khi học sinh bắt đầu làm bài
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { assignmentId, studentName, status = "active" } = body;

    if (!assignmentId || !studentName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Lấy thông tin assignment để tính deadline
    const { data: assignment } = await supabase
      .from("assignments")
      .select("duration_minutes, due_at")
      .eq("id", assignmentId)
      .single();

    // Tính deadline_at dựa trên thời gian bắt đầu + duration
    const startedAt = new Date();
    let deadlineAt = null;
    
    if (assignment?.duration_minutes) {
      deadlineAt = new Date(startedAt.getTime() + assignment.duration_minutes * 60 * 1000);
    }
    
    // Nếu có due_at và nó nhỏ hơn deadline tính theo duration, dùng due_at
    if (assignment?.due_at) {
      const dueAtDate = new Date(assignment.due_at);
      if (!deadlineAt || dueAtDate < deadlineAt) {
        deadlineAt = dueAtDate;
      }
    }

    // Tạo session mới
    const { data: session, error } = await supabase
      .from("student_sessions")
      .insert({
        assignment_id: assignmentId,
        student_name: studentName.trim(),
        status,
        started_at: startedAt.toISOString(),
        deadline_at: deadlineAt?.toISOString() || null,
        last_activity_at: startedAt.toISOString(),
      })
      .select()
      .single();

    if (error || !session) {
      console.error("Session creation error:", error);
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    console.error("Error creating session:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// PUT: Cập nhật trạng thái session (active, exited, submitted)
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, status } = body;

    if (!sessionId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Lấy trạng thái hiện tại để kiểm tra
    const { data: currentSession } = await supabase
      .from("student_sessions")
      .select("status, exit_count")
      .eq("id", sessionId)
      .single();

    const updateData: any = {
      status,
      last_activity_at: new Date().toISOString(),
    };

    // Nếu chuyển từ active → exited, tăng exit_count
    if (currentSession && currentSession.status === "active" && status === "exited") {
      updateData.exit_count = (currentSession.exit_count || 0) + 1;
    }

    // Cập nhật session
    const { error } = await supabase
      .from("student_sessions")
      .update(updateData)
      .eq("id", sessionId);

    if (error) {
      console.error("Session update error:", error);
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating session:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// GET: Lấy danh sách sessions của một assignment
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Lấy tất cả sessions và submissions
    const { data: sessions, error } = await supabase
      .from("student_sessions")
      .select(`
        *,
        submissions:submission_id (
          id,
          score,
          submitted_at,
          status
        )
      `)
      .eq("assignment_id", assignmentId)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Session fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
    }

    return NextResponse.json({ sessions: sessions || [] });
  } catch (err) {
    console.error("Error fetching sessions:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
