import { checkAdminAuth } from "@/lib/adminAuth";
import { redirect, notFound } from "next/navigation";
import { fetchAssignmentByIdAdmin, fetchQuestions } from "@/lib/supabaseHelpers";
import { AssignmentDetailTabs } from "@/features/admin/components/AssignmentDetailTabs";

export const dynamic = "force-dynamic";

export default async function AssignmentDetailPageServer({ params }: { params: Promise<{ id: string }> }) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) redirect("/admin");

  const resolvedParams = await params;
  const assignmentId = resolvedParams.id;

  const [assignment, questions] = await Promise.all([
    fetchAssignmentByIdAdmin(assignmentId),
    fetchQuestions(assignmentId),
  ]);

  if (!assignment) {
    return notFound();
  }

  // Chuyển đổi thông tin questions để khử lỗi object truyền sang Client Component
  const safeQuestions = questions.map(q => ({
    ...q,
    choices: q.choices || [],
    subQuestions: q.subQuestions || [],
    answerKey: q.answerKey || null,
    imageUrl: q.imageUrl || null
  }));

  return (
    <AssignmentDetailTabs
      assignmentId={assignmentId}
      initialAssignment={assignment}
      initialQuestions={safeQuestions}
    />
  );
}
