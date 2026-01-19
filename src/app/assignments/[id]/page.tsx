import { notFound } from "next/navigation";
import { AssignmentTaking } from "@/components/AssignmentTaking";
import { fetchAssignmentById, fetchQuestions } from "@/lib/supabaseHelpers";

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assignment = await fetchAssignmentById(id);
  if (!assignment) return notFound();

  const questions = await fetchQuestions(assignment.id);

  return <AssignmentTaking assignment={assignment} questions={questions} />;
}
