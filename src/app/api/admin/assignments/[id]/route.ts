import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import {
  fetchAssignmentByIdAdmin,
  fetchQuestions,
  deleteAssignment,
  updateAssignment,
} from "@/lib/supabaseHelpers";

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
    const assignment = await fetchAssignmentByIdAdmin(id);
    const questions = await fetchQuestions(id);
    
    return NextResponse.json({
      assignment: assignment ? {
        id: assignment.id,
        title: assignment.title,
        subject: assignment.subject,
        grade: assignment.grade,
        due_at: assignment.dueAt,
        duration_minutes: assignment.durationMinutes,
        total_score: assignment.totalScore,
        is_hidden: assignment.isHidden ?? false,
      } : null,
      questions,
    });
  } catch (error) {
    console.error("Error fetching assignment:", error);
    return NextResponse.json({ error: "Failed to fetch assignment" }, { status: 500 });
  }
}

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

    const updated = await updateAssignment({
      id,
      title: body.title,
      subject: body.subject,
      grade: body.grade,
      dueAt: body.dueAt,
      durationMinutes: body.durationMinutes,
      totalScore: body.totalScore,
      isHidden: body.isHidden,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating assignment:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
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
    await deleteAssignment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}
