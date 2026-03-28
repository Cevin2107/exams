import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { assignmentId, studentName, sessionId, answers, essayImages, durationSeconds } = body;

    if (!studentName) {
      return NextResponse.json({ error: "Student name is required" }, { status: 400 });
    }

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

    // Kiểm tra xem đã có submission chưa
    const { data: existingSubmission } = await supabase
      .from("submissions")
      .select("id")
      .eq("assignment_id", assignmentId)
      .eq("student_name", studentName)
      .single();

    let submission;
    
    if (existingSubmission) {
      // Cập nhật submission cũ
      const { data: updatedSubmission, error: updateError } = await supabase
        .from("submissions")
        .update({
          submitted_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          status: "pending",
        })
        .eq("id", existingSubmission.id)
        .select()
        .single();

      if (updateError || !updatedSubmission) {
        console.error("Submission update error:", updateError);
        return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
      }
      
      // Xóa các answers cũ
      await supabase
        .from("answers")
        .delete()
        .eq("submission_id", existingSubmission.id);
      
      submission = updatedSubmission;
    } else {
      // Tạo submission mới
      const { data: newSubmission, error: insertError } = await supabase
        .from("submissions")
        .insert({
          assignment_id: assignmentId,
          student_name: studentName,
          submitted_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          status: "pending",
        })
        .select()
        .single();

      if (insertError || !newSubmission) {
        console.error("Submission insert error:", insertError);
        return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
      }
      
      submission = newSubmission;
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

      // Chấm điểm trả lời ngắn (không phân biệt hoa/thường, trim khoảng trắng)
      if (q.type === "short_answer" && q.answer_key) {
        isCorrect = (studentAnswer || "").trim().toLowerCase() === q.answer_key.trim().toLowerCase();
        pointsAwarded = isCorrect ? Number(q.points || 1) : 0;
      }

      // Chấm điểm đúng/sai (mỗi ý đúng được điểm tỉ lệ)
      if (q.type === "true_false" && q.sub_questions) {
        const subQs = q.sub_questions as Array<{ id: string; answerKey: string; content: string; order: number }>;
        const studentTf = (() => { try { return JSON.parse(studentAnswer || "{}"); } catch { return {}; } })();
        const correctCount = subQs.filter((sq) => studentTf[sq.id] === sq.answerKey).length;
        const totalSubs = subQs.length;
        pointsAwarded = totalSubs > 0 ? Math.round(((correctCount / totalSubs) * Number(q.points || 1)) * 1000) / 1000 : 0;
        isCorrect = correctCount === totalSubs && totalSubs > 0;
      }

      totalScoreRaw += pointsAwarded;

      await supabase.from("answers").insert({
        submission_id: submission.id,
        question_id: q.id,
        answer: studentAnswer || "",
        answer_image_url: (essayImages as Record<string, string> | undefined)?.[q.id] || null,
        is_correct: (q.type === "mcq" || q.type === "short_answer" || q.type === "true_false") ? isCorrect : null,
        points_awarded: pointsAwarded,
      });
    }

    const normalizedScore = Math.round(((totalScoreRaw / totalPossiblePoints) * 10 + Number.EPSILON) * 100) / 100;

    // Cập nhật điểm submission
    await supabase
      .from("submissions")
      .update({ score: normalizedScore, status: "scored" })
      .eq("id", submission.id);

    // Cập nhật session status thành "submitted"
    if (sessionId) {
      console.log("Updating session to submitted:", sessionId);
      const { data: updateData, error: updateError } = await supabase
        .from("student_sessions")
        .update({ 
          status: "submitted",
          submission_id: submission.id,
          last_activity_at: new Date().toISOString()
        })
        .eq("id", sessionId)
        .select();
      
      if (updateError) {
        console.error("Error updating session:", updateError);
      } else {
        console.log("Session updated successfully:", updateData);
      }
    } else {
      console.warn("No sessionId provided for submission");
    }

    return NextResponse.json({ submissionId: submission.id, score: normalizedScore });
  } catch (err) {
    console.error("Error submitting:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
