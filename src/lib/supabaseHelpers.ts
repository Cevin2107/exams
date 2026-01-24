import { createClient } from "@supabase/supabase-js";
import { Assignment, Question, SubmissionSummary } from "./types";

const getSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
};

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
};

export async function fetchAssignments(): Promise<Assignment[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("is_hidden", false)
    .order("due_at", { ascending: true });

  if (error) {
    console.error("Error fetching assignments:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    subject: row.subject,
    grade: row.grade,
    dueAt: row.due_at,
    durationMinutes: row.duration_minutes,
    totalScore: row.total_score,
    isHidden: row.is_hidden,
    status: "not_started" as const,
    latestSubmission: null,
  }));
}

export async function fetchAssignmentsWithHistory(): Promise<Assignment[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("assignments")
    .select("*, submissions(id, submitted_at, score, status, duration_seconds)")
    .eq("is_hidden", false)
    .order("due_at", { ascending: true })
    .order("submitted_at", { foreignTable: "submissions", ascending: false })
    .limit(1, { foreignTable: "submissions" });

  if (error) {
    console.error("Error fetching assignments with history:", error);
    return [];
  }

  type SubmissionRow = { id: string; submitted_at: string; score: number | null; status: string; duration_seconds?: number | null };
  type Row = typeof data extends Array<infer R> ? R : never;

  return (data || []).map((row: Row & { submissions?: SubmissionRow[] }) => {
    const latest = row.submissions?.[0];

    const latestSubmission: SubmissionSummary | null = latest
      ? {
          id: latest.id,
          assignmentId: row.id,
          submittedAt: latest.submitted_at,
          score: latest.score ?? 0,
          status: latest.status as "pending" | "scored",
        }
      : null;

    return {
      id: row.id,
      title: row.title,
      subject: row.subject,
      grade: row.grade,
      dueAt: row.due_at,
      durationMinutes: row.duration_minutes,
      totalScore: row.total_score,
      isHidden: row.is_hidden,
      status: latestSubmission ? "completed" : "not_started",
      latestSubmission,
    } satisfies Assignment;
  });
}

export async function fetchAssignmentById(id: string): Promise<Assignment | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    subject: data.subject,
    grade: data.grade,
    dueAt: data.due_at,
    durationMinutes: data.duration_minutes,
    totalScore: data.total_score,
    isHidden: data.is_hidden,
    status: "not_started",
  };
}

export async function fetchAssignmentByIdAdmin(id: string): Promise<Assignment | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    subject: data.subject,
    grade: data.grade,
    dueAt: data.due_at,
    durationMinutes: data.duration_minutes,
    totalScore: data.total_score,
    isHidden: data.is_hidden,
    status: "not_started",
  };
}

export async function fetchQuestions(assignmentId: string): Promise<Question[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("order", { ascending: true });

  if (error) {
    console.error("Error fetching questions:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    assignmentId: row.assignment_id,
    order: row.order,
    type: row.type,
    content: row.content,
    choices: row.choices,
    answerKey: row.answer_key,
    points: row.points,
    imageUrl: row.image_url,
  }));
}

export async function createAssignment(assignment: {
  title: string;
  subject: string;
  grade: string;
  dueAt?: string;
  durationMinutes?: number;
  totalScore: number;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      title: assignment.title,
      subject: assignment.subject,
      grade: assignment.grade,
      due_at: assignment.dueAt,
      duration_minutes: assignment.durationMinutes,
      total_score: assignment.totalScore,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createQuestion(question: {
  assignmentId: string;
  type: "mcq" | "essay";
  content: string;
  choices?: string[];
  answerKey?: string;
  imageUrl?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("total_score")
    .eq("id", question.assignmentId)
    .single();

  if (assignmentError || !assignment) {
    throw assignmentError || new Error("Assignment not found");
  }

  const { data: existingQuestions, error: existingError } = await supabase
    .from("questions")
    .select("id")
    .eq("assignment_id", question.assignmentId)
    .order("order", { ascending: true });

  if (existingError) throw existingError;

  const currentCount = existingQuestions?.length ?? 0;
  const totalQuestions = currentCount + 1;
  const perQuestionPoints = Number(assignment.total_score || 0) / totalQuestions;

  const { data: inserted, error: insertError } = await supabase
    .from("questions")
    .insert({
      assignment_id: question.assignmentId,
      order: totalQuestions,
      type: question.type,
      content: question.content,
      choices: question.choices,
      answer_key: question.answerKey,
      points: perQuestionPoints,
      image_url: question.imageUrl,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  if (currentCount > 0) {
    const { error: rebalanceError } = await supabase
      .from("questions")
      .update({ points: perQuestionPoints })
      .eq("assignment_id", question.assignmentId);

    if (rebalanceError) throw rebalanceError;
  }

  return { ...inserted, points: perQuestionPoints };
}

export async function updateAssignment(data: {
  id: string;
  title?: string;
  subject?: string;
  grade?: string;
  dueAt?: string | null;
  durationMinutes?: number | null;
  totalScore?: number;
  isHidden?: boolean;
}) {
  const supabase = getSupabaseAdmin();

  const updateBody: Record<string, string | number | boolean | null> = {};
  if (data.title !== undefined) updateBody.title = data.title;
  if (data.subject !== undefined) updateBody.subject = data.subject;
  if (data.grade !== undefined) updateBody.grade = data.grade;
  if (data.dueAt !== undefined) updateBody.due_at = data.dueAt;
  if (data.durationMinutes !== undefined) updateBody.duration_minutes = data.durationMinutes;
  if (data.totalScore !== undefined) updateBody.total_score = data.totalScore;
  if (data.isHidden !== undefined) updateBody.is_hidden = data.isHidden;

  const { data: updated, error } = await supabase
    .from("assignments")
    .update(updateBody)
    .eq("id", data.id)
    .select()
    .single();

  if (error) throw error;

  if (data.totalScore !== undefined) {
    await rebalanceQuestionPoints(data.id);
  }

  return updated;
}

export async function rebalanceQuestionPoints(assignmentId: string) {
  const supabase = getSupabaseAdmin();

  const [{ data: assignment, error: assignmentError }, { data: questions, error: questionError }] = await Promise.all([
    supabase.from("assignments").select("total_score").eq("id", assignmentId).single(),
    supabase.from("questions").select("id").eq("assignment_id", assignmentId),
  ]);

  if (assignmentError) throw assignmentError;
  if (questionError) throw questionError;

  const count = questions?.length ?? 0;
  if (!assignment || count === 0) return;

  const perQuestionPoints = Number(assignment.total_score || 0) / count;
  const { error: updateError } = await supabase
    .from("questions")
    .update({ points: perQuestionPoints })
    .eq("assignment_id", assignmentId);

  if (updateError) throw updateError;
}

export async function deleteAssignment(assignmentId: string) {
  const supabase = getSupabaseAdmin();
  
  // Lấy tất cả các ảnh của questions thuộc assignment này
  const { data: questions } = await supabase
    .from("questions")
    .select("image_url")
    .eq("assignment_id", assignmentId);
  
  // Xóa các ảnh từ storage nếu có
  if (questions && questions.length > 0) {
    const imageUrls = questions
      .map(q => q.image_url)
      .filter(Boolean) as string[];
    
    if (imageUrls.length > 0) {
      const imagePaths = imageUrls.map(url => {
        // Extract path from full URL
        // URL format: https://xxx.supabase.co/storage/v1/object/public/question-images/filename.jpg
        const match = url.match(/question-images\/(.+)$/);
        return match ? match[1] : null;
      }).filter(Boolean) as string[];
      
      if (imagePaths.length > 0) {
        console.log(`Deleting ${imagePaths.length} images from storage`);
        await supabase.storage.from('question-images').remove(imagePaths);
      }
    }
  }
  
  // Xóa assignment (cascade sẽ tự động xóa tất cả dữ liệu liên quan):
  // - questions (và ảnh đã xóa ở trên)
  // - submissions (bài nộp)
  // - answers (câu trả lời)
  // - student_sessions (bao gồm draft_answers)
  console.log(`Deleting assignment ${assignmentId} and all related data`);
  const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
  if (error) throw error;
  
  console.log(`Successfully deleted assignment ${assignmentId}`);
  return { success: true };
}

export async function deleteQuestion(questionId: string) {
  const supabase = getSupabaseAdmin();

  const { data: question, error: fetchError } = await supabase
    .from("questions")
    .select("assignment_id, image_url")
    .eq("id", questionId)
    .single();

  if (fetchError || !question) throw fetchError || new Error("Question not found");

  // Xóa ảnh từ storage nếu có
  if (question.image_url) {
    const match = question.image_url.match(/question-images\/(.+)$/);
    if (match) {
      await supabase.storage.from('question-images').remove([match[1]]);
    }
  }

  const { error: deleteError } = await supabase.from("questions").delete().eq("id", questionId);
  if (deleteError) throw deleteError;

  const { data: remaining, error: remainingError } = await supabase
    .from("questions")
    .select("id")
    .eq("assignment_id", question.assignment_id)
    .order("order", { ascending: true });

  if (remainingError) throw remainingError;

  if (remaining && remaining.length > 0) {
    const updates = remaining.map((q, idx) => ({ id: q.id, order: idx + 1 }));
    const { error: reorderError } = await supabase.from("questions").upsert(updates);
    if (reorderError) throw reorderError;
    await rebalanceQuestionPoints(question.assignment_id);
  }
}

export async function updateQuestion(questionId: string, data: {
  type?: "mcq" | "essay";
  content?: string;
  choices?: string[];
  answerKey?: string | null;
  imageUrl?: string | null;
}) {
  const supabase = getSupabaseAdmin();

  // Nếu cập nhật imageUrl mới, xóa ảnh cũ
  if (data.imageUrl !== undefined) {
    const { data: oldQuestion } = await supabase
      .from("questions")
      .select("image_url")
      .eq("id", questionId)
      .single();
    
    if (oldQuestion?.image_url && oldQuestion.image_url !== data.imageUrl) {
      const match = oldQuestion.image_url.match(/question-images\/(.+)$/);
      if (match) {
        await supabase.storage.from('question-images').remove([match[1]]);
      }
    }
  }

  const updateBody: Record<string, string | string[] | null> = {};
  if (data.type !== undefined) updateBody.type = data.type;
  if (data.content !== undefined) updateBody.content = data.content;
  if (data.choices !== undefined) updateBody.choices = data.choices;
  if (data.answerKey !== undefined) updateBody.answer_key = data.answerKey;
  if (data.imageUrl !== undefined) updateBody.image_url = data.imageUrl;

  const { data: question, error } = await supabase
    .from("questions")
    .update(updateBody)
    .eq("id", questionId)
    .select("assignment_id")
    .single();

  if (error) throw error;

  if (question?.assignment_id) {
    await rebalanceQuestionPoints(question.assignment_id);
  }

  return question;
}

export async function fetchAssignmentAnalytics(assignmentId: string) {
  const supabase = getSupabaseAdmin();

  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select("id, score, duration_seconds")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });

  if (submissionsError) throw submissionsError;

  const scores = (submissions || []).map((s) => Number(s.score ?? 0));
  const durations = (submissions || []).map((s) => Number(s.duration_seconds ?? 0)).filter(Boolean);

  const averageScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const minScore = scores.length ? Math.min(...scores) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const averageDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const submissionIds = (submissions || []).map((s) => s.id);
  let questionStats: Array<{ questionId: string; content: string; correctRate: number; total: number }> = [];

  if (submissionIds.length > 0) {
    const [{ data: questions, error: qErr }, { data: answers, error: aErr }] = await Promise.all([
      supabase.from("questions").select("id, content, answer_key, type, order").eq("assignment_id", assignmentId).order("order", { ascending: true }),
      supabase.from("answers").select("question_id, is_correct").in("submission_id", submissionIds),
    ]);

    if (qErr) throw qErr;
    if (aErr) throw aErr;

    questionStats = (questions || []).map((q) => {
      const related = (answers || []).filter((a) => a.question_id === q.id);
      const total = related.length;
      const correct = related.filter((a) => a.is_correct === true).length;
      const correctRate = total ? correct / total : 0;
      return { questionId: q.id, content: q.content, correctRate, total, order: q.order };
    });
  }

  return {
    submissionCount: submissions?.length ?? 0,
    averageScore,
    minScore,
    maxScore,
    averageDuration,
    questionStats,
  };
}

export async function fetchSubmissionsForExport(assignmentId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("submissions")
    .select("id, student_code, score, submitted_at, duration_seconds, status")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchAllAssignmentsAdmin() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// Thống kê tổng quát của tất cả học sinh
export async function fetchAllStudentsStats() {
  const supabase = getSupabaseAdmin();
  
  // Lấy tất cả submissions với thông tin assignment
  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select(`
      id,
      student_name,
      score,
      submitted_at,
      duration_seconds,
      assignment_id,
      assignments!inner (
        title,
        subject,
        grade
      )
    `)
    .order("submitted_at", { ascending: false });

  if (submissionsError) throw submissionsError;

  // Lấy tất cả sessions đang làm dở (active, chưa có submission)
  const { data: activeSessions, error: sessionsError } = await supabase
    .from("student_sessions")
    .select(`
      id,
      student_name,
      assignment_id,
      started_at,
      draft_answers,
      assignments!inner (
        id,
        title,
        subject,
        grade
      )
    `)
    .eq("status", "active")
    .is("submission_id", null)
    .order("started_at", { ascending: false });

  if (sessionsError) throw sessionsError;

  // Group theo student_name
  const studentMap = new Map<string, {
    studentName: string;
    totalSubmissions: number;
    inProgressCount: number;
    submissions: Array<{
      id: string;
      assignmentTitle: string;
      subject: string;
      grade: string;
      score: number;
      submittedAt: string;
      durationSeconds: number;
    }>;
    inProgress: Array<{
      sessionId: string;
      assignmentId: string;
      assignmentTitle: string;
      subject: string;
      grade: string;
      startedAt: string;
      questionsAnswered: number;
      draftAnswers: Record<string, string>;
    }>;
  }>();

  // Thêm submissions
  type SubmissionRow = {
    id: string;
    student_name: string;
    score?: number;
    submitted_at: string;
    duration_seconds?: number;
    assignments: { title?: string; subject?: string; grade?: string };
  };
  
  ((submissions as unknown as SubmissionRow[]) || []).forEach((sub) => {
    const name = sub.student_name;
    if (!studentMap.has(name)) {
      studentMap.set(name, {
        studentName: name,
        totalSubmissions: 0,
        inProgressCount: 0,
        submissions: [],
        inProgress: [],
      });
    }
    
    const student = studentMap.get(name)!;
    student.totalSubmissions++;
    student.submissions.push({
      id: sub.id,
      assignmentTitle: sub.assignments?.title || "N/A",
      subject: sub.assignments?.subject || "N/A",
      grade: sub.assignments?.grade || "N/A",
      score: sub.score || 0,
      submittedAt: sub.submitted_at,
      durationSeconds: sub.duration_seconds || 0,
    });
  });

  // Thêm sessions đang làm dở
  type SessionRow = {
    id: string;
    student_name: string;
    assignment_id: string;
    started_at: string;
    draft_answers?: Record<string, string>;
    assignments: { id?: string; title?: string; subject?: string; grade?: string };
  };
  
  ((activeSessions as unknown as SessionRow[]) || []).forEach((session) => {
    const name = session.student_name;
    if (!studentMap.has(name)) {
      studentMap.set(name, {
        studentName: name,
        totalSubmissions: 0,
        inProgressCount: 0,
        submissions: [],
        inProgress: [],
      });
    }
    
    const student = studentMap.get(name)!;
    student.inProgressCount++;
    const draftAnswers = session.draft_answers || {};
    student.inProgress.push({
      sessionId: session.id,
      assignmentId: session.assignment_id,
      assignmentTitle: session.assignments?.title || "N/A",
      subject: session.assignments?.subject || "N/A",
      grade: session.assignments?.grade || "N/A",
      startedAt: session.started_at,
      questionsAnswered: Object.keys(draftAnswers).length,
      draftAnswers: draftAnswers,
    });
  });

  return Array.from(studentMap.values());
}

// Thống kê chi tiết của 1 học sinh theo tên
export async function fetchStudentDetailStats(studentName: string) {
  const supabase = getSupabaseAdmin();
  
  const { data: submissions, error } = await supabase
    .from("submissions")
    .select(`
      id,
      student_name,
      score,
      submitted_at,
      duration_seconds,
      assignment_id,
      assignments!inner (
        id,
        title,
        subject,
        grade,
        total_score
      )
    `)
    .eq("student_name", studentName)
    .order("submitted_at", { ascending: false });

  if (error) throw error;

  // Group theo assignment để đếm số lần làm
  const assignmentMap = new Map<string, {
    assignmentId: string;
    assignmentTitle: string;
    subject: string;
    grade: string;
    totalScore: number;
    attempts: Array<{
      id: string;
      score: number;
      submittedAt: string;
      durationSeconds: number;
    }>;
  }>();

  type StudentSubmissionRow = {
    id: string;
    assignment_id: string;
    score: number;
    submitted_at: string;
    duration_seconds: number;
    assignments: { id?: string; title?: string; subject?: string; grade?: string; total_score?: number };
  };
  
  ((submissions as unknown as StudentSubmissionRow[]) || []).forEach((sub) => {
    const aId = sub.assignment_id;
    if (!assignmentMap.has(aId)) {
      assignmentMap.set(aId, {
        assignmentId: aId,
        assignmentTitle: sub.assignments?.title || "N/A",
        subject: sub.assignments?.subject || "N/A",
        grade: sub.assignments?.grade || "N/A",
        totalScore: sub.assignments?.total_score || 0,
        attempts: [],
      });
    }
    
    const assignment = assignmentMap.get(aId)!;
    assignment.attempts.push({
      id: sub.id,
      score: sub.score || 0,
      submittedAt: sub.submitted_at,
      durationSeconds: sub.duration_seconds || 0,
    });
  });

  return {
    studentName,
    totalSubmissions: submissions?.length || 0,
    assignments: Array.from(assignmentMap.values()),
  };
}
