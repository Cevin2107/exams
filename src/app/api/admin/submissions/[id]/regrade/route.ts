import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

interface RegradeAnswer {
  questionId: string;
  isCorrect: boolean;
  pointsAwarded: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { answers }: { answers: RegradeAnswer[] } = body;

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid answers data" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // 1. Lấy thông tin submission
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select("id, assignment_id")
      .eq("id", id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // 2. Cập nhật từng câu trả lời
    for (const answer of answers) {
      const { error: updateError } = await supabase
        .from("answers")
        .update({
          is_correct: answer.isCorrect,
          points_awarded: answer.pointsAwarded,
        })
        .eq("submission_id", id)
        .eq("question_id", answer.questionId);

      if (updateError) {
        console.error(`Error updating answer ${answer.questionId}:`, updateError);
      }
    }

    // 3. Tính tổng điểm mới
    const { data: allAnswers, error: answersError } = await supabase
      .from("answers")
      .select("points_awarded")
      .eq("submission_id", id);

    if (answersError) throw answersError;

    const totalPoints = (allAnswers || []).reduce(
      (sum, a) => sum + (a.points_awarded || 0),
      0
    );

    // 4. Lấy tổng điểm của assignment (dựa trên các câu hỏi hiện tại)
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("points")
      .eq("assignment_id", submission.assignment_id);

    if (questionsError) throw questionsError;

    const totalAssignmentPoints = (questions || []).reduce(
      (sum, q) => sum + (q.points || 0),
      0
    );

    // 5. Tính điểm thang 10
    let finalScore = 0;
    if (totalAssignmentPoints > 0) {
      finalScore = (totalPoints / totalAssignmentPoints) * 10;
      finalScore = Math.round(finalScore * 100) / 100; // Làm tròn 2 chữ số
    }

    // 6. Cập nhật điểm mới vào submission
    const { error: updateSubmissionError } = await supabase
      .from("submissions")
      .update({ score: finalScore })
      .eq("id", id);

    if (updateSubmissionError) throw updateSubmissionError;

    return NextResponse.json({
      success: true,
      newScore: finalScore,
      totalPoints,
      totalAssignmentPoints,
    });
  } catch (error) {
    console.error("Error regrading submission:", error);
    return NextResponse.json(
      { error: "Failed to regrade submission" },
      { status: 500 }
    );
  }
}
