import sharp from "sharp";

const GROQ_TEXT_MODEL = "llama-3.1-8b-instant";
const STEPFUN_TEXT_MODEL = "stepfun/step-3.5-flash:free";
const OPENROUTER_TEXT_MODEL = process.env.AI_QUESTION_PARSER_MODEL || STEPFUN_TEXT_MODEL;
const OPENROUTER_TEXT_MODELS = (process.env.AI_QUESTION_PARSER_MODELS || `${OPENROUTER_TEXT_MODEL}`)
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const PUTER_OPENAI_BASE_URL = "https://api.puter.com/puterai/openai/v1/chat/completions";
const QWEN_PRIMARY_MODEL = process.env.AI_QUESTION_QWEN_MODEL || "qwen/qwen3.6-plus-preview:free";
const PUTER_TEXT_MODEL = process.env.AI_QUESTION_PUTER_MODEL || QWEN_PRIMARY_MODEL;
const PUTER_TEXT_MODELS = (() => {
  const configured = (process.env.AI_QUESTION_PUTER_MODELS || `${PUTER_TEXT_MODEL},arcee-ai/trinity-large-preview:free`)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(configured));
  const qwenFirst = unique.filter((model) => model.toLowerCase().includes("qwen"));
  const others = unique.filter((model) => !model.toLowerCase().includes("qwen"));
  return [...qwenFirst, ...others];
})();
const PUTER_EXTRACTION_MODELS = (() => {
  const configured = (process.env.AI_QUESTION_PUTER_EXTRACTION_MODELS || "arcee-ai/trinity-large-preview:free")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(configured));
  const withoutQwen = unique.filter((model) => !model.toLowerCase().includes("qwen"));
  return withoutQwen.length > 0 ? withoutQwen : ["arcee-ai/trinity-large-preview:free"];
})();
const OCR_SPACE_API_URL = "https://api.ocr.space/parse/image";

const MAX_TEXT_LENGTH = 15000;
const TEXT_CHUNK_SIZE = 3500;
const OCR_TIMEOUT_MS = 22000;
const AI_TIMEOUT_MS = 105000; // Tăng timeout để phù hợp với Puter timeout
const PUTER_TIMEOUT_MS = 100000; // Timeout 100s cho Qwen
const PUTER_MAX_RETRIES = 1; // Không retry, lỗi là fallback ngay
const PUTER_RETRY_DELAY_MS = 2000; // Delay giữa các lần retry
const ENABLE_ANSWER_SOLVING = process.env.AI_ENABLE_ANSWER_SOLVING !== "false";
const SOLVE_BATCH_SIZE = 8;
const ENABLE_PUTER_FOR_EXTRACTION = process.env.AI_ENABLE_PUTER_EXTRACTION !== "false";
const EXTRACT_SOURCE_CONTEXT_MAX_CHARS = 3000;
const RECOVERY_SOURCE_CONTEXT_MAX_CHARS = 2800;
const SOLVE_SOURCE_CONTEXT_MAX_CHARS = 1400;
const MAX_SOLVE_QUESTION_TEXT_CHARS = 320;
const MAX_SOLVE_OPTION_TEXT_CHARS = 140;

// OCR optimization settings
const MAX_IMAGE_WIDTH = 1600; // Giảm kích thước để tăng tốc OCR
const MAX_IMAGE_HEIGHT = 1600;
const JPEG_QUALITY = 85;

type HttpError = Error & { status?: number; details?: string };

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    if (isTimeout) {
      const timeoutError: HttpError = Object.assign(new Error(`Request timeout after ${timeoutMs}ms`), {
        status: 504,
      });
      throw timeoutError;
    }
    throw error;
  }
}

function aiLog(level: "info" | "warn" | "error", stage: string, message: string, meta?: Record<string, unknown>) {
  const prefix = `[AI][${stage}] ${message}`;
  if (meta) {
    console[level](prefix, meta);
    return;
  }
  console[level](prefix);
}

export interface GeneratedQuestion {
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correct_answer: "A" | "B" | "C" | "D";
}

interface OcrResult {
  text: string;
  source: string;
}

interface ExtractedQuestion extends GeneratedQuestion {
  source_index?: number;
}

async function optimizeImage(file: File): Promise<Buffer> {
  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Resize và compress ảnh để tăng tốc OCR
  const optimized = await sharp(buffer)
    .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  
  return optimized;
}

async function callOcrSpaceApi(imageBuffer: Buffer): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY || "K87899142388957";
  const base64Image = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
  
  const formData = new URLSearchParams();
  formData.append("base64Image", base64Image);
  formData.append("isOverlayRequired", "false");
  formData.append("apikey", apiKey);
  formData.append("OCREngine", "2");
  formData.append("scale", "true"); // Auto-scale để tăng độ chính xác
  formData.append("isTable", "false"); // Tắt table detection để nhanh hơn

  const res = await fetchWithTimeout(OCR_SPACE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  }, OCR_TIMEOUT_MS);

  if (!res.ok) {
    throw new Error(`OCR.space error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  
  if (data.IsErroredOnProcessing) {
    const errorMsg = data.ErrorMessage?.[0] || "Unknown OCR error";
    throw new Error(`OCR failed: ${errorMsg}`);
  }
  
  const text = data.ParsedResults?.[0]?.ParsedText?.trim();
  if (!text) throw new Error("Empty OCR result");
  
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

  // Optimize ảnh trước khi OCR để tăng tốc
  const optimizedBuffer = await optimizeImage(file);
  const text = await callOcrSpaceApi(optimizedBuffer);
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
  const normalized = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = normalized.indexOf("[");
  if (start < 0) return normalized;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < normalized.length; i++) {
    const ch = normalized[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) {
        return normalized.slice(start, i + 1);
      }
    }
  }

  // Keep partial segment for lenient recovery when model output is truncated.
  return normalized.slice(start);
}

function repairJsonCandidate(candidate: string): string {
  let repaired = candidate;
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");
  repaired = repaired.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
  return repaired;
}

function closeDanglingJson(candidate: string): string {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (const ch of candidate) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") stack.push(ch);
    if (ch === "}" && stack[stack.length - 1] === "{") stack.pop();
    if (ch === "]" && stack[stack.length - 1] === "[") stack.pop();
  }

  const closers = stack
    .reverse()
    .map((open) => (open === "{" ? "}" : "]"))
    .join("");

  return `${candidate}${closers}`;
}

function parseJsonLenient(raw: string): unknown {
  const base = extractJsonArray(raw);
  const attempts = [
    base,
    repairJsonCandidate(base),
    closeDanglingJson(base),
    closeDanglingJson(repairJsonCandidate(base)),
  ];

  let lastError: Error | null = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error("Unable to parse AI JSON output");
}

function detectQuestionIndices(text: string): number[] {
  const regex = /(?:^|\n)\s*(?:Câu\s*)?(\d{1,3})\s*[\).:-]/gim;
  const found = new Set<number>();
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const num = Number.parseInt(match[1], 10);
    if (Number.isFinite(num) && num > 0) {
      found.add(num);
    }
    match = regex.exec(text);
  }
  return Array.from(found).sort((a, b) => a - b);
}

function estimateQuestionCountInChunk(text: string): number {
  const byIndices = detectQuestionIndices(text).length;

  const countA = (text.match(/(?:^|\n)\s*A\s*[\).:-]\s+\S/gim) || []).length;
  const countB = (text.match(/(?:^|\n)\s*B\s*[\).:-]\s+\S/gim) || []).length;
  const countC = (text.match(/(?:^|\n)\s*C\s*[\).:-]\s+\S/gim) || []).length;
  const countD = (text.match(/(?:^|\n)\s*D\s*[\).:-]\s+\S/gim) || []).length;
  const byOptionSets = Math.min(countA, countB, countC, countD);

  // Fallback heuristic by text length when numbering/options are noisy.
  const byLength = Math.max(1, Math.ceil(text.length / 320));

  const estimated = Math.max(byIndices, byOptionSets, byLength);
  return Math.max(1, estimated);
}

function parseQuestionsHeuristically(text: string): ExtractedQuestion[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const results: ExtractedQuestion[] = [];
  let current: ExtractedQuestion | null = null;
  let currentOption: "A" | "B" | "C" | "D" | null = null;

  const pushCurrent = () => {
    if (!current) return;
    if (!current.question.trim()) return;
    results.push({
      ...current,
      question: current.question.trim(),
      options: {
        A: current.options.A.trim(),
        B: current.options.B.trim(),
        C: current.options.C.trim(),
        D: current.options.D.trim(),
      },
    });
  };

  for (const line of lines) {
    const questionStart = line.match(/^(?:Câu\s*)?(\d{1,3})\s*[\).:-]\s*(.*)$/i);
    if (questionStart) {
      pushCurrent();
      current = {
        source_index: Number.parseInt(questionStart[1], 10),
        question: questionStart[2] || "",
        options: { A: "", B: "", C: "", D: "" },
        correct_answer: "A",
      };
      currentOption = null;
      continue;
    }

    const optionMatch = line.match(/^([ABCD])\s*[\).:-]\s*(.*)$/i);
    if (optionMatch && current) {
      const key = optionMatch[1].toUpperCase() as "A" | "B" | "C" | "D";
      current.options[key] = optionMatch[2] || "";
      currentOption = key;
      continue;
    }

    if (!current) continue;
    if (currentOption) {
      current.options[currentOption] = `${current.options[currentOption]} ${line}`.trim();
    } else {
      current.question = `${current.question} ${line}`.trim();
    }
  }

  pushCurrent();
  return normalizeQuestions(results);
}

type AiQuestionPayload = {
  source_index?: unknown;
  question?: unknown;
  options?: Record<string, unknown>;
  correct_answer?: unknown;
};

function normalizeQuestions(raw: unknown): ExtractedQuestion[] {
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .map<ExtractedQuestion | null>((candidate) => {
      const q = candidate as AiQuestionPayload;
      const sourceIndexRaw = q.source_index;
      const question = q.question?.toString().trim();
      const optionsRecord = q.options || {};
      const correctRaw = q.correct_answer?.toString().trim().toUpperCase();
      if (!question) return null;
      const sourceIndex = Number.parseInt(sourceIndexRaw?.toString() || "", 10);
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
        ...(Number.isFinite(sourceIndex) && sourceIndex > 0 ? { source_index: sourceIndex } : {}),
        question,
        options: opt,
        correct_answer: correctAnswer,
      } satisfies ExtractedQuestion;
    })
    .filter((q): q is ExtractedQuestion => q !== null);

  return normalized;
}

function hasLikelyBrokenLatex(text: string): boolean {
  if (!text) return false;
  const dollarCount = (text.match(/\$/g) || []).length;
  if (dollarCount % 2 !== 0) return true;

  const openInline = (text.match(/\\\(/g) || []).length;
  const closeInline = (text.match(/\\\)/g) || []).length;
  if (openInline !== closeInline) return true;

  const openDisplay = (text.match(/\\\[/g) || []).length;
  const closeDisplay = (text.match(/\\\]/g) || []).length;
  if (openDisplay !== closeDisplay) return true;

  return false;
}

function needsLatexRepair(questions: ExtractedQuestion[]): boolean {
  return questions.some((q) => {
    if (hasLikelyBrokenLatex(q.question)) return true;
    return Object.values(q.options).some((opt) => hasLikelyBrokenLatex(opt));
  });
}

function extractAssistantText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clampText(text: string, maxChars: number): string {
  const normalized = compactWhitespace(text);
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 20) return normalized.slice(0, maxChars);
  return `${normalized.slice(0, maxChars - 3)}...`;
}

function buildContextSnippet(text: string, maxChars: number): string {
  const normalized = compactWhitespace(text);
  if (normalized.length <= maxChars) return normalized;

  const headChars = Math.floor(maxChars * 0.7);
  const tailChars = Math.max(0, maxChars - headChars - 7);
  const head = normalized.slice(0, headChars);
  const tail = tailChars > 0 ? normalized.slice(-tailChars) : "";
  return tail ? `${head} [...] ${tail}` : head;
}

async function callPuterQuestionExtractionModel(prompt: string, models: string[] = PUTER_TEXT_MODELS): Promise<ExtractedQuestion[]> {
  const puterToken = process.env.PUTER_AUTH_TOKEN;
  if (!puterToken) {
    aiLog("warn", "PUTER-EXTRACT", "Skip Puter: missing PUTER_AUTH_TOKEN (server-side Puter API requires auth)");
    return [];
  }
  let lastError: HttpError | null = null;
  
  const requestPayload = (model: string) => ({
    model,
    temperature: 0,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "Bạn là bộ trích xuất câu hỏi trắc nghiệm. Chỉ trả về JSON hợp lệ, không thêm chữ ngoài JSON. Giữ nguyên tiếng Việt và giữ nguyên ký hiệu LaTeX (ví dụ $...$, \\\\(...\\\\), \\\\[...\\\\], \\\\frac).",
      },
      { role: "user", content: prompt },
    ],
  });

  for (const model of models) {
    const requiredModel = model;
    aiLog("info", "PUTER-EXTRACT", "Trying model", { model, required: requiredModel });
    
    // Retry logic với exponential backoff
    for (let attempt = 1; attempt <= PUTER_MAX_RETRIES; attempt++) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (puterToken) {
          headers.Authorization = `Bearer ${puterToken}`;
        }

        const res = await fetchWithTimeout(PUTER_OPENAI_BASE_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(requestPayload(model)),
        }, PUTER_TIMEOUT_MS);

        if (!res.ok) {
          const body = await res.text();
          aiLog("warn", "PUTER-EXTRACT", "Model failed", { model, attempt, status: res.status });
          
          // Nếu lỗi 4xx (client error), không retry
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            lastError = Object.assign(new Error(`Puter ${model} error: ${res.status}`), {
              details: body,
              status: res.status,
            }) as HttpError;
            break; // Thử model tiếp theo
          }
          
          // Nếu là 429 (rate limit) hoặc 5xx (server error), retry
          if (attempt < PUTER_MAX_RETRIES) {
            const delay = PUTER_RETRY_DELAY_MS * attempt;
            aiLog("info", "PUTER-EXTRACT", `Retrying after ${delay}ms`, { attempt, model });
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          
          lastError = Object.assign(new Error(`Puter ${model} error: ${res.status}`), {
            details: body,
            status: res.status,
          }) as HttpError;
          break;
        }

        const data = await res.json();
        const raw = extractAssistantText(data.choices?.[0]?.message?.content || "");
        try {
          const parsed = normalizeQuestions(parseJsonLenient(raw));
          if (parsed.length > 0) {
            aiLog("info", "PUTER-EXTRACT", "Model succeeded", { model, questions: parsed.length, attempt });
            return parsed;
          }
          // Nếu parse được nhưng không có question, thử lại
          aiLog("warn", "PUTER-EXTRACT", "Parsed but no questions", { model, attempt });
        } catch (parseError) {
          aiLog("warn", "PUTER-EXTRACT", "Parse error", { model, attempt, error: (parseError as Error).message });
        }
        
        // Nếu parse error hoặc không có questions, retry
        if (attempt < PUTER_MAX_RETRIES) {
          const delay = PUTER_RETRY_DELAY_MS * attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        
        break; // Hết retry, thử model tiếp theo
        
      } catch (error) {
        const httpError = error as HttpError;
        const isTimeout = httpError.status === 504;
        
        aiLog("warn", "PUTER-EXTRACT", "Request error", {
          model,
          attempt,
          status: httpError.status,
          message: httpError.message,
        });
        
        // Nếu timeout và còn retry, thử lại
        if (isTimeout && attempt < PUTER_MAX_RETRIES) {
          const delay = PUTER_RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
          aiLog("info", "PUTER-EXTRACT", `Timeout, retrying after ${delay}ms`, { attempt, model });
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        
        lastError = httpError;
        break; // Hết retry hoặc không phải timeout, thử model tiếp theo
      }
    }
  }

  if (lastError) throw lastError;
  return [];
}

async function callQuestionExtractionModel(prompt: string, preferredModel?: string): Promise<ExtractedQuestion[]> {
  let puterFailure: HttpError | null = null;
  let openRouterFailure: HttpError | null = null;

  aiLog("info", "EXTRACT", "Extraction strategy initialized", {
    lightweightMode: !ENABLE_PUTER_FOR_EXTRACTION,
    puterEnabled: ENABLE_PUTER_FOR_EXTRACTION,
    preferredModel: preferredModel || "(none)",
    puterExtractionModels: PUTER_EXTRACTION_MODELS.join(","),
  });

  // 1) Puter for extraction is optional (default off to keep extraction lightweight).
  if (ENABLE_PUTER_FOR_EXTRACTION) {
    try {
      aiLog("info", "EXTRACT", "Trying Puter first");
      const puterParsed = await callPuterQuestionExtractionModel(prompt, PUTER_EXTRACTION_MODELS);
      if (puterParsed.length > 0) {
        aiLog("info", "EXTRACT", "Puter primary succeeded", { questions: puterParsed.length });
        return puterParsed;
      }
      aiLog("info", "EXTRACT", "Puter returned no results, trying OpenRouter");
    } catch (error) {
      puterFailure = error as HttpError;
      const isTimeout = puterFailure.status === 504;

      if (isTimeout) {
        aiLog("warn", "EXTRACT", "Puter failed after retries (timeout), fallback to OpenRouter", {
          status: puterFailure.status,
          message: puterFailure.message,
        });
      } else {
        aiLog("warn", "EXTRACT", "Puter primary failed, fallback to OpenRouter", {
          status: puterFailure.status,
          message: puterFailure.message,
        });
      }
    }
  } else {
    aiLog("info", "EXTRACT", "Skip Puter extraction (lightweight mode)");
  }

  // 2) OpenRouter fallback
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    aiLog("info", "EXTRACT", "Trying OpenRouter fallback");
    const modelsToTry = [preferredModel, ...OPENROUTER_TEXT_MODELS].filter(
      (m, idx, arr): m is string => Boolean(m) && arr.indexOf(m) === idx
    );

    let lastError: HttpError | null = null;

    for (const model of modelsToTry) {
      try {
        aiLog("info", "OPENROUTER-EXTRACT", "Trying model", { model });
        const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouterKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            max_tokens: 1800,
            messages: [
              {
                role: "system",
                content:
                  "Bạn là bộ trích xuất câu hỏi trắc nghiệm. Chỉ trả về JSON hợp lệ, không thêm chữ ngoài JSON. Giữ nguyên tiếng Việt và giữ nguyên ký hiệu LaTeX (ví dụ $...$, \\\\(...\\\\), \\\\[...\\\\], \\\\frac).",
              },
              { role: "user", content: prompt },
            ],
          }),
        }, AI_TIMEOUT_MS);

        if (!res.ok) {
          const body = await res.text();
          aiLog("warn", "OPENROUTER-EXTRACT", "Model failed", { model, status: res.status });
          lastError = Object.assign(new Error(`OpenRouter ${model} error: ${res.status}`), { details: body, status: res.status });
          continue;
        }

        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || "";
        try {
          const parsed = normalizeQuestions(parseJsonLenient(raw));
          if (parsed.length > 0) {
            aiLog("info", "OPENROUTER-EXTRACT", "Model succeeded", { model, questions: parsed.length });
            return parsed;
          }
          aiLog("warn", "OPENROUTER-EXTRACT", "Model returned empty parse result", { model });
          lastError = Object.assign(new Error(`OpenRouter ${model} returned empty parse result`), { status: 422 }) as HttpError;
        } catch (parseError) {
          aiLog("warn", "OPENROUTER-EXTRACT", "Parse error", {
            model,
            error: (parseError as Error).message,
          });
          lastError = Object.assign(new Error(`OpenRouter ${model} parse error`), {
            status: 422,
            details: (parseError as Error).message,
          }) as HttpError;
        }
      } catch (error) {
        const httpError = error as HttpError;
        aiLog("warn", "OPENROUTER-EXTRACT", "Request error", {
          model,
          status: httpError.status,
          message: httpError.message,
        });
        lastError = httpError;
        continue;
      }
    }

    if (lastError) {
      const message = lastError.status === 401 ? "OpenRouter 401 (OPENROUTER_API_KEY không hợp lệ hoặc chưa nạp)" : (lastError.message || "OpenRouter error");
      aiLog("warn", "EXTRACT", "OpenRouter failed, fallback to Groq", {
        status: lastError.status,
        message,
      });
      openRouterFailure = Object.assign(new Error(message), { details: lastError.details, status: lastError.status }) as HttpError;
    }
  } else {
    aiLog("warn", "EXTRACT", "OPENROUTER_API_KEY missing, skip OpenRouter");
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    if (puterFailure) throw puterFailure;
    if (openRouterFailure) throw openRouterFailure;
    throw new Error("Thiếu GROQ_API_KEY");
  }

  // 3) Groq fallback
  aiLog("info", "EXTRACT", "Trying Groq fallback", { model: GROQ_TEXT_MODEL });

  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_TEXT_MODEL,
      temperature: 0,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content:
            "Bạn là bộ trích xuất câu hỏi trắc nghiệm. Chỉ trả về JSON hợp lệ, không thêm chữ ngoài JSON. Giữ nguyên tiếng Việt và giữ nguyên ký hiệu LaTeX (ví dụ $...$, \\\\(...\\\\), \\\\[...\\\\], \\\\frac).",
        },
        { role: "user", content: prompt },
      ],
    }),
  }, AI_TIMEOUT_MS);

  if (!res.ok) {
    const body = await res.text();
    const openRouterHint = openRouterFailure?.status === 429
      ? " | OpenRouter đang bị rate limit 429"
      : "";
    const puterHint = puterFailure ? " | Puter fallback thất bại" : "";
    const message = res.status === 401
      ? "Groq text 401 (GROQ_API_KEY không hợp lệ hoặc chưa nạp)"
      : `Groq text error: ${res.status}${openRouterHint}${puterHint}`;

    const detailLines: string[] = [];
    if (openRouterFailure?.details) {
      detailLines.push(`OpenRouter failure: ${openRouterFailure.details}`);
    }
    if (puterFailure?.details) {
      detailLines.push(`Puter failure: ${puterFailure.details}`);
    }
    detailLines.push(`Groq failure: ${body}`);

    const error: HttpError = Object.assign(new Error(message), {
      details: detailLines.join("\n"),
      status: res.status,
    });
    aiLog("error", "EXTRACT", "Groq fallback failed", { status: res.status });
    throw error;
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  try {
    const parsed = normalizeQuestions(parseJsonLenient(raw));
    aiLog("info", "EXTRACT", "Groq fallback succeeded", { questions: parsed.length });
    return parsed;
  } catch {
    return [];
  }
}

type AnswerResolutionPayload = {
  index?: unknown;
  correct_answer?: unknown;
  answer?: unknown;
};

function normalizeOptionLetter(value: unknown): "A" | "B" | "C" | "D" | null {
  const text = String(value || "").trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(text)) return text as "A" | "B" | "C" | "D";
  return null;
}

function parseResolvedAnswers(raw: string, questionCount: number): Array<"A" | "B" | "C" | "D" | null> {
  let parsed: unknown = [];
  try {
    parsed = parseJsonLenient(raw);
  } catch {
    return Array.from({ length: questionCount }, () => null);
  }

  if (!Array.isArray(parsed)) return Array.from({ length: questionCount }, () => null);

  const resolved = Array.from<"A" | "B" | "C" | "D" | null>({ length: questionCount }).fill(null);
  for (const row of parsed) {
    const candidate = row as AnswerResolutionPayload;
    const idx = Number(candidate.index);
    const answer = normalizeOptionLetter(candidate.correct_answer ?? candidate.answer);
    if (!Number.isFinite(idx)) continue;
    if (idx < 0 || idx >= questionCount) continue;
    if (!answer) continue;
    resolved[idx] = answer;
  }

  return resolved;
}

async function resolveAnswersWithAi(
  questions: ExtractedQuestion[],
  sourceText: string,
  preferredModel?: string
): Promise<ExtractedQuestion[]> {
  if (questions.length === 0) return questions;

  aiLog("info", "SOLVE", "Solve strategy initialized", {
    totalQuestions: questions.length,
    batchSize: SOLVE_BATCH_SIZE,
    preferredModel: preferredModel || "(none)",
    puterTimeoutMs: PUTER_TIMEOUT_MS,
  });

  if (questions.length > SOLVE_BATCH_SIZE) {
    aiLog("info", "SOLVE", "Large question set detected, solving in batches", {
      total: questions.length,
      batchSize: SOLVE_BATCH_SIZE,
    });

    const merged: ExtractedQuestion[] = [...questions];
    for (let start = 0; start < questions.length; start += SOLVE_BATCH_SIZE) {
      const end = Math.min(start + SOLVE_BATCH_SIZE, questions.length);
      const batch = questions.slice(start, end);
      const solvedBatch = await resolveAnswersWithAi(batch, sourceText, preferredModel);
      for (let i = 0; i < solvedBatch.length; i++) {
        merged[start + i] = solvedBatch[i];
      }
    }

    return merged;
  }

  const solvePrompt = `Hãy GIẢI và chọn đáp án đúng cho từng câu hỏi trắc nghiệm dưới đây.
Không được bỏ sót câu nào.
Chỉ trả về JSON mảng theo schema:
[
  {"index": 0, "correct_answer": "A"}
]

Danh sách câu hỏi:
${JSON.stringify(
  questions.map((q, index) => ({
    index,
    question: clampText(q.question, MAX_SOLVE_QUESTION_TEXT_CHARS),
    options: {
      A: clampText(q.options.A, MAX_SOLVE_OPTION_TEXT_CHARS),
      B: clampText(q.options.B, MAX_SOLVE_OPTION_TEXT_CHARS),
      C: clampText(q.options.C, MAX_SOLVE_OPTION_TEXT_CHARS),
      D: clampText(q.options.D, MAX_SOLVE_OPTION_TEXT_CHARS),
    },
  }))
)}

Văn bản nguồn để đối chiếu:
${buildContextSnippet(sourceText, SOLVE_SOURCE_CONTEXT_MAX_CHARS)}`;

  aiLog("info", "SOLVE", "Prompt compacted", {
    questions: questions.length,
    sourceChars: sourceText.length,
    sourceCharsSent: buildContextSnippet(sourceText, SOLVE_SOURCE_CONTEXT_MAX_CHARS).length,
  });

  aiLog("info", "SOLVE", "Start resolving answers", { questions: questions.length });
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const modelsToTry = [preferredModel, ...OPENROUTER_TEXT_MODELS].filter(
    (m, idx, arr): m is string => Boolean(m) && arr.indexOf(m) === idx
  );

  let openRouterFailure: HttpError | null = null;
  let puterFailure: HttpError | null = null;

  // 1) Puter solve first.
  const puterToken = process.env.PUTER_AUTH_TOKEN;
  if (!puterToken) {
    aiLog("warn", "PUTER-SOLVE", "Skip Puter solve first: missing PUTER_AUTH_TOKEN (server-side Puter API requires auth)");
  } else {
    for (const model of PUTER_TEXT_MODELS) {
      aiLog("info", "PUTER-SOLVE", "Trying model", { model });
      for (let attempt = 1; attempt <= PUTER_MAX_RETRIES; attempt++) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${puterToken}`,
          };

          const res = await fetchWithTimeout(PUTER_OPENAI_BASE_URL, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model,
              temperature: 0,
              max_tokens: 800,
              messages: [
                {
                  role: "system",
                  content: "Bạn là bộ giải câu hỏi trắc nghiệm. Chỉ trả về JSON hợp lệ theo schema index/correct_answer.",
                },
                { role: "user", content: solvePrompt },
              ],
            }),
          }, PUTER_TIMEOUT_MS);

          if (!res.ok) {
            const body = await res.text();
            puterFailure = Object.assign(new Error(`Puter ${model} solve error: ${res.status}`), {
              status: res.status,
              details: body,
            }) as HttpError;
            aiLog("warn", "PUTER-SOLVE", "Model failed", { model, attempt, status: res.status });

            if ((res.status === 429 || res.status >= 500) && attempt < PUTER_MAX_RETRIES) {
              const delay = PUTER_RETRY_DELAY_MS * attempt;
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            break;
          }

          const data = await res.json();
          const raw = extractAssistantText(data.choices?.[0]?.message?.content || "");
          const resolved = parseResolvedAnswers(raw, questions.length);
          if (resolved.some(Boolean)) {
            aiLog("info", "PUTER-SOLVE", "Model succeeded", { model, attempt });
            return questions.map((q, idx) => ({
              ...q,
              correct_answer: resolved[idx] || q.correct_answer,
            }));
          }

          aiLog("warn", "PUTER-SOLVE", "No usable answers returned", { model, attempt });
          if (attempt < PUTER_MAX_RETRIES) {
            const delay = PUTER_RETRY_DELAY_MS * attempt;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          break;
        } catch (error) {
          const httpError = error as HttpError;
          puterFailure = httpError;
          aiLog("warn", "PUTER-SOLVE", "Request error", {
            model,
            attempt,
            status: httpError.status,
            message: httpError.message,
          });

          if (httpError.status === 504 && attempt < PUTER_MAX_RETRIES) {
            const delay = PUTER_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          break;
        }
      }
    }
  }

  // 2) OpenRouter solve fallback.
  if (openRouterKey) {
    for (const model of modelsToTry) {
      aiLog("info", "OPENROUTER-SOLVE", "Trying model", { model });
      const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 800,
          messages: [
            {
              role: "system",
              content: "Bạn là bộ giải câu hỏi trắc nghiệm. Chỉ trả về JSON hợp lệ theo schema index/correct_answer.",
            },
            { role: "user", content: solvePrompt },
          ],
        }),
      }, AI_TIMEOUT_MS);

      if (!res.ok) {
        const body = await res.text();
        openRouterFailure = Object.assign(new Error(`OpenRouter ${model} solve error: ${res.status}`), {
          status: res.status,
          details: body,
        }) as HttpError;
        aiLog("warn", "OPENROUTER-SOLVE", "Model failed", { model, status: res.status });
        continue;
      }

      const data = await res.json();
      const raw = extractAssistantText(data.choices?.[0]?.message?.content || "");
      const resolved = parseResolvedAnswers(raw, questions.length);
      if (resolved.some(Boolean)) {
        aiLog("info", "OPENROUTER-SOLVE", "Model succeeded", { model });
        return questions.map((q, idx) => ({
          ...q,
          correct_answer: resolved[idx] || q.correct_answer,
        }));
      }
    }
  } else {
    aiLog("warn", "OPENROUTER-SOLVE", "OPENROUTER_API_KEY missing, skip OpenRouter solve");
  }

  // 3) Groq solve fallback.
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    aiLog("warn", "GROQ-SOLVE", "GROQ_API_KEY missing, skip Groq solve");
    return questions;
  }

  aiLog("info", "GROQ-SOLVE", "Trying Groq solve fallback", { model: GROQ_TEXT_MODEL });
  const groqRes = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_TEXT_MODEL,
      temperature: 0,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: "Bạn là bộ giải câu hỏi trắc nghiệm. Chỉ trả về JSON hợp lệ theo schema index/correct_answer.",
        },
        { role: "user", content: solvePrompt },
      ],
    }),
  }, AI_TIMEOUT_MS);

  if (!groqRes.ok) {
    const body = await groqRes.text();
    aiLog("error", "GROQ-SOLVE", "Groq solve failed", { status: groqRes.status });
    const detail: string[] = [];
    if (openRouterFailure?.details) detail.push(`OpenRouter solve failure: ${openRouterFailure.details}`);
    if (puterFailure?.details) detail.push(`Puter solve failure: ${puterFailure.details}`);
    detail.push(`Groq solve failure: ${body}`);
    throw Object.assign(new Error(`Không thể giải đáp án bằng cả 3 AI (Groq status ${groqRes.status})`), {
      details: detail.join("\n"),
      status: groqRes.status,
    }) as HttpError;
  }

  const groqData = await groqRes.json();
  const groqRaw = extractAssistantText(groqData.choices?.[0]?.message?.content || "");
  const groqResolved = parseResolvedAnswers(groqRaw, questions.length);
  if (groqResolved.some(Boolean)) {
    aiLog("info", "GROQ-SOLVE", "Groq solve succeeded", { solved: groqResolved.filter(Boolean).length });
    return questions.map((q, idx) => ({
      ...q,
      correct_answer: groqResolved[idx] || q.correct_answer,
    }));
  }

  aiLog("warn", "SOLVE", "All solver providers returned no usable answer mapping; keeping current answers");
  return questions;
}

async function generateQuestionsFromChunk(text: string, limit: number): Promise<ExtractedQuestion[]> {
  aiLog("info", "PIPELINE", "Chunk extraction started", {
    mode: ENABLE_PUTER_FOR_EXTRACTION ? "hybrid+puter-enabled" : "lightweight-preferred",
    chunkChars: text.length,
    limit,
  });

  const heuristic = parseQuestionsHeuristically(text).slice(0, limit);
  aiLog("info", "PIPELINE", "Heuristic extraction result", {
    extracted: heuristic.length,
    limit,
  });

  if (heuristic.length >= limit) {
    aiLog("info", "PIPELINE", "Heuristic extraction satisfied chunk", {
      extracted: heuristic.length,
      limit,
    });

    if (ENABLE_ANSWER_SOLVING) {
      const solved = await resolveAnswersWithAi(heuristic, text, STEPFUN_TEXT_MODEL);
      aiLog("info", "PIPELINE", "Chunk completed", { extracted: solved.length, solved: true, mode: "heuristic" });
      return solved.slice(0, limit);
    }

    aiLog("info", "PIPELINE", "Chunk completed", { extracted: heuristic.length, solved: false, mode: "heuristic" });
    return heuristic;
  }

  const indices = detectQuestionIndices(text);
  const expected = indices.slice(0, limit);
  const extractionSource = buildContextSnippet(text, EXTRACT_SOURCE_CONTEXT_MAX_CHARS);
  const extractionPrompt = `Nhiệm vụ: bóc tách các câu trắc nghiệm có sẵn từ văn bản, KHÔNG tự sáng tác câu mới.

Yêu cầu bắt buộc:
1) Giữ nguyên tiếng Việt và giữ nguyên LaTeX trong question/options.
2) Mỗi câu phải có đủ options A/B/C/D (nếu thiếu thì để chuỗi rỗng).
3) Nếu không chắc đáp án đúng thì đặt correct_answer = "A".
4) Nếu thấy chỉ số câu trong đề (ví dụ Câu 1, 2.), điền vào source_index.
5) Nếu có danh sách chỉ số bên dưới, phải trả đủ các chỉ số đó, không bỏ sót.

Schema JSON:
[
  {
    "source_index": 1,
    "question": "...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_answer": "A"
  }
]

Chỉ số nhận diện được: ${expected.length ? expected.join(", ") : "(không nhận diện được chỉ số rõ ràng)"}
Giới hạn tối đa ${limit} câu trong lần trả lời này.

Văn bản nguồn:
${extractionSource}`;

  aiLog("info", "PIPELINE", "Extraction prompt compacted", {
    chunkChars: text.length,
    sourceCharsSent: extractionSource.length,
  });

  aiLog("info", "PIPELINE", "Start extraction for chunk", { chunkChars: text.length, limit });
  const extracted = await callQuestionExtractionModel(extractionPrompt);
  const picked = extracted.slice(0, limit);
  aiLog("info", "PIPELINE", "AI extraction supplement result", {
    extractedByAi: picked.length,
    heuristicSeed: heuristic.length,
    limit,
  });

  let merged: ExtractedQuestion[] = [...heuristic];
  for (const q of picked) {
    if (q.source_index && merged.some((it) => it.source_index === q.source_index)) continue;
    if (merged.some((it) => it.question === q.question)) continue;
    merged.push(q);
    if (merged.length >= limit) break;
  }

  if (expected.length > 0) {
    const seen = new Set<number>();
    for (const q of merged) {
      if (q.source_index) seen.add(q.source_index);
    }

    const missing = expected.filter((idx) => !seen.has(idx));
    if (missing.length > 0) {
      aiLog("warn", "PIPELINE", "Detected missing questions, running recovery", { missing: missing.join(",") });
      const recoveryPrompt = `Bạn đã bỏ sót một số câu. Chỉ trả về JSON cho các câu có source_index thuộc danh sách sau: ${missing.join(", ")}.
Không trả lại các câu đã có. Giữ nguyên tiếng Việt và LaTeX.

Schema JSON:
[
  {
    "source_index": 1,
    "question": "...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_answer": "A"
  }
]

Văn bản nguồn:
${buildContextSnippet(text, RECOVERY_SOURCE_CONTEXT_MAX_CHARS)}`;

      const recovered = await callQuestionExtractionModel(recoveryPrompt, STEPFUN_TEXT_MODEL);
  merged = [...merged, ...recovered].reduce<ExtractedQuestion[]>((acc, q) => {
        if (q.source_index && acc.some((it) => it.source_index === q.source_index)) return acc;
        if (acc.some((it) => it.question === q.question)) return acc;
        acc.push(q);
        return acc;
      }, []);
    }
  }

  if (needsLatexRepair(merged)) {
    aiLog("info", "PIPELINE", "Detected broken LaTeX, running repair with Stepfun");
    const repairPrompt = `Sửa lỗi LaTeX cho các câu hỏi sau và giữ nguyên nghĩa tiếng Việt. Không bỏ sót câu nào, không thêm câu mới.
Trả về JSON đúng schema cũ. Nếu có source_index thì giữ nguyên source_index.

JSON hiện tại:
${JSON.stringify(merged)}

Văn bản nguồn để đối chiếu:
${buildContextSnippet(text, RECOVERY_SOURCE_CONTEXT_MAX_CHARS)}`;

    const repaired = await callQuestionExtractionModel(repairPrompt, STEPFUN_TEXT_MODEL);
    if (repaired.length > 0) {
      merged = repaired.reduce<ExtractedQuestion[]>((acc, q) => {
        if (q.source_index && acc.some((it) => it.source_index === q.source_index)) return acc;
        if (acc.some((it) => it.question === q.question)) return acc;
        acc.push(q);
        return acc;
      }, []);
    }
  }

  if (ENABLE_ANSWER_SOLVING) {
    if (merged.length === 0) {
      aiLog("warn", "PIPELINE", "Skip solve stage because extraction returned zero questions", {
        source: "post-extraction",
      });
      aiLog("info", "PIPELINE", "Chunk completed", { extracted: 0, solved: false });
      return [];
    }

    aiLog("info", "PIPELINE", "Starting solve stage", {
      totalQuestions: merged.length,
      source: "post-extraction",
    });
    const solved = await resolveAnswersWithAi(merged, text, STEPFUN_TEXT_MODEL);
    aiLog("info", "PIPELINE", "Chunk completed", { extracted: solved.length, solved: true });
    return solved.slice(0, limit);
  }

  aiLog("info", "PIPELINE", "Chunk completed", { extracted: merged.length, solved: false });
  return merged.slice(0, limit);
}

export async function buildQuestionsFromUploads(files: File[], manualText: string) {
  const texts: string[] = [];
  const sources: Array<{ name: string; chars: number; kind: "image" | "pdf" | "text" }> = [];

  // Process multiple files in parallel để tăng tốc
  const ocrResults = await Promise.all(
    files.map(async (file) => {
      try {
        const { text, source } = await ocrFile(file);
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        return { text, source, kind: (isPdf ? "pdf" : "image") as "image" | "pdf" };
      } catch (error) {
        console.warn(`OCR failed for ${file.name}:`, error);
        return null;
      }
    })
  );

  // Collect successful OCR results
  for (const result of ocrResults) {
    if (result && result.text) {
      texts.push(result.text);
      sources.push({ name: result.source, chars: result.text.length, kind: result.kind });
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
  const all: ExtractedQuestion[] = [];

  for (const chunk of chunks) {
    const estimatedInChunk = estimateQuestionCountInChunk(chunk);
    const chunkLimit = estimatedInChunk;
    aiLog("info", "PIPELINE", "Chunk question estimate", {
      chunkChars: chunk.length,
      estimatedInChunk,
      chunkLimit,
    });

    const questions = await generateQuestionsFromChunk(chunk, chunkLimit);
    all.push(...questions);
  }

  const unique = all.reduce<ExtractedQuestion[]>((acc, q) => {
    if (q.source_index && acc.find((ex) => ex.source_index === q.source_index)) return acc;
    if (
      acc.find(
        (ex) =>
          ex.question === q.question &&
          ex.options.A === q.options.A &&
          ex.options.B === q.options.B &&
          ex.options.C === q.options.C &&
          ex.options.D === q.options.D
      )
    ) {
      return acc;
    }
    acc.push(q);
    return acc;
  }, []);

  const expectedIndices = detectQuestionIndices(cleanedText);
  if (expectedIndices.length > 0 && unique.length < expectedIndices.length) {
    const seen = new Set<number>(unique.map((q) => q.source_index).filter((v): v is number => Number.isFinite(v)));
    const missing = expectedIndices.filter((idx) => !seen.has(idx));

    if (missing.length > 0) {
      aiLog("warn", "PIPELINE", "Final global recovery for missing indices", { missing: missing.join(",") });
      const recoveryPrompt = `Bạn đang khôi phục các câu còn thiếu theo source_index từ toàn bộ văn bản.
Chỉ trả về các câu có source_index thuộc danh sách: ${missing.join(", ")}.
Không trả lại câu đã có. Giữ nguyên tiếng Việt và LaTeX.

Schema JSON:
[
  {
    "source_index": 1,
    "question": "...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_answer": "A"
  }
]

Văn bản nguồn:
${cleanedText}`;

      const recovered = await callQuestionExtractionModel(recoveryPrompt, STEPFUN_TEXT_MODEL);
      for (const q of recovered) {
        if (q.source_index && unique.some((it) => it.source_index === q.source_index)) continue;
        if (
          unique.some(
            (it) =>
              it.question === q.question &&
              it.options.A === q.options.A &&
              it.options.B === q.options.B &&
              it.options.C === q.options.C &&
              it.options.D === q.options.D
          )
        ) {
          continue;
        }
        unique.push(q);
      }
    }
  }

  if (unique.length === 0) {
    throw new Error("AI did not return any questions");
  }

  const questions = unique.map(({ source_index: _sourceIndex, ...rest }) => rest);

  return {
    cleanedText,
    questions,
    sources,
  };
}
