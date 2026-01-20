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
    <main className="min-h-screen bg-slate-50" suppressHydrationWarning>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8" suppressHydrationWarning>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Kết quả bài làm</h1>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← Quay lại
          </Link>
        </div>

        {/* Kết quả tổng quan */}
        <div className="rounded-lg border border-slate-200 bg-white p-8" suppressHydrationWarning>
          <div className="text-center mb-6">
            <p className="text-sm text-slate-600 mb-3">Điểm của bạn</p>
            <p className="text-7xl font-bold text-slate-900">{score}<span className="text-3xl text-slate-500">/{totalPoints}</span></p>
            <p className="text-2xl text-slate-600 mt-2">{percentage}%</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600">{correctCount}</p>
              <p className="text-sm text-slate-600 mt-1">Đúng</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{incorrectCount}</p>
              <p className="text-sm text-slate-600 mt-1">Sai</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-400">{unansweredCount}</p>
              <p className="text-sm text-slate-600 mt-1">Bỏ qua</p>
            </div>
          </div>
        </div>

        {/* Thông tin chi tiết */}
        <div className="rounded-lg border border-slate-200 bg-white p-4" suppressHydrationWarning>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-600">Bài tập:</span>
              <span className="ml-2 font-semibold text-slate-900">{assignment.title}</span>
            </div>
            <div>
              <span className="text-slate-600">Môn:</span>
              <span className="ml-2 font-semibold text-slate-900">{assignment.subject}</span>
            </div>
            <div>
              <span className="text-slate-600">Nộp lúc:</span>
              <span className="ml-2 font-semibold text-slate-900">{submittedAt}</span>
            </div>
            <div>
              <span className="text-slate-600">Trạng thái:</span>
              <span className="ml-2 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {submission.status === "scored" ? "Đã chấm" : "Đang chấm"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Chi tiết từng câu</h2>
          {questions?.map((q, idx) => {
            const answer = answerMap.get(q.id);
            const isCorrect = answer?.is_correct;
            const studentAnswer = answer?.answer;

            return (
              <div key={q.id} className={clsx(
                "rounded-lg border bg-white p-4",
                isCorrect === true ? "border-emerald-200 bg-emerald-50/30" : 
                isCorrect === false ? "border-red-200 bg-red-50/30" : "border-slate-200"
              )}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">Câu {idx + 1}</span>
                    {q.type === "mcq" && isCorrect !== null && (
                      <span className={clsx(
                        "rounded-md px-2 py-0.5 text-xs font-semibold",
                        isCorrect ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                      )}>
                        {isCorrect ? "✓ Đúng" : "✗ Sai"}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-slate-600">
                    {formatPoints(answer?.points_awarded)}/{formatPoints(q.points)} điểm
                  </span>
                </div>

                {q.image_url && (
                  <div className="mb-3 rounded-lg border border-slate-200 p-2 bg-white">
                    <img src={q.image_url} alt="Câu hỏi" className="max-h-64 w-auto rounded" />
                  </div>
                )}
                {q.content && <p className="text-base text-slate-900 mb-3">{q.content}</p>}
                
                {q.type === "mcq" && (
                  <div className="space-y-2">
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
                            isCorrectAnswer && "border-emerald-600 bg-emerald-50 font-medium",
                            isStudentChoice && !isCorrectAnswer && "border-red-600 bg-red-50 font-medium",
                            !isStudentChoice && !isCorrectAnswer && "border-slate-200 bg-white"
                          )}
                        >
                          <span className="font-semibold">{choiceLabel}.</span> {choice && <span>{choice}</span>}
                          {isCorrectAnswer && <span className="ml-2 text-emerald-700 font-semibold">← Đáp án đúng</span>}
                          {isStudentChoice && !isCorrectAnswer && <span className="ml-2 text-red-700 font-semibold">← Bạn chọn</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.type === "essay" && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">
                      {studentAnswer || <em className="text-slate-400">Không có câu trả lời</em>}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">Lịch sử làm bài</h2>
            <span className="text-xs text-slate-500">10 lần gần nhất</span>
          </div>
          {history && history.length > 1 ? (
            <>
              <p className="text-sm text-slate-600 mb-3">
                {history[0].score && history[1].score && history[0].score > history[1].score 
                  ? `🎉 Bạn đã cải thiện ${(history[0].score - history[1].score).toFixed(3)} điểm so với lần trước!`
                  : history[0].score && history[1].score && history[0].score < history[1].score
                  ? `Điểm giảm ${(history[1].score - history[0].score).toFixed(3)} điểm so với lần trước. Cố gắng hơn nhé!`
                  : 'Tiếp tục luyện tập để cải thiện điểm số!'}
              </p>
              <div className="space-y-2">
                {history.map((h, idx) => (
                  <Link
                    key={h.id}
                    href={`/assignments/${assignment.id}/result?sid=${h.id}`}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-lg border transition hover:bg-slate-50",
                      h.id === sid ? "border-slate-900 bg-slate-50" : "border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-500">#{idx + 1}</span>
                      <div>
                        <p className="text-lg font-bold text-slate-900">
                          {h.score ?? 0}/{totalPoints}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(h.submitted_at).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </div>
                    {h.id === sid && (
                      <span className="text-xs font-semibold text-slate-900">← Hiện tại</span>
                    )}
                  </Link>
                ))}
              </div>
            </>
          ) : history && history.length === 1 ? (
            <p className="text-sm text-slate-500">Đây là lần làm bài đầu tiên. Làm lại để cải thiện điểm!</p>
          ) : (
            <p className="text-sm text-slate-500">Chưa có lịch sử làm bài.</p>
          )}
        </div>

        <Link
          href={`/assignments/${assignment.id}`}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Làm lại để cải thiện điểm
        </Link>
      </div>
    </main>
  );
}
