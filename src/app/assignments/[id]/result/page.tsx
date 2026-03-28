import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ResultQuestionsAccordion } from "@/features/assignments/components/ResultQuestionsAccordion";

// Disable caching để luôn hiển thị dữ liệu mới nhất
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SubmissionSummary = {
  id: string;
  score: number | null;
  submitted_at: string;
  status: string;
  duration_seconds: number | null;
};

export default async function ResultPage({ 
  params: _params,
  searchParams 
}: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sid?: string }>;
}) {
  const formatPoints = (value: number | null | undefined) => Number(value ?? 0).toFixed(3);
  await _params;
  const { sid } = await searchParams;

  if (!sid) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-[#0B1120] transition-colors duration-500">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-center text-slate-600 dark:text-slate-400">Không tìm thấy kết quả bài làm.</p>
          <Link href="/" className="block text-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 mt-4">
            ← Quay lại trang chủ
          </Link>
        </div>
      </main>
    );
  }

  const supabase = createSupabaseAdmin();

  const { data: submission } = await supabase
    .from("submissions")
    .select("*, assignments(*)")
    .eq("id", sid)
    .single();

  if (!submission) return notFound();

  // Lấy câu hỏi và câu trả lời
  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("assignment_id", submission.assignment_id)
    .order("order");

  const { data: answers } = await supabase
    .from("answers")
    .select("*")
    .eq("submission_id", sid);

  const answerMap = new Map(answers?.map((a) => [a.question_id, a]) || []);

  const assignment = submission.assignments;
  const score = submission.score ?? 0;
  const totalPoints = assignment?.total_score ?? questions?.reduce((sum, q) => sum + Number(q.points || 0), 0) ?? 0;
  const submittedAt = new Date(submission.submitted_at).toLocaleString("vi-VN");
  const isScoreHidden = Boolean(assignment?.hide_score);

  // Tính toán thống kê
  const mcqQuestions = questions?.filter(q => q.type === 'mcq') || [];
  const correctCount = mcqQuestions.filter(q => answerMap.get(q.id)?.is_correct).length;
  const incorrectCount = mcqQuestions.filter(q => answerMap.get(q.id)?.is_correct === false).length;
  const unansweredCount = mcqQuestions.filter(q => !answerMap.has(q.id)).length;
  const percentage = totalPoints > 0 ? ((score / totalPoints) * 100).toFixed(1) : '0.0';

  const { data: history } = await supabase
    .from("submissions")
    .select("id, score, submitted_at, status, duration_seconds")
    .eq("assignment_id", submission.assignment_id)
    .order("submitted_at", { ascending: false })
    .limit(10)
    .returns<SubmissionSummary[]>();

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-[#0B1120] transition-colors duration-500" suppressHydrationWarning>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0B1120]/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg brand-gradient shadow-sm">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Kết quả bài làm</h1>
          </div>
          <Link href="/" className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 transition hover:text-indigo-600 dark:hover:text-indigo-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Về trang chủ
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5" suppressHydrationWarning>
        {/* Score card */}
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" suppressHydrationWarning>
          <div className="brand-gradient p-6 text-center text-white">
            <p className="text-sm font-semibold text-indigo-200 mb-2">Kết quả</p>
            {isScoreHidden ? (
              <div className="flex flex-col items-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
                  <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-xl font-bold">Điểm chưa được công bố</p>
                <p className="text-sm text-indigo-200 mt-1">Giáo viên sẽ thông báo sau khi hoàn tất chấm bài.</p>
              </div>
            ) : (
              <div>
                <div className="text-7xl font-black tabular-nums">
                  {score}<span className="text-3xl font-bold text-indigo-300">/{totalPoints}</span>
                </div>
                <div className="mt-2 text-2xl font-bold text-indigo-200">{percentage}%</div>
              </div>
            )}
          </div>

          {!isScoreHidden && (
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700">
              {[
                { value: correctCount, label: "Đúng", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
                { value: incorrectCount, label: "Sai", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10" },
                { value: unansweredCount, label: "Bỏ qua", color: "text-slate-400 dark:text-slate-500", bg: "" },
              ].map(s => (
                <div key={s.label} className={`flex flex-col items-center py-4 ${s.bg}`}>
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meta info */}
        <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" suppressHydrationWarning>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: "Bài tập", value: assignment.title },
              { label: "Môn học", value: assignment.subject },
              { label: "Nộp lúc", value: submittedAt },
              { label: "Trạng thái", value: submission.status === "scored" ? "Đã chấm" : "Đang chấm", badge: true, color: submission.status === "scored" ? "emerald" : "amber" },
            ].map(item => (
              <div key={item.label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{item.label}</p>
                {item.badge ? (
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    item.color === "emerald" 
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20" 
                      : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/20"
                  }`}>{item.value}</span>
                ) : (
                  <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">{item.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Question detail */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Chi tiết từng câu</h2>
          {isScoreHidden && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-6 text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
                  <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="font-bold text-amber-900 dark:text-amber-200">Bài đã nộp thành công!</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">Giáo viên sẽ chấm bài và công bố điểm sau.</p>
            </div>
          )}

          {!isScoreHidden && (
             <ResultQuestionsAccordion 
               questions={questions || []}
               answers={answers || []}
               isScoreHidden={isScoreHidden}
             />
          )}
        </div>

        {/* History */}
        {history && history.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Lịch sử làm bài</h2>
            </div>
            {history.length > 1 && history[0].score !== null && history[1].score !== null && (
              <div className={clsx(
                "mb-4 rounded-xl px-4 py-3 text-sm font-semibold",
                history[0].score > history[1].score ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400" :
                history[0].score < history[1].score ? "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400" :
                "bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
              )}>
                {history[0].score > history[1].score
                  ? `🎉 Cải thiện +${(history[0].score - history[1].score).toFixed(3)} so với lần trước!`
                  : history[0].score < history[1].score
                  ? `Giảm ${(history[1].score - history[0].score).toFixed(3)} điểm. Cố gắng hơn nhé!`
                  : "Điểm không đổi so với lần trước."}
              </div>
            )}
            <div className="space-y-2">
              {history.map((h, idx) => (
                <Link
                  key={h.id}
                  href={`/assignments/${assignment.id}/result?sid=${h.id}`}
                  className={clsx(
                    "flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition",
                    h.id === sid 
                      ? "border-indigo-300 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-500/10" 
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">#{history.length - idx}</span>
                    <div>
                      <p className={clsx("font-bold", h.id === sid ? "text-indigo-900 dark:text-indigo-300" : "text-slate-900 dark:text-slate-200")}>{h.score ?? 0}/{totalPoints} điểm</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(h.submitted_at).toLocaleString("vi-VN")}</p>
                    </div>
                  </div>
                  {h.id === sid && (
                    <span className="rounded-full bg-indigo-600 dark:bg-indigo-500 px-2.5 py-0.5 text-xs font-bold text-white">Đang xem</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Retry button */}
        <Link
          href={`/assignments/${assignment.id}/start`}
          className="flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-sm transition-all brand-gradient hover:opacity-90 hover:shadow-md"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Làm lại bài tập
        </Link>
      </div>
    </main>
  );
}
