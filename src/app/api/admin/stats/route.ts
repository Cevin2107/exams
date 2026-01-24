import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { fetchAllStudentsStats } from "@/lib/supabaseHelpers";

export async function GET() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await fetchAllStudentsStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching student stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
