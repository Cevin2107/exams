import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { fetchSubmissionsForExport } from "@/lib/supabaseHelpers";

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
    const rows = await fetchSubmissionsForExport(id);

    const header = ["submission_id", "student_code", "score", "submitted_at", "duration_seconds", "status"];
    const lines = [header.join(",")];

    rows.forEach((r) => {
      const line = [
        r.id,
        r.student_code ?? "",
        r.score ?? "",
        r.submitted_at,
        r.duration_seconds ?? "",
        r.status,
      ]
        .map((v) => (v === null || v === undefined ? "" : String(v).replace(/"/g, '""')))
        .map((v) => (v.includes(",") ? `"${v}"` : v))
        .join(",");
      lines.push(line);
    });

    const csv = lines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="assignment-${id}-submissions.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting submissions:", error);
    return NextResponse.json({ error: "Failed to export submissions" }, { status: 500 });
  }
}
