const GROQ_TEXT_MODEL = "llama-3.1-8b-instant";
const OCR_SPACE_API_URL = "https://api.ocr.space/parse/image";

const MAX_TEXT_LENGTH = 15000;
const TEXT_CHUNK_SIZE = 3500;
const MAX_QUESTIONS = 16;
const QUESTIONS_PER_CHUNK = 5;

type HttpError = Error & { status?: number; details?: string };

export interface GeneratedQuestion {
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correct_answer: "A" | "B" | "C" | "D";
}

interface OcrResult {
  text: string;
  source: string;
}

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}

async function callOcrSpaceApi(base64: string, mimeType: string) {
  const apiKey = process.env.OCR_SPACE_API_KEY || "K87899142388957";
  
  // OCR.space expects base64 with data URI prefix
  const base64Image = `data:${mimeType};base64,${base64}`;
  
  const formData = new URLSearchParams();
  formData.append("base64Image", base64Image);
  formData.append("isOverlayRequired", "false");
  formData.append("apikey", apiKey);
  formData.append("OCREngine", "2"); // OCR Engine 2 is better for Asian languages

  const res = await fetch(OCR_SPACE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    const message = `OCR.space API error: ${res.status}`;
    const error: HttpError = Object.assign(new Error(message), {
      status: res.status,
      details: body,
    });
    throw error;
  }

  const data = await res.json();
  
  if (data.IsErroredOnProcessing) {
    throw new Error(`OCR.space error: ${data.ErrorMessage?.[0] || "Unknown error"}`);
  }
  
  const text = data.ParsedResults?.[0]?.ParsedText?.trim();
  if (!text) throw new Error("Empty OCR result from OCR.space");
  
  return text;
}



async function extractPdfText(file: File) {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdfParse(buffer);
  return (result?.text as string | undefined)?.trim() || "";
}

async function ocrFile(file: File): Promise<OcrResult> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    const text = await extractPdfText(file);
    return { text, source: file.name };
  }

  const base64 = await fileToBase64(file);
  const text = await callOcrSpaceApi(base64, file.type || "image/png");
  return { text, source: file.name };
}

function cleanOcrText(chunks: string[]): string {
  const joined = chunks.join("\n\n");
  const lines = joined
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const counts = lines.reduce<Map<string, number>>((acc, line) => {
    acc.set(line, (acc.get(line) || 0) + 1);
    return acc;
  }, new Map());

  const filtered = lines.filter((line) => {
    const repeats = counts.get(line) || 0;
    if (repeats >= Math.max(3, Math.floor(lines.length * 0.1)) && line.length < 80) {
      return false;
    }
    return true;
  });

  return filtered.join("\n").slice(0, MAX_TEXT_LENGTH);
}

function chunkText(text: string) {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    chunks.push(text.slice(cursor, cursor + TEXT_CHUNK_SIZE));
    cursor += TEXT_CHUNK_SIZE;
  }
  return chunks;
}

function extractJsonArray(raw: string) {
  const match = raw.match(/\[([\s\S]*?)\]/);
  return match ? match[0] : raw;
}

type AiQuestionPayload = {
  question?: unknown;
  options?: Record<string, unknown>;
  correct_answer?: unknown;
};

function normalizeQuestions(raw: unknown): GeneratedQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((candidate) => {
      const q = candidate as AiQuestionPayload;
      const question = q.question?.toString().trim();
      const optionsRecord = q.options || {};
      const correctRaw = q.correct_answer?.toString().trim().toUpperCase();
      if (!question) return null;
      const opt: Record<"A" | "B" | "C" | "D", string> = {
        A: optionsRecord.A?.toString().trim() || "",
        B: optionsRecord.B?.toString().trim() || "",
        C: optionsRecord.C?.toString().trim() || "",
        D: optionsRecord.D?.toString().trim() || "",
      };
      const firstNonEmpty = (Object.entries(opt).find(([, v]) => v)?.[0] as "A" | "B" | "C" | "D") || "A";
      const correctAnswer = ["A", "B", "C", "D"].includes(correctRaw || "")
        ? (correctRaw as "A" | "B" | "C" | "D")
        : firstNonEmpty;
      return {
        question,
        options: opt,
        correct_answer: correctAnswer,
      } satisfies GeneratedQuestion;
    })
    .filter((q): q is GeneratedQuestion => Boolean(q));
}

async function generateQuestionsFromChunk(text: string, limit: number): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Thiếu GROQ_API_KEY");

  const prompt = `Tạo tối đa ${limit} câu hỏi trắc nghiệm A/B/C/D bằng tiếng Việt. Trả về JSON thuần theo schema:\n[\n  {\n    "question": "...",\n    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},\n    "correct_answer": "A"\n  }\n]\nKhông giải thích hay thêm văn bản ngoài JSON. Văn bản nguồn:\n${text}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_TEXT_MODEL,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: "system", content: "Bạn là hệ thống tạo câu hỏi trắc nghiệm, chỉ trả về JSON hợp lệ." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const message = res.status === 401 ? "Groq text 401 (GROQ_API_KEY không hợp lệ hoặc chưa nạp)" : `Groq text error: ${res.status}`;
    const error: HttpError = Object.assign(new Error(message), { details: body, status: res.status });
    throw error;
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  const jsonSlice = extractJsonArray(raw);
  try {
    const parsed = JSON.parse(jsonSlice);
    return normalizeQuestions(parsed);
  } catch {
    const secondPass = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        temperature: 0,
        max_tokens: 800,
        messages: [
          { role: "system", content: "Sửa JSON về đúng định dạng đã cho. Không thêm chữ thừa." },
          { role: "user", content: `Sửa về JSON mảng câu hỏi: ${raw}` },
        ],
      }),
    });

    if (!secondPass.ok) return [];
    const fallbackData = await secondPass.json();
    const fallbackRaw = fallbackData.choices?.[0]?.message?.content || "";
    try {
      return normalizeQuestions(JSON.parse(extractJsonArray(fallbackRaw)));
    } catch {
      return [];
    }
  }
}

export async function buildQuestionsFromUploads(files: File[], manualText: string) {
  const texts: string[] = [];
  const sources: Array<{ name: string; chars: number; kind: "image" | "pdf" | "text" }> = [];

  for (const file of files) {
    const { text, source } = await ocrFile(file);
    if (text) {
      texts.push(text);
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      sources.push({ name: source, chars: text.length, kind: isPdf ? "pdf" : "image" });
    }
  }

  if (manualText.trim()) {
    const trimmed = manualText.trim();
    texts.push(trimmed);
    sources.push({ name: "text-input", chars: trimmed.length, kind: "text" as const });
  }

  if (texts.length === 0) {
    throw new Error("Không có nội dung để xử lý");
  }

  const cleanedText = cleanOcrText(texts);
  const chunks = chunkText(cleanedText);
  const all: GeneratedQuestion[] = [];

  for (const chunk of chunks) {
    const questions = await generateQuestionsFromChunk(chunk, QUESTIONS_PER_CHUNK);
    all.push(...questions);
    if (all.length >= MAX_QUESTIONS) break;
  }

  const unique = all.reduce<GeneratedQuestion[]>((acc, q) => {
    if (acc.find((ex) => ex.question === q.question)) return acc;
    acc.push(q);
    return acc;
  }, []);

  if (unique.length === 0) {
    throw new Error("AI did not return any questions");
  }

  return {
    cleanedText,
    questions: unique.slice(0, MAX_QUESTIONS),
    sources,
  };
}
