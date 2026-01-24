import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// PATCH: Lưu draft answers
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { draftAnswers } = body;

    if (!draftAnswers || typeof draftAnswers !== 'object') {
      return NextResponse.json({ error: "Invalid draft answers" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    const { error } = await supabase
      .from("student_sessions")
      .update({ 
        draft_answers: draftAnswers,
        last_activity_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      console.error("Error saving draft:", error);
      return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in draft PATCH:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// GET: Lấy draft answers
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    const { data, error } = await supabase
      .from("student_sessions")
      .select("draft_answers")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error loading draft:", error);
      return NextResponse.json({ error: "Failed to load draft" }, { status: 500 });
    }

    return NextResponse.json({ draftAnswers: data?.draft_answers || {} });
  } catch (err) {
    console.error("Error in draft GET:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
