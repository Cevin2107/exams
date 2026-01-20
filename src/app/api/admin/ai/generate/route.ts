import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { buildQuestionsFromUploads } from "@/lib/aiGeneration";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File)
      .slice(0, 12); // guard against accidental huge batches

    const manualText = (formData.get("manualText") as string | null) || "";

    if (!files.length && !manualText.trim()) {
      return NextResponse.json({ error: "Vui lòng thêm ít nhất 1 ảnh/PDF hoặc dán văn bản." }, { status: 400 });
    }

    const oversized = files.find((f) => f.size > 8 * 1024 * 1024);
    if (oversized) {
      return NextResponse.json({ error: `${oversized.name} vượt quá 8MB, hãy nén hoặc tách nhỏ.` }, { status: 413 });
    }

    const { cleanedText, questions, sources } = await buildQuestionsFromUploads(files, manualText);

    return NextResponse.json({ cleanedText, questions, sources });
  } catch (error) {
    console.error("AI generation error", error);
    const isDev = process.env.NODE_ENV !== "production";
    const message = error instanceof Error ? error.message : "Unknown error";
    const details = (error as any)?.details || undefined;
    return NextResponse.json(
      {
        error: isDev ? message : "Không thể tạo câu hỏi bằng AI lúc này, vui lòng thử lại sau.",
        details: isDev ? details : undefined,
      },
      { status: 500 }
    );
  }
}
