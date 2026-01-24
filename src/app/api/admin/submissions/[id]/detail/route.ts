import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Lấy thông tin submission
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select(`
        id,
        student_name,
        score,
        submitted_at,
        duration_seconds,
        assignment_id,
        assignments (
          id,
          title,
          subject,
          grade
        )
      `)
      .eq("id", id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Lấy tất cả câu hỏi của assignment
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("assignment_id", submission.assignment_id)
      .order("order", { ascending: true });

    if (questionsError) throw questionsError;

    // Lấy tất cả câu trả lời của submission này
    const { data: answers, error: answersError } = await supabase
      .from("answers")
      .select("*")
      .eq("submission_id", id);

    if (answersError) throw answersError;

    // Map câu trả lời với câu hỏi
    const questionDetails = (questions || []).map((q: { id: string; order: number; type: string; content: string; choices?: string[]; answer_key?: string; points: number; image_url?: string }) => {
      const answer = (answers || []).find((a: { question_id: string; answer?: string; is_correct?: boolean; points_awarded?: number }) => a.question_id === q.id);
      return {
        questionId: q.id,
        order: q.order,
        type: q.type,
        content: q.content,
        choices: q.choices,
        correctAnswer: q.answer_key,
        points: q.points,
        imageUrl: q.image_url,
        studentAnswer: answer?.answer || null,
        isCorrect: answer?.is_correct,
        pointsAwarded: answer?.points_awarded || 0,
      };
    });

    return NextResponse.json({
      questions: questionDetails,
    });
  } catch (error) {
    console.error("Error fetching submission detail:", error);
    return NextResponse.json({ error: "Failed to fetch details" }, { status: 500 });
  }
}
