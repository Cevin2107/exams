import { notFound, redirect } from "next/navigation";
import { AssignmentTaking } from "@/components/AssignmentTaking";
import { fetchAssignmentById, fetchQuestions } from "@/lib/supabaseHelpers";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Disable caching để luôn hiển thị dữ liệu mới nhất
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AssignmentPage({ params }: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Ignore
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const assignment = await fetchAssignmentById(id);
  if (!assignment) return notFound();

  // Validate if student is assigned
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );

  const { data: isAssigned } = await supabaseAdmin
    .from("assignment_assignments")
    .select("id")
    .eq("assignment_id", id)
    .eq("student_id", user.id)
    .single();

  if (!isAssigned) {
    return notFound();
  }

  const questions = await fetchQuestions(assignment.id);

  return <AssignmentTaking assignment={assignment} questions={questions} initialStudentName={user.user_metadata?.full_name || 'Học sinh'} />;
}
