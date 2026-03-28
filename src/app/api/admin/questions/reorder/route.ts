import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createClient } from "@supabase/supabase-js";
import { rebalanceQuestionPoints } from "@/lib/supabaseHelpers";

export async function POST(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const assignmentId = body?.assignmentId as string | undefined;
    const orderedIds = body?.orderedIds as string[] | undefined;

    if (!assignmentId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    for (let index = 0; index < orderedIds.length; index++) {
      const id = orderedIds[index];
      const { error } = await supabase
        .from("questions")
        .update({ order: index + 1 })
        .eq("id", id)
        .eq("assignment_id", assignmentId);

      if (error) throw error;
    }

    await rebalanceQuestionPoints(assignmentId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error reordering questions:", error);
    return NextResponse.json({ error: "Failed to reorder questions" }, { status: 500 });
  }
}
