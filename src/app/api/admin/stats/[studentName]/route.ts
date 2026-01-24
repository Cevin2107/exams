import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { fetchStudentDetailStats } from "@/lib/supabaseHelpers";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentName: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { studentName } = await params;
    const decodedName = decodeURIComponent(studentName);
    const stats = await fetchStudentDetailStats(decodedName);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching student detail stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ studentName: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { studentName } = await params;
    const decodedName = decodeURIComponent(studentName);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey);

    // Xóa tất cả submissions của học sinh (cascade sẽ tự động xóa answers)
    const { error: submissionsError } = await supabase
      .from("submissions")
      .delete()
      .eq("student_name", decodedName);

    if (submissionsError) throw submissionsError;

    // Xóa tất cả sessions của học sinh
    const { error: sessionsError } = await supabase
      .from("student_sessions")
      .delete()
      .eq("student_name", decodedName);

    if (sessionsError) throw sessionsError;

    return NextResponse.json({ success: true, message: "All student data deleted" });
  } catch (error) {
    console.error("Error deleting student data:", error);
    return NextResponse.json({ error: "Failed to delete student data" }, { status: 500 });
  }
}
