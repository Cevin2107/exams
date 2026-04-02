import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { buildQuestionsFromUploads } from "@/lib/aiGeneration";

export const runtime = "nodejs";
export const maxDuration = 120;

function classifyAiError(error: unknown): { status: number; publicMessage: string; code: string } {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (message.includes("Thiếu GROQ_API_KEY")) {
    return {
      status: 503,
      publicMessage: "Server chưa cấu hình GROQ_API_KEY trên môi trường deploy.",
      code: "MISSING_GROQ_KEY",
    };
  }

  if (message.includes("OpenRouter 401") || message.includes("Groq text 401")) {
    return {
      status: 502,
      publicMessage: "AI provider từ chối xác thực. Kiểm tra lại API key trên server.",
      code: "AI_PROVIDER_AUTH_FAILED",
    };
  }

  if (message.includes("Không có nội dung để xử lý")) {
    return {
      status: 422,
      publicMessage: "Không đọc được nội dung từ file tải lên. Hãy thử file rõ nét hơn hoặc dán văn bản thủ công.",
      code: "OCR_NO_TEXT",
    };
  }

  if (message.includes("AI did not return any questions")) {
    return {
      status: 502,
      publicMessage: "AI chưa trích xuất được câu hỏi từ dữ liệu hiện tại. Hãy thử lại với ảnh/PDF rõ hơn.",
      code: "AI_EMPTY_RESULT",
    };
  }

  return {
    status: 500,
    publicMessage: "Không thể tạo câu hỏi bằng AI lúc này, vui lòng thử lại sau.",
    code: "AI_GENERATION_FAILED",
  };
}

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
    const errorWithDetails = error as { details?: string };
    const details = errorWithDetails?.details || undefined;
    const classified = classifyAiError(error);
    return NextResponse.json(
      {
        error: isDev ? message : classified.publicMessage,
        details: isDev ? details : undefined,
        code: classified.code,
      },
      { status: isDev ? 500 : classified.status }
    );
  }
}
