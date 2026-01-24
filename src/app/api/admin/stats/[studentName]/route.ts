import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { fetchStudentDetailStats } from "@/lib/supabaseHelpers";

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
