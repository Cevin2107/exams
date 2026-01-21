import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// DELETE: Xóa session và submission liên quan
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Lấy thông tin session để biết submission_id
    const { data: session, error: fetchError } = await supabase
      .from("student_sessions")
      .select("submission_id")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Session fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
    }

    // Nếu có submission, xóa submission trước (cascade sẽ xóa answers)
    if (session?.submission_id) {
      const { error: submissionError } = await supabase
        .from("submissions")
        .delete()
        .eq("id", session.submission_id);
      
      if (submissionError) {
        console.error("Submission deletion error:", submissionError);
        // Tiếp tục xóa session dù không xóa được submission
      }
    }

    // Xóa session
    const { error } = await supabase
      .from("student_sessions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Session deletion error:", error);
      return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting session:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
