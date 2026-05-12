import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = await params;
  const assignmentId = resolvedParams.id;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );

  // Get all students
  const { data: students, error: studentsError } = await supabase
    .from("student_profiles")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  if (studentsError) {
    return NextResponse.json({ error: "Lỗi lấy danh sách học sinh" }, { status: 500 });
  }

  // Get assigned students
  const { data: assigned, error: assignedError } = await supabase
    .from("assignment_assignments")
    .select("student_id")
    .eq("assignment_id", assignmentId);

  if (assignedError) {
    return NextResponse.json({ error: "Lỗi lấy danh sách giao bài" }, { status: 500 });
  }

  const assignedIds = new Set(assigned.map(a => a.student_id));
  const studentsWithAssignment = students.map(s => ({
    id: s.id,
    full_name: s.full_name,
    isAssigned: assignedIds.has(s.id),
  }));

  return NextResponse.json({ students: studentsWithAssignment });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = await params;
  const assignmentId = resolvedParams.id;
  
  const { assignedIds } = await request.json();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );

  // Xoá tất cả phân công cũ
  const { error: deleteError } = await supabase
    .from("assignment_assignments")
    .delete()
    .eq("assignment_id", assignmentId);

  if (deleteError) {
    return NextResponse.json({ error: "Lỗi xoá phân công cũ" }, { status: 500 });
  }

  // Thêm phân công mới
  if (assignedIds && assignedIds.length > 0) {
    const insertData = assignedIds.map((id: string) => ({
      assignment_id: assignmentId,
      student_id: id,
    }));
    
    const { error: insertError } = await supabase
      .from("assignment_assignments")
      .insert(insertData);

    if (insertError) {
      return NextResponse.json({ error: "Lỗi thêm phân công mới" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
