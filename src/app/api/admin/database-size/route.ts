import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdmin();

    // Query to get database size information
    const { data, error } = await supabase.rpc('get_database_size_info');

    if (error) {
      // If the function doesn't exist, try an alternative approach
      // Get table sizes individually
      const tables = ['assignments', 'questions', 'student_sessions', 'submissions'];
      let totalSize = 0;
      
      for (const table of tables) {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        // Rough estimate: 1KB per row average
        totalSize += (count || 0) * 1024;
      }

      // Supabase free tier has 500MB limit
      const FREE_TIER_LIMIT = 500 * 1024 * 1024; // 500MB in bytes
      const usedPercent = (totalSize / FREE_TIER_LIMIT) * 100;

      return NextResponse.json({
        used_bytes: totalSize,
        total_bytes: FREE_TIER_LIMIT,
        used_mb: (totalSize / (1024 * 1024)).toFixed(2),
        total_mb: 500,
        used_percent: usedPercent.toFixed(2),
        is_estimate: true
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching database size:", err);
    return NextResponse.json(
      { error: "Failed to fetch database size" },
      { status: 500 }
    );
  }
}
