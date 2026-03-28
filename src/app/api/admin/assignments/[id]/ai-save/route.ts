import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createQuestion } from "@/lib/supabaseHelpers";

type AiQuestion = {
  question: string;
  options?: Record<"A" | "B" | "C" | "D", string>;
  correct_answer?: "A" | "B" | "C" | "D";
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: assignmentId } = await params;
    const body = await req.json();
    const aiQuestions = (body?.aiQuestions || []) as AiQuestion[];

    if (!Array.isArray(aiQuestions) || aiQuestions.length === 0) {
      return NextResponse.json({ error: "No questions to save" }, { status: 400 });
    }

    const created = [];

    for (const q of aiQuestions) {
      const choices = q.options
        ? [q.options.A, q.options.B, q.options.C, q.options.D].filter(Boolean)
        : undefined;

      const createdQuestion = await createQuestion({
        assignmentId,
        type: "mcq",
        content: (q.question || "").trim(),
        choices,
        answerKey: q.correct_answer,
      });

      created.push(createdQuestion);
    }

    return NextResponse.json({ ok: true, count: created.length, questions: created });
  } catch (error) {
    console.error("Error saving AI questions:", error);
    return NextResponse.json({ error: "Failed to save AI questions" }, { status: 500 });
  }
}
