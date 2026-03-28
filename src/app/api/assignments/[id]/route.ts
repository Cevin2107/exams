import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const getSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("assignments")
      .select("id, title, subject, grade, due_at, duration_minutes, total_score, is_hidden")
      .eq("id", id)
      .eq("is_hidden", false)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      subject: data.subject,
      grade: data.grade,
      dueAt: data.due_at,
      durationMinutes: data.duration_minutes,
      totalScore: data.total_score,
    });
  } catch (error) {
    console.error("Error fetching assignment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
