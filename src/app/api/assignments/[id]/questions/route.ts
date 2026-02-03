import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Lấy danh sách câu hỏi
    const { data: questions, error } = await supabase
      .from("questions")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("order", { ascending: true });

    if (error) {
      console.error("Error fetching questions:", error);
      return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
    }

    return NextResponse.json({ questions: questions || [] });
  } catch (error) {
    console.error("Error in questions API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
