import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

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
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-center text-slate-600">Không tìm thấy kết quả bài làm.</p>
          <Link href="/" className="block text-center text-sm text-slate-600 hover:text-slate-800 mt-4">
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

  const { data: history } = await supabase
    .from("submissions")
    .select("id, score, submitted_at, status, duration_seconds")
    .eq("assignment_id", submission.assignment_id)
    .order("submitted_at", { ascending: false })
    .limit(10)
    .returns<SubmissionSummary[]>();

  return (
    <main className="min-h-screen bg-slate-50" suppressHydrationWarning>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8" suppressHydrationWarning>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Kết quả bài làm</h1>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-800">
            ← Quay lại trang chủ
          </Link>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" suppressHydrationWarning>
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>Tên bài</span>
            <span className="font-semibold">{assignment.title}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>Điểm</span>
            <span className="text-xl font-bold text-emerald-600">{score}/{totalPoints}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>Thời gian nộp</span>
            <span>{submittedAt}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>Trạng thái</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {submission.status === "scored" ? "Đã chấm" : "Đang chấm"}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Chi tiết câu trả lời</h2>
          {questions?.map((q, idx) => {
            const answer = answerMap.get(q.id);
            const isCorrect = answer?.is_correct;
            const studentAnswer = answer?.answer;

            return (
              <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Câu {idx + 1}</p>
                      {q.type === "mcq" && isCorrect !== null && (
                        <span className={clsx(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        )}>
                          {isCorrect ? "✓ Đúng" : "✗ Sai"}
                        </span>
                      )}
                    </div>
                    {q.image_url && (
                      <div className="my-3 rounded-lg border border-slate-200 p-2">
                        <img src={q.image_url} alt="Câu hỏi" className="max-h-64 w-auto rounded" />
                      </div>
                    )}
                    {q.content && <p className="mt-1 text-base font-medium text-slate-900">{q.content}</p>}
                    
                    {q.type === "mcq" && (
                      <div className="mt-3 space-y-2">
                        {[0, 1, 2, 3].map((ci: number) => {
                          const choice = (q.choices as string[])?.[ci] || "";
                          const choiceLabel = String.fromCharCode(65 + ci);
                          const isStudentChoice = studentAnswer === choiceLabel;
                          const isCorrectAnswer = q.answer_key === choiceLabel;

                          return (
                            <div
                              key={ci}
                              className={clsx(
                                "rounded-lg border px-3 py-2 text-sm",
                                isCorrectAnswer && "border-emerald-500 bg-emerald-50",
                                isStudentChoice && !isCorrectAnswer && "border-red-500 bg-red-50",
                                !isStudentChoice && !isCorrectAnswer && "border-slate-200 bg-white"
                              )}
                            >
                              <span className="font-semibold">{choiceLabel}.</span> {choice && <span>{choice}</span>}
                              {isCorrectAnswer && <span className="ml-2 text-emerald-600">✓ Đáp án đúng</span>}
                              {isStudentChoice && !isCorrectAnswer && <span className="ml-2 text-red-600">✗ Bạn chọn</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.type === "essay" && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm text-slate-600">
                          {studentAnswer || <em className="text-slate-400">Không có câu trả lời</em>}
                        </p>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {formatPoints(answer?.points_awarded)}/{formatPoints(q.points)} điểm
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Lịch sử làm bài</h2>
            <span className="text-xs text-slate-500">Tối đa 10 lần gần nhất</span>
          </div>
          {history && history.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {history.map((h) => (
                <Link
                  key={h.id}
                  href={`/assignments/${assignment.id}/result?sid=${h.id}`}
                  className="flex items-center justify-between py-3 transition hover:bg-slate-50"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      Điểm: {h.score ?? 0}/{totalPoints}
                    </p>
                    <p className="text-xs text-slate-500">
                      Nộp lúc {new Date(h.submitted_at).toLocaleString("vi-VN")}
                      {h.duration_seconds ? ` · Thời gian làm: ${Math.round(h.duration_seconds / 60)} phút` : ""}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      h.status === "scored" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {h.status === "scored" ? "Đã chấm" : "Đang chấm"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chưa có lịch sử làm bài.</p>
          )}
        </div>

        <Link
          href={`/assignments/${assignment.id}`}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
        >
          Làm lại bài tập
        </Link>
      </div>
    </main>
  );
}
