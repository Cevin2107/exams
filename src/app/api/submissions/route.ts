import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { assignmentId, answers, durationSeconds } = body;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Lấy câu hỏi để chấm điểm
    const { data: questions } = await supabase
      .from("questions")
      .select("*")
      .eq("assignment_id", assignmentId);

    if (!questions) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Tạo submission
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        assignment_id: assignmentId,
        submitted_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        status: "pending",
      })
      .select()
      .single();

    if (submissionError || !submission) {
      console.error("Submission error:", submissionError);
      return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
    }

    // Chấm điểm và lưu answers, chuẩn hóa thang 10
    const totalPossiblePoints = questions.reduce((sum, q) => sum + Number(q.points || 1), 0) || 1;
    let totalScoreRaw = 0;

    for (const q of questions) {
      const studentAnswer = answers[q.id];
      let isCorrect = false;
      let pointsAwarded = 0;

      // Chấm điểm trắc nghiệm
      if (q.type === "mcq" && q.answer_key) {
        isCorrect = studentAnswer === q.answer_key;
        pointsAwarded = isCorrect ? Number(q.points || 1) : 0;
      }

      totalScoreRaw += pointsAwarded;

      await supabase.from("answers").insert({
        submission_id: submission.id,
        question_id: q.id,
        answer: studentAnswer || "",
        is_correct: q.type === "mcq" ? isCorrect : null,
        points_awarded: pointsAwarded,
      });
    }

    const normalizedScore = Math.round(((totalScoreRaw / totalPossiblePoints) * 10 + Number.EPSILON) * 100) / 100;

    // Cập nhật điểm submission
    await supabase
      .from("submissions")
      .update({ score: normalizedScore, status: "scored" })
      .eq("id", submission.id);

    return NextResponse.json({ submissionId: submission.id, score: normalizedScore });
  } catch (err) {
    console.error("Error submitting:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
