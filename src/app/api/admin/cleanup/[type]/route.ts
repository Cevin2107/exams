import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { type } = await params;
    const supabase = createSupabaseAdmin();
    let items: Array<{ id: string; name: string; info?: string; size?: string }> = [];

    switch (type) {
      case "assignments": {
        const { data, error } = await supabase
          .from("assignments")
          .select("id, title, subject, grade, created_at, is_hidden")
          .order("created_at", { ascending: false });

        if (error) throw error;

        items = (data || []).map((a) => ({
          id: a.id,
          name: a.title,
          info: `${a.subject} - ${a.grade} ${a.is_hidden ? "(Ẩn)" : ""}`,
        }));
        break;
      }

      case "questions": {
        const { data, error } = await supabase
          .from("questions")
          .select(`
            id,
            content,
            type,
            points,
            assignment_id,
            assignments (title)
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        items = (data || []).map((q) => {
          const assignmentTitle = (q.assignments as { title?: string } | null)?.title || "N/A";
          return {
            id: q.id,
            name: q.content || `Câu ${q.type === "mcq" ? "trắc nghiệm" : "tự luận"}`,
            info: `${assignmentTitle} - ${q.points} điểm`,
          };
        });
        break;
      }

      case "submissions": {
        const { data, error } = await supabase
          .from("submissions")
          .select(`
            id,
            student_name,
            score,
            submitted_at,
            assignments (title)
          `)
          .order("submitted_at", { ascending: false });

        if (error) throw error;

        items = (data || []).map((s) => {
          const assignmentTitle = (s.assignments as { title?: string } | null)?.title || "N/A";
          return {
            id: s.id,
            name: `${s.student_name} - ${assignmentTitle}`,
            info: `${s.score}/10 - ${new Date(s.submitted_at).toLocaleDateString("vi-VN")}`,
          };
        });
        break;
      }

      case "sessions": {
        const { data, error } = await supabase
          .from("student_sessions")
          .select(`
            id,
            student_name,
            started_at,
            assignments (title)
          `)
          .order("started_at", { ascending: false });

        if (error) throw error;

        items = (data || []).map((s) => {
          const assignmentTitle = (s.assignments as { title?: string } | null)?.title || "N/A";
          return {
            id: s.id,
            name: `${s.student_name} - ${assignmentTitle}`,
            info: `Bắt đầu: ${new Date(s.started_at).toLocaleDateString("vi-VN")}`,
          };
        });
        break;
      }

      case "images": {
        // Get all image URLs from questions with assignment info
        const { data, error } = await supabase
          .from("questions")
          .select(`
            id,
            image_url,
            content,
            assignment_id,
            assignments (title, subject, grade)
          `)
          .not("image_url", "is", null)
          .order("assignment_id", { ascending: true });

        if (error) throw error;

        items = (data || [])
          .filter((q) => q.image_url)
          .map((q) => {
            const assignment = q.assignments as { title?: string; subject?: string; grade?: string } | null;
            const assignmentTitle = assignment?.title || "N/A";
            const assignmentInfo = assignment 
              ? `${assignment.subject} - ${assignment.grade}` 
              : "Không có bài tập";
            
            return {
              id: q.id,
              name: q.image_url || "",
              info: `📝 ${assignmentTitle} | ${assignmentInfo} | ${q.content?.substring(0, 40) || "Không có nội dung"}`,
              assignmentId: q.assignment_id,
              assignmentTitle: assignmentTitle,
            };
          });
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching cleanup items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { type } = await params;
    const body = await req.json();
    const { ids }: { ids: string[] } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    switch (type) {
      case "assignments": {
        for (const id of ids) {
          const { error } = await supabase
            .from("assignments")
            .delete()
            .eq("id", id);
          if (error) console.error(`Error deleting assignment ${id}:`, error);
        }
        break;
      }

      case "questions": {
        for (const id of ids) {
          const { error } = await supabase
            .from("questions")
            .delete()
            .eq("id", id);
          if (error) console.error(`Error deleting question ${id}:`, error);
        }
        break;
      }

      case "submissions": {
        for (const id of ids) {
          const { error } = await supabase
            .from("submissions")
            .delete()
            .eq("id", id);
          if (error) console.error(`Error deleting submission ${id}:`, error);
        }
        break;
      }

      case "sessions": {
        for (const id of ids) {
          const { error } = await supabase
            .from("student_sessions")
            .delete()
            .eq("id", id);
          if (error) console.error(`Error deleting session ${id}:`, error);
        }
        break;
      }

      case "images": {
        // For images, we update questions to remove image_url
        for (const id of ids) {
          const { error } = await supabase
            .from("questions")
            .update({ image_url: null })
            .eq("id", id);
          if (error) console.error(`Error removing image from question ${id}:`, error);
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("Error deleting items:", error);
    return NextResponse.json(
      { error: "Failed to delete items" },
      { status: 500 }
    );
  }
}
