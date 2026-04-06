import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createQuestion } from "@/lib/supabaseHelpers";
import { createClient } from "@supabase/supabase-js";

type AiQuestion = {
  question: string;
  options?: Record<"A" | "B" | "C" | "D", string>;
  correct_answer?: "A" | "B" | "C" | "D";
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildFingerprint(question: AiQuestion): string {
  const options = question.options || { A: "", B: "", C: "", D: "" };
  return [
    normalizeText(question.question || ""),
    normalizeText(options.A || ""),
    normalizeText(options.B || ""),
    normalizeText(options.C || ""),
    normalizeText(options.D || ""),
  ].join("||");
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
    const { id: assignmentId } = await params;
    const body = await req.json();
    const aiQuestions = (body?.aiQuestions || []) as AiQuestion[];

    if (!Array.isArray(aiQuestions) || aiQuestions.length === 0) {
      return NextResponse.json({ error: "No questions to save" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existingRows, error: existingError } = await supabase
      .from("questions")
      .select("content, choices")
      .eq("assignment_id", assignmentId)
      .eq("type", "mcq");

    if (existingError) throw existingError;

    const seenFingerprints = new Set<string>();
    for (const row of existingRows || []) {
      const choices = Array.isArray(row.choices) ? row.choices : [];
      const mapped: Record<"A" | "B" | "C" | "D", string> = {
        A: typeof choices[0] === "string" ? choices[0] : "",
        B: typeof choices[1] === "string" ? choices[1] : "",
        C: typeof choices[2] === "string" ? choices[2] : "",
        D: typeof choices[3] === "string" ? choices[3] : "",
      };
      seenFingerprints.add(buildFingerprint({ question: row.content || "", options: mapped }));
    }

    const created = [];
    let skippedDuplicates = 0;

    for (const q of aiQuestions) {
      const fingerprint = buildFingerprint(q);
      if (seenFingerprints.has(fingerprint)) {
        skippedDuplicates += 1;
        continue;
      }

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
      seenFingerprints.add(fingerprint);
    }

    return NextResponse.json({
      ok: true,
      count: created.length,
      skippedDuplicates,
      questions: created,
    });
  } catch (error) {
    console.error("Error saving AI questions:", error);
    return NextResponse.json({ error: "Failed to save AI questions" }, { status: 500 });
  }
}
