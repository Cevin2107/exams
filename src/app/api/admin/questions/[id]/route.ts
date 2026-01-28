import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { updateQuestion, deleteQuestion } from "@/lib/supabaseHelpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id } = await params;
    const updated = await updateQuestion(id, {
      type: body.type,
      content: body.content,
      choices: body.choices,
      answerKey: body.answerKey,
      imageUrl: body.imageUrl,
      order: body.order,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating question:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deleteQuestion(id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("Error deleting question:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to delete question";
    const isDbConstraint = (error as { code?: string })?.code === "23502" || errorMessage.includes("assignment_id");
    
    if (isDbConstraint) {
      return NextResponse.json({ 
        error: "Database có dữ liệu lỗi. Vui lòng chạy cleanup migration!" 
      }, { status: 500 });
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
