import sharp from "sharp";

const OPENROUTER_EXTRACT_MODEL = process.env.MATH_EXTRACT_MODEL || "openrouter/owl-alpha";
const OPENROUTER_EXTRACT_MODELS = (process.env.MATH_EXTRACT_MODELS || `${OPENROUTER_EXTRACT_MODEL}`)
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const GROQ_SOLVE_MODEL = "qwen/qwen3-32b";
const EXTRACT_MODEL_RETRIES = 2;
const OPENROUTER_SOLVE_MODEL = process.env.MATH_SOLVER_MODEL || "qwen/qwen-plus";
const OPENROUTER_SOLVE_MODELS = (process.env.MATH_SOLVER_MODELS || `${OPENROUTER_SOLVE_MODEL},openrouter/owl-alpha`)
  .split(",")
  .map((x) => x.trim())
  .filter((x) => Boolean(x) && x !== "stepfun/step-3.5-flash:free");
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_RECHECK_MODEL = "openrouter/owl-alpha";
const OCR_SPACE_API_URL = "https://api.ocr.space/parse/image";
const IS_VERCEL_RUNTIME = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
const REQUEST_TIME_BUDGET_MS = IS_VERCEL_RUNTIME ? 55000 : 180000;
const MIN_REMAINING_FOR_EXTRACTION_MS = IS_VERCEL_RUNTIME ? 18000 : 10000;
const MIN_REMAINING_FOR_RECOVERY_MS = IS_VERCEL_RUNTIME ? 15000 : 8000;
const MIN_REMAINING_FOR_SOLVE_MS = IS_VERCEL_RUNTIME ? 20000 : 10000;

const MAX_TEXT_LENGTH = 15000;
const TEXT_CHUNK_SIZE = 3500;
const OCR_TIMEOUT_MS = IS_VERCEL_RUNTIME ? 14000 : 22000;
const AI_TIMEOUT_MS = IS_VERCEL_RUNTIME ? 18000 : 105000;
const ENABLE_ANSWER_SOLVING = process.env.AI_ENABLE_ANSWER_SOLVING !== "false";
const SOLVE_BATCH_SIZE = 8;
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

function hasTimeBudget(deadlineAt: number | undefined, minRemainingMs: number): boolean {
  if (!deadlineAt) return true;
  return deadlineAt - Date.now() > minRemainingMs;
}

function remainingBudgetMs(deadlineAt: number | undefined): number | null {
  if (!deadlineAt) return null;
  return Math.max(0, deadlineAt - Date.now());
}

export interface GeneratedQuestion {
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correct_answer: "A" | "B" | "C" | "D";
  ai_solve_status?: "solved" | "unsolved";
}

interface OcrResult {
  text: string;
  source: string;
}

interface ExtractedQuestion extends GeneratedQuestion {
  source_index?: number;
}

function normalizeForDedup(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function questionFingerprint(question: Pick<ExtractedQuestion, "question" | "options">): string {
  return [
    normalizeForDedup(question.question || ""),
    normalizeForDedup(question.options.A || ""),
    normalizeForDedup(question.options.B || ""),
    normalizeForDedup(question.options.C || ""),
    normalizeForDedup(question.options.D || ""),
  ].join("||");
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

function parseProviderResponseLenient(raw: string): unknown {
  const attempts = [
    raw,
    repairJsonCandidate(raw),
    closeDanglingJson(raw),
    closeDanglingJson(repairJsonCandidate(raw)),
  ];

  let lastError: Error | null = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error("Unable to parse provider response JSON");
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

function normalizeLatexText(text: string): string {
  if (!text) return text;

  return text
    // Repair corrupted \left/\right after \le/\ge normalization.
    .replace(/≤ft/g, "\\left")
    .replace(/≥ight/g, "\\right")
    .replace(/\\{2,}(?=(?:left|right|frac|sqrt|sum|int|lim|sin|cos|tan|log|ln|pi|alpha|beta|gamma|theta)\b)/gi, "\\")
    .replace(/\*\*/g, "")
    // Common corruption patterns from model outputs
    .replace(/\/\s*fraq/gi, "\\\\frac")
    .replace(/\/\s*frac/gi, "\\\\frac")
    .replace(/\\\s*fraq/gi, "\\\\frac")
    .replace(/\\\s*frac/gi, "\\\\frac")
    .replace(/\bfrac\s*([0-9])\s*([0-9]{1,2})\b/gi, "\\\\frac{$1}{$2}")
    .replace(/\\\s*sqrt/gi, "\\\\sqrt")
    // Force unicode root forms back to LaTeX for consistent MathText rendering.
    .replace(/(?:\\\s*)?√\s*\(([^()]+)\)/g, "\\\\sqrt{$1}")
    .replace(/(?:\\\s*)?√\s*\{([^{}]+)\}/g, "\\\\sqrt{$1}")
    .replace(/\\\s*times/gi, "\\\\times")
    // Normalize escaped spacing like "\\ frac"
    .replace(/\\\s+([a-zA-Z]+)/g, "\\\\$1");
}

function toHumanReadableMath(text: string): string {
  if (!text) return text;

  return normalizeLatexText(text)
    .replace(/(^|[^\w\\])(\d{1,4})\s*\/\s*(\d{1,4})(?=$|[^\w])/g, (_m, pre, a, b) => `${pre}\\frac{${a}}{${b}}`)
    .replace(/\\times|\\cdot/gi, "×")
    .replace(/\\div/gi, "÷")
    .replace(/\\pm/gi, "±")
    .replace(/\\leq?(?![a-zA-Z])/gi, "≤")
    .replace(/\\geq?(?![a-zA-Z])/gi, "≥")
    .replace(/\\neq/gi, "≠")
    .replace(/\\approx/gi, "≈")
    .replace(/\\infty/gi, "∞")
    .replace(/\\pi/gi, "π")
    .replace(/\\alpha/gi, "α")
    .replace(/\\beta/gi, "β")
    .replace(/\\gamma/gi, "γ")
    .replace(/\*\*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function ensureInlineMathDelimiters(text: string): string {
  if (!text) return text;

  const protectedSegments: string[] = [];
  const placeholderPrefix = "@@MATH_SEGMENT_";
  const withPlaceholders = text.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+\$/g, (segment) => {
    const idx = protectedSegments.push(segment) - 1;
    return `${placeholderPrefix}${idx}@@`;
  });

  const bareMathRegex =
    /(^|[\s(\[{:;=,+\-])((?:\\(?:frac\s*\{[^{}]+\}\s*\{[^{}]+\}|sqrt\s*\{[^{}]+\}|sum|int|lim|sin|cos|tan|log|ln|pi|alpha|beta|gamma|theta)|[A-Za-z0-9]+(?:_\{[^{}]+\}|_[A-Za-z0-9]+|\^\{[^{}]+\}|\^[A-Za-z0-9]+){1,3}))(?=($|[\s)\]}:;,.!?]))/g;

  const latexChunkRegex =
    /(^|[\s(\[{:;])([^$\n]*\\[a-zA-Z]+[^$\n]*)(?=($|[\s)\]}:;,.!?]))/g;

  const operatorMathRegex =
    /(^|[\s(\[{:;])([A-Za-z0-9]+(?:\s*[+\-*/=]\s*[A-Za-z0-9]+){1,}|[≤≥≠±∞π][^$\n]*)(?=($|[\s)\]}:;,.!?]))/g;

  let wrapped = withPlaceholders.replace(bareMathRegex, (_m, leading, expr) => `${leading}$${expr}$`);
  wrapped = wrapped.replace(latexChunkRegex, (_m, leading, expr) => `${leading}$${expr.trim()}$`);
  wrapped = wrapped.replace(operatorMathRegex, (_m, leading, expr) => `${leading}$${expr.trim()}$`);

  return wrapped.replace(new RegExp(`${placeholderPrefix}(\\d+)@@`, "g"), (_m, idx) => {
    const parsed = Number.parseInt(idx, 10);
    return Number.isFinite(parsed) ? protectedSegments[parsed] || "" : "";
  });
}

function formatMathForRender(text: string): string {
  return ensureInlineMathDelimiters(toHumanReadableMath(text));
}

function splitBundledQuestionBlocks(text: string): string[] {
  const markers = [...text.matchAll(/(?:^|\s)(?:\*\*)?Câu\s*\d+\s*[\).:]/gim)].map((m) => m.index || 0);
  if (markers.length < 2) return [];

  const blocks: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1] : text.length;
    const block = text.slice(start, end).trim();
    if (block) blocks.push(block);
  }
  return blocks;
}

function parseQuestionBlock(block: string): ExtractedQuestion | null {
  const sourceIdxMatch = block.match(/Câu\s*(\d+)\s*[\).:]/i);
  const sourceIndex = sourceIdxMatch ? Number.parseInt(sourceIdxMatch[1], 10) : NaN;

  const optionRegex = /(?:\*\*)?\b([ABCD])\s*[\).:]\s*(?:\*\*)?/g;
  const matches = [...block.matchAll(optionRegex)];
  if (matches.length < 4) return null;

  const firstOptionIndex = matches[0].index || 0;
  const stemRaw = block.slice(0, firstOptionIndex).replace(/^(?:\*\*)?Câu\s*\d+\s*[\).:]\s*/i, "").trim();

  const options: Record<"A" | "B" | "C" | "D", string> = { A: "", B: "", C: "", D: "" };
  for (let i = 0; i < matches.length; i++) {
    const key = (matches[i][1] || "").toUpperCase() as "A" | "B" | "C" | "D";
    if (!["A", "B", "C", "D"].includes(key)) continue;
    const valueStart = (matches[i].index || 0) + matches[i][0].length;
    const valueEnd = i + 1 < matches.length ? (matches[i + 1].index || block.length) : block.length;
    options[key] = normalizeLatexText(block.slice(valueStart, valueEnd).trim());
  }

  const question = stripLeadingQuestionPrefix(normalizeLatexText(stemRaw), sourceIndex);
  if (!question) return null;

  return {
    ...(Number.isFinite(sourceIndex) && sourceIndex > 0 ? { source_index: sourceIndex } : {}),
    question,
    options,
    correct_answer: "A",
  };
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
    const question = stripLeadingQuestionPrefix(current.question.trim(), current.source_index);
    if (!question) return;
    results.push({
      ...current,
      question,
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
    if (optionMatch && !current) {
      current = {
        question: "",
        options: { A: "", B: "", C: "", D: "" },
        correct_answer: "A",
      };
    }

    if (optionMatch && current) {
      const key = optionMatch[1].toUpperCase() as "A" | "B" | "C" | "D";

      // If a fresh A option appears after a full A/B/C/D set, start a new question block.
      if (key === "A" && current.options.A && current.options.B && current.options.C && current.options.D) {
        pushCurrent();
        current = {
          question: "",
          options: { A: "", B: "", C: "", D: "" },
          correct_answer: "A",
        };
      }

      current.options[key] = optionMatch[2] || "";
      currentOption = key;
      continue;
    }

    if (!current) {
      current = {
        question: line,
        options: { A: "", B: "", C: "", D: "" },
        correct_answer: "A",
      };
      currentOption = null;
      continue;
    }

    // If we've already captured full options and hit plain text, treat it as the next question stem.
    if (current.options.A && current.options.B && current.options.C && current.options.D) {
      pushCurrent();
      current = {
        question: line,
        options: { A: "", B: "", C: "", D: "" },
        correct_answer: "A",
      };
      currentOption = null;
      continue;
    }

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
    .flatMap<ExtractedQuestion>((candidate) => {
      const q = candidate as AiQuestionPayload;
      const sourceIndexRaw = q.source_index;
      const sourceIndex = Number.parseInt(sourceIndexRaw?.toString() || "", 10);
      const question = stripLeadingQuestionPrefix(
        normalizeLatexText(q.question?.toString().trim() || ""),
        sourceIndex
      );
      const bundledBlocks = splitBundledQuestionBlocks(question);
      if (bundledBlocks.length > 0) {
        const expanded = bundledBlocks
          .map((block) => parseQuestionBlock(block))
          .filter((item): item is ExtractedQuestion => item !== null);
        if (expanded.length > 0) return expanded;
      }

      const optionsRecord = q.options || {};
      const correctRaw = q.correct_answer?.toString().trim().toUpperCase();
      if (!question) return [];
      const opt: Record<"A" | "B" | "C" | "D", string> = {
        A: normalizeLatexText(optionsRecord.A?.toString().trim() || ""),
        B: normalizeLatexText(optionsRecord.B?.toString().trim() || ""),
        C: normalizeLatexText(optionsRecord.C?.toString().trim() || ""),
        D: normalizeLatexText(optionsRecord.D?.toString().trim() || ""),
      };
      const firstNonEmpty = (Object.entries(opt).find(([, v]) => v)?.[0] as "A" | "B" | "C" | "D") || "A";
      const correctAnswer = ["A", "B", "C", "D"].includes(correctRaw || "")
        ? (correctRaw as "A" | "B" | "C" | "D")
        : firstNonEmpty;
      return [{
        ...(Number.isFinite(sourceIndex) && sourceIndex > 0 ? { source_index: sourceIndex } : {}),
        question,
        options: opt,
        correct_answer: correctAnswer,
      } satisfies ExtractedQuestion];
    })
    .filter((q) => {
      if (!q.question?.trim()) return false;
      const hasAnyOption = Object.values(q.options).some((v) => v.trim().length > 0);
      return hasAnyOption;
    });

  return normalized;
}

function buildManualFallbackQuestion(sourceText: string): ExtractedQuestion {
  const normalized = compactWhitespace(sourceText);
  const stem = formatMathForRender(normalizeLatexText(clampText(normalized, 420)));
  return {
    question: stem || "Nội dung dán vào chưa đủ cấu trúc để tách câu hỏi tự động.",
    options: {
      A: "",
      B: "",
      C: "",
      D: "",
    },
    correct_answer: "A",
    ai_solve_status: "unsolved",
  };
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

function stripLeadingQuestionPrefix(text: string, sourceIndex?: number): string {
  if (!text) return text;

  let cleaned = text.trim().replace(/^#{1,6}\s+/g, "");
  for (let i = 0; i < 4; i++) {
    const previous = cleaned;
    cleaned = cleaned
      .replace(/^(?:\*\*)?Câu\s*\d{1,4}\s*[\).:\-]\s*/i, "")
      .replace(/^(?:\*\*)?Q(?:uestion)?\s*\d{1,4}\s*[\).:\-]\s*/i, "")
      .replace(/^\d{1,4}\s*[\).:\-]\s*/, "")
      .trim();
    if (cleaned === previous) break;
  }

  if (sourceIndex && Number.isFinite(sourceIndex) && sourceIndex > 0) {
    const sourceIndexPrefix = new RegExp(`^(?:\\*\\*)?Câu\\s*${sourceIndex}\\s*[\\).:\\-]\\s*`, "i");
    cleaned = cleaned.replace(sourceIndexPrefix, "").trim();
  }

  return cleaned;
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

async function recheckQuestionsWithOwlAlpha(
  questions: ExtractedQuestion[],
  sourceText: string,
  deadlineAt?: number
): Promise<ExtractedQuestion[]> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) return questions;
  if (!hasTimeBudget(deadlineAt, MIN_REMAINING_FOR_RECOVERY_MS)) return questions;
  if (questions.length === 0) return questions;

  const prompt = `Rà soát cực nhanh và sửa lỗi LaTeX/Math nếu có. Giữ nguyên nội dung.
Chỉ trả JSON mảng theo schema cũ.

JSON:
${JSON.stringify(questions)}

Nguồn:
${buildContextSnippet(sourceText, 1200)}`;

  try {
    const res = await fetchWithTimeout(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_RECHECK_MODEL,
        temperature: 0,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "Bạn là bộ rà soát LaTeX/Math. Trả về JSON hợp lệ, giữ nguyên tiếng Việt.",
          },
          { role: "user", content: prompt },
        ],
      }),
    }, AI_TIMEOUT_MS);

    if (!res.ok) {
      aiLog("warn", "OWL-RECHECK", "Request failed", { status: res.status });
      return questions;
    }

    const responseText = await res.text();
    const data = parseProviderResponseLenient(responseText) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const raw = extractAssistantText(data.choices?.[0]?.message?.content || "");
    const parsed = normalizeQuestions(parseJsonLenient(raw));
    return parsed.length > 0 ? parsed : questions;
  } catch (error) {
    aiLog("warn", "OWL-RECHECK", "Request error", { message: (error as Error).message });
    return questions;
  }
}

async function callQuestionExtractionModel(prompt: string, preferredModel?: string): Promise<ExtractedQuestion[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Thiếu OPENROUTER_API_KEY");

  const uniqueModels = Array.from(new Set([preferredModel, ...OPENROUTER_EXTRACT_MODELS].filter(Boolean) as string[]));
  const models = uniqueModels.length > 0 ? uniqueModels : [OPENROUTER_EXTRACT_MODEL];

  aiLog("info", "EXTRACT", "Extraction strategy initialized", {
    provider: "openrouter-only",
    models,
    retries: EXTRACT_MODEL_RETRIES,
    preferredModel: preferredModel || "(none)",
  });

  let lastError: HttpError | null = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= EXTRACT_MODEL_RETRIES; attempt++) {
      try {
        aiLog("info", "OPENROUTER-EXTRACT", "Trying model", { model, attempt });
        const res = await fetchWithTimeout(OPENROUTER_BASE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            max_tokens: 1200,
            messages: [
              {
                role: "system",
                content:
                  "Bạn là bộ trích xuất câu hỏi trắc nghiệm. Chỉ trả về JSON hợp lệ, không thêm chữ ngoài JSON. Giữ nguyên tiếng Việt và giữ nguyên ký hiệu LaTeX (ví dụ $...$, \\(...\\), \\[...\\], \\frac).",
              },
              { role: "user", content: prompt },
            ],
          }),
        }, AI_TIMEOUT_MS);

        if (!res.ok) {
          const body = await res.text();
          lastError = Object.assign(new Error(`OpenRouter ${model} extract error: ${res.status}`), {
            details: body,
            status: res.status,
          }) as HttpError;
          aiLog("warn", "OPENROUTER-EXTRACT", "Request failed", { model, status: res.status, attempt });
          continue;
        }

        const responseText = await res.text();
        try {
          const data = parseProviderResponseLenient(responseText) as {
            choices?: Array<{ message?: { content?: unknown } }>;
          };
          const raw = extractAssistantText(data.choices?.[0]?.message?.content || "");
          const parsed = normalizeQuestions(parseJsonLenient(raw));
          if (parsed.length > 0) {
            aiLog("info", "OPENROUTER-EXTRACT", "Model succeeded", {
              model,
              attempt,
              questions: parsed.length,
            });
            return parsed;
          }

          lastError = Object.assign(new Error(`OpenRouter ${model} extract returned empty result`), {
            status: 422,
          }) as HttpError;
          aiLog("warn", "OPENROUTER-EXTRACT", "Parsed but empty", { model, attempt });
        } catch (parseError) {
          lastError = Object.assign(new Error((parseError as Error).message), { status: 422 }) as HttpError;
          aiLog("warn", "OPENROUTER-EXTRACT", "Parse error", {
            model,
            attempt,
            error: (parseError as Error).message,
          });
        }
      } catch (error) {
        const httpError = error as HttpError;
        lastError = httpError;
        aiLog("warn", "OPENROUTER-EXTRACT", "Request error", {
          model,
          attempt,
          status: httpError.status,
          message: httpError.message,
        });
      }
    }
  }

  if (lastError) throw lastError;
  return [];
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

function applySolveResults(
  questions: ExtractedQuestion[],
  resolved: Array<"A" | "B" | "C" | "D" | null>
): ExtractedQuestion[] {
  return questions.map((q, idx) => {
    const answer = resolved[idx];
    if (answer) {
      return {
        ...q,
        correct_answer: answer,
        ai_solve_status: "solved",
      };
    }

    return {
      ...q,
      correct_answer: "A",
      ai_solve_status: "unsolved",
    };
  });
}

function markAllUnsolved(questions: ExtractedQuestion[]): ExtractedQuestion[] {
  return questions.map((q) => ({
    ...q,
    correct_answer: "A",
    ai_solve_status: "unsolved",
  }));
}

async function resolveAnswersWithAi(
  questions: ExtractedQuestion[],
  sourceText: string,
  preferredModel?: string,
  deadlineAt?: number
): Promise<ExtractedQuestion[]> {
  if (questions.length === 0) return questions;

  if (!hasTimeBudget(deadlineAt, MIN_REMAINING_FOR_SOLVE_MS)) {
    aiLog("warn", "SOLVE", "Skip solve due low remaining budget", {
      remainingMs: remainingBudgetMs(deadlineAt),
    });
    return markAllUnsolved(questions);
  }

  aiLog("info", "SOLVE", "Solve strategy initialized", {
    totalQuestions: questions.length,
    batchSize: SOLVE_BATCH_SIZE,
    preferredModel: preferredModel || "(none)",
  });

  if (questions.length > SOLVE_BATCH_SIZE) {
    aiLog("info", "SOLVE", "Large question set detected, solving in batches", {
      total: questions.length,
      batchSize: SOLVE_BATCH_SIZE,
    });

    const merged: ExtractedQuestion[] = markAllUnsolved(questions);
    for (let start = 0; start < questions.length; start += SOLVE_BATCH_SIZE) {
      const end = Math.min(start + SOLVE_BATCH_SIZE, questions.length);
      const batch = questions.slice(start, end);
      const solvedBatch = await resolveAnswersWithAi(batch, sourceText, preferredModel, deadlineAt);
      for (let i = 0; i < solvedBatch.length; i++) {
        merged[start + i] = solvedBatch[i];
      }

      if (!hasTimeBudget(deadlineAt, MIN_REMAINING_FOR_SOLVE_MS)) {
        aiLog("warn", "SOLVE", "Stop additional solve batches due low remaining budget", {
          remainingMs: remainingBudgetMs(deadlineAt),
        });
        break;
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

  let openRouterFailure: HttpError | null = null;
  const openRouterSolveModels = Array.from(
    new Set([preferredModel, ...OPENROUTER_SOLVE_MODELS].filter(Boolean) as string[])
  );

  // 1) OpenRouter models (qwen -> owl by default).
  if (openRouterKey && hasTimeBudget(deadlineAt, MIN_REMAINING_FOR_SOLVE_MS)) {
    for (const openRouterSolveModel of openRouterSolveModels) {
      aiLog("info", "OPENROUTER-SOLVE", "Trying model", { model: openRouterSolveModel });

      const openRouterMessages = [
        {
          role: "system",
          content: "Bạn là bộ giải câu hỏi trắc nghiệm. Chỉ trả về JSON hợp lệ theo schema index/correct_answer.",
        },
        { role: "user", content: solvePrompt },
      ];

      const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterKey}`,
        },
        body: JSON.stringify({
          model: openRouterSolveModel,
          temperature: 0,
          max_tokens: 800,
          reasoning: { enabled: true },
          messages: openRouterMessages,
        }),
      }, AI_TIMEOUT_MS);

      if (!res.ok) {
        const body = await res.text();
        openRouterFailure = Object.assign(new Error(`OpenRouter ${openRouterSolveModel} solve error: ${res.status}`), {
          status: res.status,
          details: body,
        }) as HttpError;
        aiLog("warn", "OPENROUTER-SOLVE", "Model failed", { model: openRouterSolveModel, status: res.status });
        continue;
      }

      const data = await res.json();
      const firstMessage = data?.choices?.[0]?.message;
      const raw = extractAssistantText(firstMessage?.content || "");
      const resolved = parseResolvedAnswers(raw, questions.length);
      if (resolved.some(Boolean)) {
        aiLog("info", "OPENROUTER-SOLVE", "Model succeeded", { model: openRouterSolveModel, pass: 1 });
        return applySolveResults(questions, resolved);
      }

      const reasoningDetails = firstMessage?.reasoning_details;
      if (reasoningDetails) {
        const continuationMessages = [
          ...openRouterMessages,
          {
            role: "assistant",
            content: firstMessage?.content || "",
            reasoning_details: reasoningDetails,
          },
          { role: "user", content: "Are you sure? Think carefully and return ONLY valid JSON." },
        ];

        const res2 = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouterKey}`,
          },
          body: JSON.stringify({
            model: openRouterSolveModel,
            temperature: 0,
            max_tokens: 800,
            messages: continuationMessages,
          }),
        }, AI_TIMEOUT_MS);

        if (res2.ok) {
          const data2 = await res2.json();
          const raw2 = extractAssistantText(data2?.choices?.[0]?.message?.content || "");
          const resolved2 = parseResolvedAnswers(raw2, questions.length);
          if (resolved2.some(Boolean)) {
            aiLog("info", "OPENROUTER-SOLVE", "Model succeeded", { model: openRouterSolveModel, pass: 2 });
            return applySolveResults(questions, resolved2);
          }
        } else {
          aiLog("warn", "OPENROUTER-SOLVE", "Continuation failed", { model: openRouterSolveModel, status: res2.status });
        }
      }
    }
  } else {
    aiLog("warn", "OPENROUTER-SOLVE", "Skip OpenRouter solve", {
      missingKey: !openRouterKey,
      remainingMs: remainingBudgetMs(deadlineAt),
    });
  }

  // 2) Groq fallback.
  if (!hasTimeBudget(deadlineAt, 6000)) {
    aiLog("warn", "GROQ-SOLVE", "Skip Groq solve due low remaining budget", {
      remainingMs: remainingBudgetMs(deadlineAt),
    });
    return markAllUnsolved(questions);
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    aiLog("warn", "GROQ-SOLVE", "GROQ_API_KEY missing, skip Groq solve");
    return markAllUnsolved(questions);
  }

  const groqModels = [GROQ_SOLVE_MODEL];
  for (const model of groqModels) {
    aiLog("info", "GROQ-SOLVE", "Trying Groq solve model", { model });
    const groqRes = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 700,
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
      aiLog("warn", "GROQ-SOLVE", "Groq model failed", { model, status: groqRes.status });
      openRouterFailure = Object.assign(new Error(`Groq ${model} solve error: ${groqRes.status}`), {
        status: groqRes.status,
        details: body,
      }) as HttpError;
      continue;
    }

    const groqData = await groqRes.json();
    const groqRaw = extractAssistantText(groqData.choices?.[0]?.message?.content || "");
    const groqResolved = parseResolvedAnswers(groqRaw, questions.length);
    if (groqResolved.some(Boolean)) {
      aiLog("info", "GROQ-SOLVE", "Groq solve succeeded", {
        model,
        solved: groqResolved.filter(Boolean).length,
      });
      return applySolveResults(questions, groqResolved);
    }
  }

  aiLog("warn", "SOLVE", "All solver providers returned no usable answer mapping; mark unresolved as A");
  return markAllUnsolved(questions);
}

async function generateQuestionsFromChunk(text: string, limit: number, deadlineAt?: number): Promise<ExtractedQuestion[]> {
  aiLog("info", "PIPELINE", "Chunk extraction started", {
    mode: "openrouter-only",
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
      const solved = await resolveAnswersWithAi(heuristic, text, undefined, deadlineAt);
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

  if (!hasTimeBudget(deadlineAt, MIN_REMAINING_FOR_EXTRACTION_MS)) {
    aiLog("warn", "PIPELINE", "Skip AI extraction due low remaining budget", {
      heuristicSeed: heuristic.length,
      remainingMs: remainingBudgetMs(deadlineAt),
    });
    return heuristic.slice(0, limit);
  }

  aiLog("info", "PIPELINE", "Start extraction for chunk", { chunkChars: text.length, limit });
  let picked: ExtractedQuestion[] = [];
  try {
    const extracted = await callQuestionExtractionModel(extractionPrompt);
    picked = extracted.slice(0, limit);
  } catch (error) {
    aiLog("warn", "PIPELINE", "AI extraction failed, continue with heuristic", {
      message: (error as Error).message,
    });
  }

  if (picked.length === 0 && heuristic.length === 0 && hasTimeBudget(deadlineAt, MIN_REMAINING_FOR_EXTRACTION_MS)) {
    const fallbackPrompt = `Bóc tách tối đa ${limit} câu trắc nghiệm từ văn bản bên dưới.
Nếu thiếu source_index thì bỏ qua source_index.
Luôn trả JSON mảng hợp lệ theo schema:
[
  {
    "question": "...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_answer": "A"
  }
]
Văn bản:
${extractionSource}`;

    try {
      aiLog("info", "PIPELINE", "Run fallback extraction prompt", { limit });
      const fallbackExtracted = await callQuestionExtractionModel(fallbackPrompt);
      picked = fallbackExtracted.slice(0, limit);
    } catch (error) {
      aiLog("warn", "PIPELINE", "Fallback extraction failed", {
        message: (error as Error).message,
      });
    }
  }

  aiLog("info", "PIPELINE", "AI extraction supplement result", {
    extractedByAi: picked.length,
    heuristicSeed: heuristic.length,
    limit,
  });

  let merged: ExtractedQuestion[] = [...heuristic];
  for (const q of picked) {
    if (q.source_index && merged.some((it) => it.source_index === q.source_index)) continue;
    const incomingFingerprint = questionFingerprint(q);
    if (merged.some((it) => questionFingerprint(it) === incomingFingerprint)) continue;
    merged.push(q);
    if (merged.length >= limit) break;
  }

  if (expected.length > 0) {
    const seen = new Set<number>();
    for (const q of merged) {
      if (q.source_index) seen.add(q.source_index);
    }

    const missing = expected.filter((idx) => !seen.has(idx));
    if (missing.length > 0 && hasTimeBudget(deadlineAt, MIN_REMAINING_FOR_RECOVERY_MS)) {
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

      let recovered: ExtractedQuestion[] = [];
      try {
        recovered = await callQuestionExtractionModel(recoveryPrompt);
      } catch (error) {
        aiLog("warn", "PIPELINE", "Recovery extraction failed, keep current merged set", {
          message: (error as Error).message,
        });
      }
      merged = [...merged, ...recovered].reduce<ExtractedQuestion[]>((acc, q) => {
        if (q.source_index && acc.some((it) => it.source_index === q.source_index)) return acc;
        const incomingFingerprint = questionFingerprint(q);
        if (acc.some((it) => questionFingerprint(it) === incomingFingerprint)) return acc;
        acc.push(q);
        return acc;
      }, []);
    } else if (missing.length > 0) {
      aiLog("warn", "PIPELINE", "Skip recovery due low remaining budget", {
        missing: missing.join(","),
        remainingMs: remainingBudgetMs(deadlineAt),
      });
    }
  }

  merged = await recheckQuestionsWithOwlAlpha(merged, text, deadlineAt);

  if (needsLatexRepair(merged) && hasTimeBudget(deadlineAt, MIN_REMAINING_FOR_RECOVERY_MS)) {
    aiLog("info", "PIPELINE", "Detected broken LaTeX, running repair");
    const repairPrompt = `Sửa lỗi LaTeX cho các câu hỏi sau và giữ nguyên nghĩa tiếng Việt. Không bỏ sót câu nào, không thêm câu mới.
Trả về JSON đúng schema cũ. Nếu có source_index thì giữ nguyên source_index.

JSON hiện tại:
${JSON.stringify(merged)}

Văn bản nguồn để đối chiếu:
${buildContextSnippet(text, RECOVERY_SOURCE_CONTEXT_MAX_CHARS)}`;

    let repaired: ExtractedQuestion[] = [];
    try {
      repaired = await callQuestionExtractionModel(repairPrompt);
    } catch (error) {
      aiLog("warn", "PIPELINE", "Latex repair failed, keep unrepaired set", {
        message: (error as Error).message,
      });
    }
    if (repaired.length > 0) {
      merged = repaired.reduce<ExtractedQuestion[]>((acc, q) => {
        if (q.source_index && acc.some((it) => it.source_index === q.source_index)) return acc;
        const incomingFingerprint = questionFingerprint(q);
        if (acc.some((it) => questionFingerprint(it) === incomingFingerprint)) return acc;
        acc.push(q);
        return acc;
      }, []);
    }
  } else if (needsLatexRepair(merged)) {
    aiLog("warn", "PIPELINE", "Skip LaTeX repair due low remaining budget", {
      remainingMs: remainingBudgetMs(deadlineAt),
    });
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
    const solved = await resolveAnswersWithAi(merged, text, undefined, deadlineAt);
    aiLog("info", "PIPELINE", "Chunk completed", { extracted: solved.length, solved: true });
    return solved.slice(0, limit);
  }

  aiLog("info", "PIPELINE", "Chunk completed", { extracted: merged.length, solved: false });
  return merged.slice(0, limit);
}

export async function buildQuestionsFromUploads(files: File[], manualText: string) {
  const deadlineAt = Date.now() + REQUEST_TIME_BUDGET_MS;
  aiLog("info", "PIPELINE", "Request budget initialized", {
    isVercel: IS_VERCEL_RUNTIME,
    budgetMs: REQUEST_TIME_BUDGET_MS,
  });

  const texts: string[] = [];
  const sources: Array<{ name: string; chars: number; kind: "image" | "pdf" | "text" }> = [];
  const ocrFailures: Array<{ file: string; reason: string }> = [];

  // Process multiple files in parallel để tăng tốc
  const ocrResults = await Promise.all(
    files.map(async (file) => {
      try {
        const { text, source } = await ocrFile(file);
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        return { text, source, kind: (isPdf ? "pdf" : "image") as "image" | "pdf" };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown OCR error";
        console.warn(`OCR failed for ${file.name}:`, error);
        return { text: "", source: file.name, kind: "image" as const, error: reason };
      }
    })
  );

  // Collect successful OCR results
  for (const result of ocrResults) {
    if (result?.error) {
      ocrFailures.push({ file: result.source, reason: result.error });
      continue;
    }

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
    const failureSummary = ocrFailures
      .slice(0, 3)
      .map((item) => `${item.file}: ${item.reason}`)
      .join(" | ");

    const err: HttpError = Object.assign(
      new Error("Không có nội dung để xử lý"),
      {
        details: failureSummary || "Không đọc được nội dung từ file tải lên.",
        status: 422,
      }
    );
    throw err;
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

    const questions = await generateQuestionsFromChunk(chunk, chunkLimit, deadlineAt);
    all.push(...questions);

    if (!hasTimeBudget(deadlineAt, MIN_REMAINING_FOR_EXTRACTION_MS)) {
      aiLog("warn", "PIPELINE", "Stop processing additional chunks due low remaining budget", {
        remainingMs: remainingBudgetMs(deadlineAt),
      });
      break;
    }
  }

  const unique = all.reduce<ExtractedQuestion[]>((acc, q) => {
    if (q.source_index && acc.find((ex) => ex.source_index === q.source_index)) return acc;
    const incomingFingerprint = questionFingerprint(q);
    if (acc.find((ex) => questionFingerprint(ex) === incomingFingerprint)) return acc;
    acc.push(q);
    return acc;
  }, []);

  const expectedIndices = detectQuestionIndices(cleanedText);
  if (expectedIndices.length > 0 && unique.length < expectedIndices.length) {
    const seen = new Set<number>(unique.map((q) => q.source_index).filter((v): v is number => Number.isFinite(v)));
    const missing = expectedIndices.filter((idx) => !seen.has(idx));

    if (missing.length > 0 && hasTimeBudget(deadlineAt, MIN_REMAINING_FOR_RECOVERY_MS)) {
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

      let recovered: ExtractedQuestion[] = [];
      try {
        recovered = await callQuestionExtractionModel(recoveryPrompt);
      } catch (error) {
        aiLog("warn", "PIPELINE", "Final recovery failed, return current unique set", {
          message: (error as Error).message,
        });
      }
      for (const q of recovered) {
        if (q.source_index && unique.some((it) => it.source_index === q.source_index)) continue;
        const incomingFingerprint = questionFingerprint(q);
        if (unique.some((it) => questionFingerprint(it) === incomingFingerprint)) continue;
        unique.push(q);
      }
    } else if (missing.length > 0) {
      aiLog("warn", "PIPELINE", "Skip final global recovery due low remaining budget", {
        missing: missing.join(","),
        remainingMs: remainingBudgetMs(deadlineAt),
      });
    }
  }

  if (unique.length === 0) {
    if (manualText.trim()) {
      aiLog("warn", "PIPELINE", "Using manual-text fallback question due empty extraction result");
      return {
        cleanedText,
        questions: [buildManualFallbackQuestion(manualText)],
        sources,
      };
    }
    throw new Error("AI did not return any questions");
  }

  const questions = unique.map(({ source_index: _sourceIndex, ...rest }) => ({
    ...rest,
    question: formatMathForRender(rest.question),
    options: {
      A: formatMathForRender(rest.options.A),
      B: formatMathForRender(rest.options.B),
      C: formatMathForRender(rest.options.C),
      D: formatMathForRender(rest.options.D),
    },
  }));

  return {
    cleanedText,
    questions,
    sources,
  };
}
