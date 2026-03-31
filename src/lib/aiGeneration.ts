import sharp from "sharp";

const PUTER_OPENAI_BASE_URL = "https://api.puter.com/puterai/openai/v1/chat/completions";
const NEMOTRON_VL_MODEL = "nvidia/nemotron-nano-12b-v2-vl";
const GEMINI_MODEL = "google/gemini-2.5-flash";
const QWEN_VL_MODEL = "qwen/qwen-vl-max";
const GPT4O_MINI_MODEL = "openai/gpt-4o-mini";
const GPT41_MINI_MODEL = "openai/gpt-4.1-mini";
const QWEN_FREE_MODEL = "qwen/qwen3-4b:free";
const QWEN36_PLUS_PREVIEW_FREE_MODEL = "qwen/qwen3.6-plus-preview:free";
const GEMMA_FREE_MODEL = "google/gemma-3n-e2b-it:free";
const LIQUID_THINKING_FREE_MODEL = "liquid/lfm-2.5-1.2b-thinking:free";
const ARCEE_FREE_MODEL = "arcee-ai/trinity-large-preview:free";
const O3_MINI_MODEL = "openai/o3-mini";
const DEEPSEEK_REASONER_MODEL = "deepseek/deepseek-reasoner";
const DEEPSEEK_R1_DISTILL_QWEN32_MODEL = "deepseek/deepseek-r1-distill-qwen-32b";
const QWQ32_MODEL = "qwen/qwq-32b";
const QWEN3_THINKING_30B_MODEL = "qwen/qwen3-30b-a3b-thinking-2507";
const O4_MINI_MODEL = "openai/o4-mini";
const MATH_SOLVER_MODEL = process.env.PUTER_SOLVER_MODEL || QWEN36_PLUS_PREVIEW_FREE_MODEL;
const PUTER_TIMEOUT_MS = Number(process.env.PUTER_TIMEOUT_MS || 25000);
const SOLVER_CONCURRENCY = Math.max(1, Number(process.env.PUTER_SOLVER_CONCURRENCY || 3));

function isAiDebugEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.PUTER_DEBUG === "1";
}

function logAi(stage: string, message: string, payload?: Record<string, unknown>) {
  if (!isAiDebugEnabled()) return;
  if (payload) {
    console.info(`[AI][${stage}] ${message}`, payload);
    return;
  }
  console.info(`[AI][${stage}] ${message}`);
}

function getModelList(envName: string, defaults: string[]) {
  const fromEnv = process.env[envName]?.split(",").map((x) => x.trim()).filter(Boolean);
  return (fromEnv && fromEnv.length > 0) ? fromEnv : defaults;
}

const OCR_FALLBACK_MODELS = getModelList("PUTER_OCR_MODELS", [
  GEMMA_FREE_MODEL,
]);

const STRUCTURE_FALLBACK_MODELS = getModelList("PUTER_STRUCTURE_MODELS", [
  QWEN_FREE_MODEL,
  GEMMA_FREE_MODEL,
  ARCEE_FREE_MODEL,
  LIQUID_THINKING_FREE_MODEL,
]);

const VALIDATION_FALLBACK_MODELS = getModelList("PUTER_VALIDATION_MODELS", [
  QWEN_FREE_MODEL,
  GEMMA_FREE_MODEL,
  ARCEE_FREE_MODEL,
  LIQUID_THINKING_FREE_MODEL,
]);

const MATH_SOLVER_FALLBACK_MODELS = getModelList("PUTER_SOLVER_MODELS", [
  MATH_SOLVER_MODEL,
  DEEPSEEK_REASONER_MODEL,
  DEEPSEEK_R1_DISTILL_QWEN32_MODEL,
  QWQ32_MODEL,
  QWEN3_THINKING_30B_MODEL,
  O3_MINI_MODEL,
  O4_MINI_MODEL,
  QWEN_FREE_MODEL,
  GEMMA_FREE_MODEL,
  ARCEE_FREE_MODEL,
  LIQUID_THINKING_FREE_MODEL,
]);

const MAX_TEXT_LENGTH = 12000;
const TEXT_CHUNK_SIZE = 5000;
const HARD_SAFETY_MAX_QUESTIONS = 300;
const QUESTIONS_PER_CHUNK = 80;

// OCR optimization settings
const MAX_IMAGE_WIDTH = 1600; // Giảm kích thước để tăng tốc OCR
const MAX_IMAGE_HEIGHT = 1600;
const JPEG_QUALITY = 85;

type HttpError = Error & { status?: number; details?: string };

export interface GeneratedQuestion {
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correct_answer: "A" | "B" | "C" | "D";
}

interface OcrResult {
  text: string;
  source: string;
  imageUrl?: string;
}

type VisionTextPart = { type: "text"; text: string };
type VisionImagePart = { type: "image_url"; image_url: { url: string } };
type OpenAiMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<VisionTextPart | VisionImagePart>;
};

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

function buildImageDataUrl(imageBuffer: Buffer) {
  return `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
}

async function callPuterChat(messages: OpenAiMessage[], model: string, maxTokens = 2200, temperature = 0.1) {
  const token = process.env.PUTER_AUTH_TOKEN;
  if (!token) {
    throw new Error("Thiếu PUTER_AUTH_TOKEN");
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUTER_TIMEOUT_MS);

  logAi("PUTER", "Request started", {
    model,
    maxTokens,
    temperature,
    timeoutMs: PUTER_TIMEOUT_MS,
  });

  let res: Response;
  try {
    res = await fetch(PUTER_OPENAI_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    const elapsedMs = Date.now() - startedAt;
    if (error instanceof Error && error.name === "AbortError") {
      const timeoutError: HttpError = Object.assign(
        new Error(`Puter timeout after ${PUTER_TIMEOUT_MS}ms for model ${model}`),
        { status: 408 }
      );
      logAi("PUTER", "Request timeout", { model, elapsedMs });
      throw timeoutError;
    }
    logAi("PUTER", "Request failed before response", {
      model,
      elapsedMs,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text();
    logAi("PUTER", "Request failed", {
      model,
      status: res.status,
      elapsedMs: Date.now() - startedAt,
    });
    const message = res.status === 401
      ? "Puter 401 (PUTER_AUTH_TOKEN không hợp lệ hoặc chưa nạp)"
      : res.status === 402
        ? "Puter 402 (hết credit hoặc model chưa được cấp quyền)"
        : `Puter chat error: ${res.status}`;
    const error: HttpError = Object.assign(new Error(message), { details: body, status: res.status });
    throw error;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) throw new Error(`Puter empty content from model ${model}`);
    logAi("PUTER", "Request success", {
      model,
      elapsedMs: Date.now() - startedAt,
      contentLength: trimmed.length,
    });
    return trimmed;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part: { text?: string }) => part?.text || "")
      .join("\n")
      .trim();
    if (!text) throw new Error(`Puter empty array content from model ${model}`);
    logAi("PUTER", "Request success (array content)", {
      model,
      elapsedMs: Date.now() - startedAt,
      contentLength: text.length,
    });
    return text;
  }

  throw new Error("Puter không trả về nội dung hợp lệ");
}

async function callWithModelFallback(
  messages: OpenAiMessage[],
  models: string[],
  maxTokens: number,
  temperature: number
) {
  let lastError: unknown = null;
  const attempts: string[] = [];
  const startedAt = Date.now();

  logAi("FALLBACK", "Start model fallback", {
    modelCount: models.length,
    maxTokens,
    temperature,
  });

  for (const model of models) {
    const modelStartedAt = Date.now();
    try {
      const content = await callPuterChat(messages, model, maxTokens, temperature);
      logAi("FALLBACK", "Model selected", {
        model,
        tryMs: Date.now() - modelStartedAt,
        totalMs: Date.now() - startedAt,
      });
      return { content, model };
    } catch (error) {
      lastError = error;
      const httpError = error as HttpError;
      attempts.push(`${model}:${httpError?.status || "ERR"}`);
      logAi("FALLBACK", "Model failed", {
        model,
        status: httpError?.status || "ERR",
        tryMs: Date.now() - modelStartedAt,
      });
    }
  }

  logAi("FALLBACK", "All models failed", {
    attempts,
    totalMs: Date.now() - startedAt,
  });

  if ((lastError as HttpError)?.status === 402) {
    throw new Error(`Puter 402: Các model đang hết credit/chưa được cấp quyền (${attempts.join(", ")})`);
  }

  throw lastError instanceof Error ? lastError : new Error("All fallback models failed");
}

function extractFirstJsonArray(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }
  return raw;
}

async function extractPdfText(file: File) {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdfParse(buffer);
  return (result?.text as string | undefined)?.trim() || "";
}

async function ocrFile(file: File): Promise<OcrResult> {
  const isDev = process.env.NODE_ENV !== "production";
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    const text = await extractPdfText(file);
    return { text, source: file.name };
  }

  // OCR thô bằng model vision (Nemotron) theo pipeline Puter
  const optimizedBuffer = await optimizeImage(file);
  const imageUrl = buildImageDataUrl(optimizedBuffer);

  const ocrAttempt = await callWithModelFallback(
    [
      {
        role: "system",
        content: "Bạn là OCR engine cho đề thi. Chỉ chép lại nội dung nhìn thấy từ ảnh. Giữ nguyên ký hiệu toán học, không tự giải, không thêm diễn giải.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Trích xuất toàn bộ chữ trong ảnh, ưu tiên đúng ký hiệu toán học." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    OCR_FALLBACK_MODELS,
    2400,
    0
  );

  if (isDev) {
    console.info("[AI OCR] Model", { model: ocrAttempt.model });
  }

  return { text: ocrAttempt.content, source: file.name, imageUrl };
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

function estimateQuestionCountFromText(text: string) {
  const byCau = text.match(/(?:^|\n)\s*Câu\s*\d+[\.:\)\-\s]*/gim)?.length || 0;
  const byNumbering = text.match(/(?:^|\n)\s*\d+[\.)]\s+/gm)?.length || 0;
  return Math.max(byCau, byNumbering);
}

function extractHeuristicQuestions(rawText: string, limit: number): GeneratedQuestion[] {
  const text = rawText.replace(/\r/g, "").trim();
  if (!text) return [];

  // Split by common Vietnamese question markers: "Câu 1", "1.", "1)"
  const chunks = text
    .split(/\n(?=(?:Câu\s*\d+|\d+[\.)]))/i)
    .map((x) => x.trim())
    .filter(Boolean);

  const results: GeneratedQuestion[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((x) => x.trim()).filter(Boolean);
    if (lines.length < 3) continue;

    const optionMap: Partial<Record<"A" | "B" | "C" | "D", string>> = {};
    const questionLines: string[] = [];

    for (const line of lines) {
      const optionMatch = line.match(/^([ABCD])[\.)\:\-\s]+(.+)$/i);
      if (optionMatch) {
        const key = optionMatch[1].toUpperCase() as "A" | "B" | "C" | "D";
        optionMap[key] = optionMatch[2].trim();
      } else {
        questionLines.push(line);
      }
    }

    if (!optionMap.A || !optionMap.B || !optionMap.C || !optionMap.D) continue;

    const question = questionLines
      .join(" ")
      .replace(/^Câu\s*\d+[\.:\)\-\s]*/i, "")
      .replace(/^\d+[\.)\-\s]*/, "")
      .trim();

    if (!question) continue;

    results.push({
      question,
      options: {
        A: optionMap.A,
        B: optionMap.B,
        C: optionMap.C,
        D: optionMap.D,
      },
      correct_answer: "A",
    });

    if (results.length >= limit) break;
  }

  return results;
}

function normalizeQuestionKey(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u00A0]/g, " ")
    .trim();
}

function mergeQuestionsPreferExisting(base: GeneratedQuestion[], supplement: GeneratedQuestion[]) {
  const seen = new Set(base.map((q) => normalizeQuestionKey(q.question)));
  const merged = [...base];

  for (const q of supplement) {
    const key = normalizeQuestionKey(q.question);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(q);
  }

  return merged;
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

type SolvedAnswerPayload = {
  index?: unknown;
  question_index?: unknown;
  correct_answer?: unknown;
  answer?: unknown;
  option?: unknown;
};

function normalizeOptionLetter(value: unknown): "A" | "B" | "C" | "D" | null {
  const text = String(value || "").trim();
  if (!text) return null;

  const upper = text.toUpperCase();
  if (/^[ABCD]$/.test(upper)) return upper as "A" | "B" | "C" | "D";

  const jsonField = upper.match(/"(?:CORRECT_ANSWER|ANSWER|OPTION)"\s*:\s*"([ABCD])"/);
  if (jsonField?.[1]) return jsonField[1] as "A" | "B" | "C" | "D";

  const labeled = upper.match(/(?:DAP\s*AN|\u0110AP\s*AN|CHON|CH\u1eccN|ANSWER|CORRECT_ANSWER)\s*[:\-]?\s*([ABCD])\b/);
  if (labeled?.[1]) return labeled[1] as "A" | "B" | "C" | "D";

  const trailingLetter = upper.match(/\b([ABCD])\b\s*$/);
  if (trailingLetter?.[1]) return trailingLetter[1] as "A" | "B" | "C" | "D";

  return null;
}

function uniqueAnswerCount(questions: GeneratedQuestion[]) {
  return new Set(questions.map((q) => q.correct_answer)).size;
}

function stripSolvedFields(questions: GeneratedQuestion[]) {
  return questions.map((q, index) => ({
    index,
    question: q.question,
    options: q.options,
  }));
}

function applySolvedAnswers(
  questions: GeneratedQuestion[],
  solvedRaw: unknown
): GeneratedQuestion[] {
  if (!Array.isArray(solvedRaw)) return questions;

  const answerByIndex = new Map<number, "A" | "B" | "C" | "D">();
  let hasZeroBasedIndex = false;
  const oneBasedBuffer: Array<{ idx: number; ans: "A" | "B" | "C" | "D" }> = [];

  for (const item of solvedRaw) {
    const row = item as SolvedAnswerPayload;
    const idxRaw = row.index ?? row.question_index;
    const idx = Number(idxRaw);
    const ans = normalizeOptionLetter(row.correct_answer ?? row.answer ?? row.option);
    if (!Number.isFinite(idx)) continue;
    if (!ans) continue;

    if (idx === 0) {
      hasZeroBasedIndex = true;
      answerByIndex.set(0, ans);
      continue;
    }

    if (idx > 0) {
      oneBasedBuffer.push({ idx, ans });
    }
  }

  if (hasZeroBasedIndex) {
    for (const row of oneBasedBuffer) {
      answerByIndex.set(row.idx, row.ans);
    }
  } else {
    for (const row of oneBasedBuffer) {
      const zeroBased = row.idx - 1;
      if (zeroBased >= 0) answerByIndex.set(zeroBased, row.ans);
    }
  }

  return questions.map((q, idx) => ({
    ...q,
    correct_answer: answerByIndex.get(idx) || q.correct_answer,
  }));
}

async function solveOneQuestion(
  question: GeneratedQuestion,
  _inputText: string,
  _imageUrl: string | null
): Promise<"A" | "B" | "C" | "D" | null> {
  const isDev = isAiDebugEnabled();
  const questionForSolve = {
    question: question.question,
    options: question.options,
  };

  const userParts: Array<VisionTextPart | VisionImagePart> = [
    {
      type: "text",
      text: `Giải câu hỏi trắc nghiệm sau và chỉ trả về một ký tự duy nhất: A hoặc B hoặc C hoặc D.\n\nCâu hỏi JSON:\n${JSON.stringify(questionForSolve)}\n\nKhông thêm bất kỳ ký tự nào khác ngoài A/B/C/D.`,
    },
  ];

  try {
    const messages: OpenAiMessage[] = [
      {
        role: "system",
        content: "Bạn là chuyên gia giải toán trắc nghiệm. Chỉ trả về 1 ký tự A/B/C/D.",
      },
      { role: "user", content: userParts },
    ];

    const firstAttempt = await callWithModelFallback(
      messages,
      MATH_SOLVER_FALLBACK_MODELS,
      200,
      0
    );

    if (isDev) {
      console.info("[AI Solver] Single question model", {
        model: firstAttempt.model,
      });
    }

    const firstPass = normalizeOptionLetter(firstAttempt.content);
    if (firstPass) return firstPass;
    if (isDev) {
      console.info("[AI Solver] Single question first pass ambiguous", {
        preview: firstAttempt.content.slice(0, 120),
      });
    }

    const retryAttempt = await callWithModelFallback(
      [
        {
          role: "system",
          content: "Trả về đúng 1 ký tự duy nhất trong tập A,B,C,D. Không giải thích.",
        },
        {
          role: "user",
          content: `Chỉ trả về đúng 1 ký tự A/B/C/D cho câu hỏi này:\n${JSON.stringify(questionForSolve)}`,
        },
      ],
      MATH_SOLVER_FALLBACK_MODELS,
      40,
      0
    );

    if (isDev) {
      console.info("[AI Solver] Single question retry model", {
        model: retryAttempt.model,
      });
    }

    const retryParsed = normalizeOptionLetter(retryAttempt.content);
    if (isDev && !retryParsed) {
      console.info("[AI Solver] Single question retry failed", {
        preview: retryAttempt.content.slice(0, 120),
      });
    }
    return retryParsed;
  } catch {
    return null;
  }
}

async function applyDoubleCheckAnswers(
  questions: GeneratedQuestion[]
): Promise<GeneratedQuestion[]> {
  if (questions.length < 3) return questions;

  logAi("SOLVER", "Double-check answers started", {
    questionCount: questions.length,
    concurrency: SOLVER_CONCURRENCY,
  });

  const checked = [...questions];
  await runWithConcurrency(checked.length, SOLVER_CONCURRENCY, async (i) => {
    const ans = await solveOneQuestion(checked[i], "", null);
    if (ans) checked[i].correct_answer = ans;
  });

  logAi("SOLVER", "Double-check answers finished", {
    questionCount: checked.length,
  });

  return checked;
}

async function runWithConcurrency(
  total: number,
  concurrency: number,
  worker: (index: number) => Promise<void>
) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= total) break;
      await worker(current);
    }
  });

  await Promise.all(workers);
}

async function runMathSolving(
  questions: GeneratedQuestion[],
  _inputText: string,
  _imageUrl: string | null
): Promise<GeneratedQuestion[]> {
  if (questions.length === 0) return questions;
  const isDev = isAiDebugEnabled();
  const solvingStartedAt = Date.now();
  logAi("SOLVER", "Batch solving started", {
    questionCount: questions.length,
    concurrency: SOLVER_CONCURRENCY,
  });
  const solvePayload = stripSolvedFields(questions);

  const userParts: Array<VisionTextPart | VisionImagePart> = [
    {
      type: "text",
      text: `Hãy GIẢI từng câu trắc nghiệm và chọn đáp án đúng duy nhất (A/B/C/D).\n\nDanh sách câu hỏi JSON (không chứa đáp án):\n${JSON.stringify(solvePayload)}\n\nTrả về JSON mảng có đúng số phần tử tương ứng:\n[{"index":0,"correct_answer":"A"}]\n\nQuy tắc:\n- index là vị trí phần tử trong mảng câu hỏi (bắt đầu từ 0).\n- correct_answer chỉ nhận A/B/C/D.\n- Chỉ trả về JSON, không thêm giải thích hay markdown.`,
    },
  ];

  try {
    const batchAttempt = await callWithModelFallback(
      [
        {
          role: "system",
          content:
            "Bạn là chuyên gia giải toán trắc nghiệm. Nhiệm vụ là tính toán và chọn đáp án đúng. Không phỏng đoán khi thiếu dữ kiện.",
        },
        { role: "user", content: userParts },
      ],
      MATH_SOLVER_FALLBACK_MODELS,
      1000,
      0
    );

    if (isDev) {
      console.info("[AI Solver] Batch solve model", {
        model: batchAttempt.model,
      });
    }

    const solvedParsed = JSON.parse(extractFirstJsonArray(batchAttempt.content));
    const solvedBatch = applySolvedAnswers(questions, solvedParsed);

    const changedCount = solvedBatch.reduce((acc, q, idx) => {
      return acc + (q.correct_answer !== questions[idx]?.correct_answer ? 1 : 0);
    }, 0);

    const suspiciousBatch =
      changedCount === 0 ||
      (questions.length >= 3 && uniqueAnswerCount(solvedBatch) === 1);

    if (isDev) {
      console.info("[AI Solver] Batch solve summary", {
        questionCount: questions.length,
        changedCount,
        uniqueAnswers: uniqueAnswerCount(solvedBatch),
        suspiciousBatch,
      });
    }

    if (!suspiciousBatch) return solvedBatch;

    const fallbackSolved = [...solvedBatch];
    await runWithConcurrency(fallbackSolved.length, SOLVER_CONCURRENCY, async (i) => {
      const answer = await solveOneQuestion(fallbackSolved[i], "", null);
      if (answer) fallbackSolved[i].correct_answer = answer;
    });

    if (fallbackSolved.length >= 3 && uniqueAnswerCount(fallbackSolved) === 1) {
      const doubleChecked = await applyDoubleCheckAnswers(fallbackSolved);
      if (uniqueAnswerCount(doubleChecked) > 1) {
        logAi("SOLVER", "Batch solving finished with double-check", {
          questionCount: doubleChecked.length,
          elapsedMs: Date.now() - solvingStartedAt,
        });
        return doubleChecked;
      }
    }

    logAi("SOLVER", "Batch solving finished with per-question fallback", {
      questionCount: fallbackSolved.length,
      elapsedMs: Date.now() - solvingStartedAt,
    });

    return fallbackSolved;
  } catch {
    if (isDev) {
      console.info("[AI Solver] Batch solve failed, switching to per-question fallback");
    }
    const fallbackSolved = [...questions];
    await runWithConcurrency(fallbackSolved.length, SOLVER_CONCURRENCY, async (i) => {
      const answer = await solveOneQuestion(fallbackSolved[i], "", null);
      if (answer) fallbackSolved[i].correct_answer = answer;
    });

    if (fallbackSolved.length >= 3 && uniqueAnswerCount(fallbackSolved) === 1) {
      const doubleChecked = await applyDoubleCheckAnswers(fallbackSolved);
      if (uniqueAnswerCount(doubleChecked) > 1) {
        logAi("SOLVER", "Batch solving recovered after error", {
          questionCount: doubleChecked.length,
          elapsedMs: Date.now() - solvingStartedAt,
        });
        return doubleChecked;
      }
    }

    logAi("SOLVER", "Batch solving finished after error fallback", {
      questionCount: fallbackSolved.length,
      elapsedMs: Date.now() - solvingStartedAt,
    });

    return fallbackSolved;
  }
}

async function runGeminiStructuring(inputText: string, imageUrl: string | null, expectedCountHint: number | null) {
  const isDev = process.env.NODE_ENV !== "production";
  const expectedLine = expectedCountHint && expectedCountHint > 0
    ? `\n- Nguồn có đánh số khoảng ${expectedCountHint} câu, hãy trả đủ số câu đọc được (không được cắt thiếu).`
    : "";
  const userParts: Array<VisionTextPart | VisionImagePart> = [
    {
      type: "text",
      text: `Nguồn dữ liệu OCR/latex:\n${inputText}\n\nHãy TRÍCH XUẤT ĐẦY ĐỦ toàn bộ câu hỏi trắc nghiệm A/B/C/D có trong nguồn này, không được bỏ sót câu nào.${expectedLine}\nYêu cầu bắt buộc:\n- Nếu nguồn đã chứa câu hỏi dạng LaTeX, giữ nguyên công thức và cấu trúc toán học, không diễn giải lại thành văn xuôi.\n- Giữ nguyên ký hiệu toán học, chuẩn hoá về LaTeX khi có biểu thức.\n- Với phân số, ưu tiên dạng \\frac{tu}{mau}, không dùng kiểu a/b nếu đó là phân số toán học.\n- Không tự thêm dữ kiện không có trong ảnh/text.\n- Nếu ký hiệu mờ thì bỏ qua câu đó.\n- Chỉ trả về JSON mảng theo schema: [{"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct_answer":"A"}]`,
    },
  ];

  if (imageUrl) {
    userParts.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const structureAttempt = await callWithModelFallback(
    [
      {
        role: "system",
        content: "Bạn là hệ thống trích xuất câu hỏi từ đề thi. Chỉ trả về JSON hợp lệ, không có chữ thừa.",
      },
      { role: "user", content: userParts },
    ],
    STRUCTURE_FALLBACK_MODELS,
    1800,
    0.1
  );

  if (isDev) {
    console.info("[AI Generate] Structuring model", { model: structureAttempt.model });
  }

  return structureAttempt.content;
}

async function runQwenValidation(
  geminiJsonRaw: string,
  inputText: string,
  imageUrl: string | null,
  expectedCountHint: number | null
) {
  const isDev = process.env.NODE_ENV !== "production";
  const expectedLine = expectedCountHint && expectedCountHint > 0
    ? `\nNguồn đang có khoảng ${expectedCountHint} câu đánh số, tuyệt đối không làm thiếu câu khi hậu kiểm.`
    : "";
  const userParts: Array<VisionTextPart | VisionImagePart> = [
    {
      type: "text",
      text: `Hãy kiểm tra và sửa JSON câu hỏi sau để khớp nguồn dữ liệu, nhất là ký hiệu toán. Giữ đủ toàn bộ câu trắc nghiệm có trong nguồn, không cắt giảm số câu.\n\nJSON ứng viên:\n${geminiJsonRaw}\n\nNguồn OCR:\n${inputText}${expectedLine}\n\nBắt buộc chuẩn hoá biểu thức theo LaTeX; với phân số phải dùng \\frac{...}{...} khi phù hợp, tránh để dạng a/b.\n\nTrả về JSON mảng hợp lệ duy nhất theo schema chuẩn, không thêm giải thích.`,
    },
  ];

  if (imageUrl) {
    userParts.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const validationAttempt = await callWithModelFallback(
    [
      {
        role: "system",
        content: "Bạn là bộ hậu kiểm OCR Toán. Chỉ trả về JSON mảng hợp lệ theo schema câu hỏi trắc nghiệm.",
      },
      { role: "user", content: userParts },
    ],
    VALIDATION_FALLBACK_MODELS,
    1800,
    0
  );

  if (isDev) {
    console.info("[AI Generate] Validation model", { model: validationAttempt.model });
  }

  return validationAttempt.content;
}

async function generateQuestionsFromChunk(text: string, imageUrl: string | null = null): Promise<GeneratedQuestion[]> {
  const chunkStartedAt = Date.now();
  logAi("PIPELINE", "Generate chunk started", {
    textLength: text.length,
    hasImage: Boolean(imageUrl),
  });

  let geminiRaw = "";
  const expectedCountHint = estimateQuestionCountFromText(text);

  try {
    geminiRaw = await runGeminiStructuring(text, imageUrl, expectedCountHint || null);
  } catch {
    // Không fail ngay; thử nhánh hậu kiểm/generate khác bên dưới
  }

  if (geminiRaw) {
    try {
      const parsed = normalizeQuestions(JSON.parse(extractFirstJsonArray(geminiRaw)));
      if (parsed.length > 0) {
        logAi("PIPELINE", "Structuring parsed questions", {
          count: parsed.length,
          elapsedMs: Date.now() - chunkStartedAt,
        });
        return runMathSolving(parsed, text, imageUrl);
      }
    } catch {
      // Fallback qua bước hậu kiểm nếu parse lỗi
    }
  }

  try {
    const qwenRaw = await runQwenValidation(geminiRaw || text, text, imageUrl, expectedCountHint || null);
    const parsed = normalizeQuestions(JSON.parse(extractFirstJsonArray(qwenRaw)));
    logAi("PIPELINE", "Validation parsed questions", {
      count: parsed.length,
      elapsedMs: Date.now() - chunkStartedAt,
    });
    return runMathSolving(parsed, text, imageUrl);
  } catch {
    logAi("PIPELINE", "Generate chunk failed", {
      elapsedMs: Date.now() - chunkStartedAt,
    });
    return [];
  }
}

export async function buildQuestionsFromUploads(files: File[], manualText: string) {
  const startedAt = Date.now();
  const hardLimit = HARD_SAFETY_MAX_QUESTIONS;
  const texts: string[] = [];
  const sources: Array<{ name: string; chars: number; kind: "image" | "pdf" | "text" }> = [];
  const all: GeneratedQuestion[] = [];

  for (const file of files) {
    const fileStartedAt = Date.now();
    logAi("PIPELINE", "File processing started", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const kind = (isPdf ? "pdf" : "image") as "image" | "pdf";
      const { text, source, imageUrl } = await ocrFile(file);

      if (!text.trim()) continue;

      texts.push(text);
      sources.push({ name: source, chars: text.length, kind });

      if (kind === "image") {
        const fromImage = await generateQuestionsFromChunk(text.slice(0, MAX_TEXT_LENGTH), imageUrl || null);
        all.push(...fromImage);
      } else {
        const chunks = chunkText(text.slice(0, MAX_TEXT_LENGTH));
        for (const chunk of chunks) {
          const fromPdf = await generateQuestionsFromChunk(chunk);
          all.push(...fromPdf);
          if (all.length >= hardLimit) break;
        }
      }
    } catch (error) {
      console.warn(`AI import failed for ${file.name}:`, error);
      logAi("PIPELINE", "File processing failed", {
        fileName: file.name,
        elapsedMs: Date.now() - fileStartedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logAi("PIPELINE", "File processing finished", {
      fileName: file.name,
      elapsedMs: Date.now() - fileStartedAt,
      accumulatedQuestions: all.length,
    });

    if (all.length >= hardLimit) break;
  }

  if (manualText.trim()) {
    const trimmed = manualText.trim();
    const manualStartedAt = Date.now();
    texts.push(trimmed);
    sources.push({ name: "text-input", chars: trimmed.length, kind: "text" as const });

    // Fast path: try heuristic parsing first for clean pasted text (e.g. Câu 1, Câu 2...)
    const heuristicFromText = extractHeuristicQuestions(trimmed, hardLimit);
    const estimatedFromText = estimateQuestionCountFromText(trimmed);
    const isDev = process.env.NODE_ENV !== "production";

    if (heuristicFromText.length > 0 && heuristicFromText.length >= Math.max(estimatedFromText * 0.7, 1)) {
      // Good heuristic parse → just solve answers with AI, skip structuring step
      if (isDev) console.info("[AI Generate] Fast heuristic path for text input", { count: heuristicFromText.length });
      const solved = await runMathSolving(heuristicFromText, trimmed, null);
      all.push(...solved);
    } else {
      // Fallback: go through full AI structuring pipeline
      const chunks = chunkText(trimmed.slice(0, MAX_TEXT_LENGTH));
      for (const chunk of chunks) {
        const fromText = await generateQuestionsFromChunk(chunk);
        all.push(...fromText);
        if (all.length >= hardLimit) break;
      }
    }

    logAi("PIPELINE", "Manual text processing finished", {
      elapsedMs: Date.now() - manualStartedAt,
      accumulatedQuestions: all.length,
    });
  }

  if (texts.length === 0) {
    throw new Error("Không có nội dung để xử lý");
  }

  const cleanedText = cleanOcrText(texts);

  // Fallback từ text gộp nếu trước đó chưa sinh được câu nào
  if (all.length === 0) {
    const chunks = chunkText(cleanedText);
    for (const chunk of chunks) {
      const questions = await generateQuestionsFromChunk(chunk);
      all.push(...questions);
      if (all.length >= hardLimit) break;
    }
  }

  const unique = all.reduce<GeneratedQuestion[]>((acc, q) => {
    if (acc.find((ex) => ex.question === q.question)) return acc;
    acc.push(q);
    return acc;
  }, []);

  const heuristicFromCleaned = extractHeuristicQuestions(cleanedText, hardLimit);
  const estimatedCount = estimateQuestionCountFromText(cleanedText);

  let finalQuestions = unique;

  // Nếu AI trả thiếu rõ rệt thì ưu tiên parser cứng từ văn bản để giữ đủ câu.
  if (heuristicFromCleaned.length > finalQuestions.length) {
    const aiLooksIncomplete = finalQuestions.length === 0 || finalQuestions.length < Math.max(estimatedCount * 0.7, 8);
    finalQuestions = aiLooksIncomplete
      ? heuristicFromCleaned
      : mergeQuestionsPreferExisting(finalQuestions, heuristicFromCleaned);
  }

  if (finalQuestions.length === 0) {
    if (heuristicFromCleaned.length > 0) {
      const solvedHeuristic = await runMathSolving(heuristicFromCleaned, cleanedText, null);
      if (process.env.NODE_ENV !== "production") {
        console.info("[AI Generate] Heuristic fallback used", {
          count: solvedHeuristic.length,
        });
      }

      return {
        cleanedText,
        questions: solvedHeuristic.slice(0, hardLimit),
        sources,
      };
    }

    throw new Error("AI did not return any questions");
  }

  const needResovleAnswers = finalQuestions.length <= 80 && uniqueAnswerCount(finalQuestions) <= 1;
  if (needResovleAnswers) {
    finalQuestions = await runMathSolving(finalQuestions, cleanedText, null);
    if (finalQuestions.length >= 3 && uniqueAnswerCount(finalQuestions) === 1) {
      finalQuestions = await applyDoubleCheckAnswers(finalQuestions);
    }
  }

  logAi("PIPELINE", "Build questions completed", {
    totalQuestions: finalQuestions.length,
    sourceCount: sources.length,
    elapsedMs: Date.now() - startedAt,
  });

  return {
    cleanedText,
    questions: finalQuestions.slice(0, hardLimit),
    sources,
  };
}
