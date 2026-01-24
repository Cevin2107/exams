"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SUBJECT_OPTIONS = ["Toán học", "Vật lý", "Hóa học"];
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`);
const CUSTOM_VALUE = "custom";

interface Assignment {
  id: string;
  title: string;
  subject: string;
  grade: string;
  total_score: number;
  due_at?: string | null;
  duration_minutes?: number | null;
  is_hidden?: boolean;
}

interface Question {
  id: string;
  order: number;
  type: string;
  content: string;
  choices?: string[];
  answerKey?: string;
  points: number;
  imageUrl?: string;
}

interface Analytics {
  submissionCount: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  averageDuration: number;
  questionStats: Array<{ questionId: string; content: string; correctRate: number; total: number; order: number }>;
}

interface EditQuestionForm {
  content: string;
  type: "mcq" | "essay";
  choices: string[];
  answerKey: string;
  imageUrl: string;
}

interface AiQuestion {
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correct_answer: "A" | "B" | "C" | "D";
}

interface StudentSession {
  id: string;
  student_name: string;
  status: "active" | "exited" | "submitted";
  started_at: string;
  last_activity_at: string;
  exit_count: number;
  draft_answers?: Record<string, string>;
  submissions?: {
    id: string;
    score: number;
    submitted_at: string;
    status: string;
  } | null;
}

interface QuestionDetail {
  questionId: string;
  order: number;
  content: string;
  type: string;
  imageUrl?: string;
  choices?: string[];
  answerKey?: string;          // API field
  correctAnswer?: string;       // Mapped field for display
  studentAnswer?: string;
  isCorrect?: boolean;
  points: number;
}

interface StudentDetail {
  sessionId: string;
  submissionId?: string;
  studentName: string;
  status: "active" | "exited" | "submitted";
  score?: number;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  questions: QuestionDetail[];
}

export default function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [studentSessions, setStudentSessions] = useState<StudentSession[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAiForm, setShowAiForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [showStudentDetail, setShowStudentDetail] = useState(false);
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // AI generation states
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiTextInput, setAiTextInput] = useState("");
  const [aiQuestions, setAiQuestions] = useState<AiQuestion[]>([]);
  const [aiPreviewText, setAiPreviewText] = useState("");
  const [aiSources, setAiSources] = useState<Array<{ name: string; chars: number; kind: string }>>([]);
  const [aiStatus, setAiStatus] = useState<"idle" | "running" | "error" | "done">("idle");
  const [aiMessage, setAiMessage] = useState("");
  const [aiError, setAiError] = useState("");
  const [savingAi, setSavingAi] = useState(false);
  const [selectedAiQuestionIndices, setSelectedAiQuestionIndices] = useState<Set<number>>(new Set());
  const [editForm, setEditForm] = useState({
    title: "",
    subject: "",
    grade: "",
    dueAt: "",
    durationMinutes: "",
    totalScore: "",
    isHidden: false,
  });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionForm, setEditQuestionForm] = useState<EditQuestionForm>({
    content: "",
    type: "mcq",
    choices: ["", "", "", ""],
    answerKey: "A",
    imageUrl: "",
  });
  const router = useRouter();
  const subjectSelectValue = SUBJECT_OPTIONS.includes(editForm.subject) ? editForm.subject : CUSTOM_VALUE;
  const gradeSelectValue = GRADE_OPTIONS.includes(editForm.grade) ? editForm.grade : CUSTOM_VALUE;

  const handleSubjectSelectChange = (value: string) => {
    setEditForm((p) => {
      if (value === CUSTOM_VALUE) {
        const carry = SUBJECT_OPTIONS.includes(p.subject) ? "" : p.subject;
        return { ...p, subject: carry };
      }
      return { ...p, subject: value };
    });
  };

  const handleGradeSelectChange = (value: string) => {
    setEditForm((p) => {
      if (value === CUSTOM_VALUE) {
        const carry = GRADE_OPTIONS.includes(p.grade) ? "" : p.grade;
        return { ...p, grade: carry };
      }
      return { ...p, grade: value };
    });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    params.then(p => {
      setAssignmentId(p.id);
      loadData(p.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(id: string) {
    try {
      const res = await fetch(`/api/admin/assignments/${id}`);
      const data = await res.json();
      setAssignment(data.assignment);
      setQuestions(data.questions || []);
      if (data.assignment) {
        // Convert UTC to Vietnam time (UTC+7) for datetime-local input
        let dueAtLocal = "";
        if (data.assignment.due_at) {
          const date = new Date(data.assignment.due_at);
          // Convert to Vietnam timezone
          const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
          // Get local components (treating as if UTC)
          const year = vietnamTime.getUTCFullYear();
          const month = String(vietnamTime.getUTCMonth() + 1).padStart(2, '0');
          const day = String(vietnamTime.getUTCDate()).padStart(2, '0');
          const hours = String(vietnamTime.getUTCHours()).padStart(2, '0');
          const minutes = String(vietnamTime.getUTCMinutes()).padStart(2, '0');
          dueAtLocal = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        
        setEditForm({
          title: data.assignment.title || "",
          subject: data.assignment.subject || "",
          grade: data.assignment.grade || "",
          dueAt: dueAtLocal,
          durationMinutes: data.assignment.duration_minutes ?? "",
          totalScore: data.assignment.total_score?.toString() ?? "",
          isHidden: Boolean(data.assignment.is_hidden),
        });
      }
      loadAnalytics(id);
      loadStudentSessions(id);
    } catch (err) {
      console.error("Lỗi tải dữ liệu:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStudentSessions(id: string) {
    try {
      const res = await fetch(`/api/student-sessions?assignmentId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setStudentSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách học sinh:", err);
    }
  }

  // Auto-refresh danh sách học sinh mỗi 3 giây
  useEffect(() => {
    if (!assignmentId) return;
    
    const interval = setInterval(() => {
      loadStudentSessions(assignmentId);
    }, 3000); // 3 giây

    return () => clearInterval(interval);
  }, [assignmentId]);

  const toggleSessionSelect = (sessionId: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const toggleSelectAllSessions = () => {
    if (selectedSessions.size === studentSessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(studentSessions.map(s => s.id)));
    }
  };

  const deleteSelectedSessions = async () => {
    if (selectedSessions.size === 0) return;
    if (!confirm(`Xóa ${selectedSessions.size} học sinh đã chọn?`)) return;

    try {
      for (const sessionId of selectedSessions) {
        await fetch(`/api/student-sessions/${sessionId}`, { method: "DELETE" });
      }
      setSelectedSessions(new Set());
      await loadStudentSessions(assignmentId);
    } catch (err) {
      console.error("Lỗi xóa sessions:", err);
      alert("Có lỗi khi xóa");
    }
  };

  async function loadAnalytics(id: string) {
    try {
      setAnalyticsLoading(true);
      const res = await fetch(`/api/admin/assignments/${id}/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Lỗi tải thống kê:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function loadStudentDetail(session: StudentSession) {
    try {
      setLoadingDetail(true);
      setShowStudentDetail(true);

      // Nếu đã nộp bài, load từ submission
      if (session.submissions && session.submissions.id) {
        const res = await fetch(`/api/admin/submissions/${session.submissions.id}/detail`);
        if (res.ok) {
          const data = await res.json();
          const detail: StudentDetail = {
            sessionId: session.id,
            submissionId: session.submissions.id,
            studentName: session.student_name,
            status: "submitted",
            score: session.submissions.score,
            totalQuestions: data.questions.length,
            answeredCount: data.questions.filter((q: QuestionDetail) => q.studentAnswer).length,
            correctCount: data.questions.filter((q: QuestionDetail) => q.isCorrect).length,
            questions: data.questions.map((q: QuestionDetail) => ({
              questionId: q.questionId,
              order: q.order,
              content: q.content,
              type: q.type,
              imageUrl: q.imageUrl,
              choices: q.choices,
              correctAnswer: q.answerKey,  // API trả về answerKey, không phải correctAnswer
              studentAnswer: q.studentAnswer,
              isCorrect: q.isCorrect,
              points: q.points
            }))
          };
          setStudentDetail(detail);
        }
      } else {
        // Chưa nộp bài, load từ session với draft_answers
        const res = await fetch(`/api/admin/sessions/${session.id}/detail`);
        if (res.ok) {
          const data = await res.json();
          const draftAnswers = data.draft_answers || {};
          const answeredCount = Object.keys(draftAnswers).filter(k => draftAnswers[k]).length;
          
          const detail: StudentDetail = {
            sessionId: session.id,
            studentName: session.student_name,
            status: session.status,
            totalQuestions: data.questions.length,
            answeredCount,
            correctCount: 0, // Chưa chấm
            questions: data.questions.map((q: { id: string; order: number; content: string; type: string; imageUrl?: string; choices?: string[]; answerKey?: string; points: number }) => ({
              questionId: q.id,
              order: q.order,
              content: q.content,
              type: q.type,
              imageUrl: q.imageUrl,
              choices: q.choices,
              correctAnswer: q.answerKey,
              studentAnswer: draftAnswers[q.id],
              isCorrect: undefined, // Chưa chấm
              points: q.points
            }))
          };
          setStudentDetail(detail);
        }
      }
    } catch (err) {
      console.error("Lỗi tải chi tiết học sinh:", err);
      alert("Không thể tải chi tiết");
    } finally {
      setLoadingDetail(false);
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/admin/upload-image", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }

    const data = await res.json();
    return data.url as string;
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;

        setUploading(true);
        try {
          const url = await uploadImage(file);
          setImagePreview(url);
        } catch (error) {
          console.error("Lỗi khi upload ảnh:", error);
        } finally {
          setUploading(false);
        }
        break;
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadImage(file);
      setImagePreview(url);
    } catch (error) {
      console.error("Lỗi khi upload ảnh:", error);
    } finally {
      setUploading(false);
    }
  };

  async function handleAddQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const type = formData.get("type") as string;
    const choices = type === "mcq" 
      ? [
          formData.get("choice0") as string,
          formData.get("choice1") as string,
          formData.get("choice2") as string,
          formData.get("choice3") as string,
        ].filter(Boolean)
      : undefined;

    const data = {
      assignmentId,
      order: questions.length + 1,
      type,
      content: formData.get("content") as string,
      choices,
      answerKey: type === "mcq" ? (formData.get("answerKey") as string) : undefined,
      imageUrl: imagePreview || undefined,
    };

    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setShowAddForm(false);
        setImagePreview("");
        loadData(assignmentId);
      } else {
        console.error("Lỗi thêm câu hỏi");
      }
    } catch (err) {
      console.error("Lỗi kết nối:", err);
    }
  }

  async function handleUpdateAssignment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      // Convert datetime-local input to Vietnam timezone (UTC+7)
      let dueAtISO = null;
      if (editForm.dueAt) {
        // editForm.dueAt is in format "YYYY-MM-DDThh:mm" (browser local time)
        // We need to interpret it as Vietnam time (UTC+7)
        const localDate = new Date(editForm.dueAt);
        // Get the time components as if they were Vietnam time
        const vietnamOffset = 7 * 60; // UTC+7 in minutes
        const localOffset = localDate.getTimezoneOffset(); // local offset from UTC in minutes (negative for positive timezones)
        const offsetDiff = vietnamOffset + localOffset;
        const adjustedDate = new Date(localDate.getTime() - offsetDiff * 60 * 1000);
        dueAtISO = adjustedDate.toISOString();
      }

      const payload = {
        title: editForm.title,
        subject: editForm.subject,
        grade: editForm.grade,
        dueAt: dueAtISO,
        durationMinutes: editForm.durationMinutes === "" ? null : Number(editForm.durationMinutes),
        totalScore: editForm.totalScore === "" ? undefined : Number(editForm.totalScore),
        isHidden: editForm.isHidden,
      };

      const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Cập nhật thất bại");
      await loadData(assignmentId);
      setShowEditForm(false);
    } catch (err) {
      console.error("Lỗi cập nhật bài tập:", err);
    }
  }

  async function handleExtendDue(minutes: number) {
    if (!assignment) return;
    const base = assignment.due_at ? new Date(assignment.due_at) : new Date();
    const next = new Date(base.getTime() + minutes * 60 * 1000);
    try {
      const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: next.toISOString() }),
      });
      if (!res.ok) throw new Error("Gia hạn thất bại");
      await loadData(assignmentId);
    } catch (err) {
      console.error("Lỗi gia hạn:", err);
    }
  }

  async function handleDeleteAssignment() {
    if (!assignmentId || deleting) return;
    const confirmed = confirm("Xóa bài tập này? Hành động này sẽ xóa cả câu hỏi và các lần nộp.");
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/assignments/${assignmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xóa thất bại");
      router.push("/admin/dashboard");
    } catch (err) {
      console.error("Lỗi xóa bài tập:", err);
      setDeleting(false);
    }
  }

  function handleExportCsv() {
    window.open(`/api/admin/assignments/${assignmentId}/export`, "_blank");
  }

  function startEditQuestion(q: Question) {
    setEditingQuestionId(q.id);
    setEditQuestionForm({
      content: q.content,
      type: q.type as "mcq" | "essay",
      choices: q.choices || ["", "", "", ""],
      answerKey: q.answerKey || "A",
      imageUrl: q.imageUrl || "",
    });
  }

  async function submitEditQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingQuestionId) return;
    try {
      const payload: {
        type: "mcq" | "essay";
        content: string;
        choices?: string[];
        answerKey?: string | null;
        imageUrl: string | null;
      } = {
        type: editQuestionForm.type,
        content: editQuestionForm.content,
        choices: editQuestionForm.type === "mcq" ? editQuestionForm.choices.filter(Boolean) : undefined,
        answerKey: editQuestionForm.type === "mcq" ? editQuestionForm.answerKey : null,
        imageUrl: editQuestionForm.imageUrl || null,
      };

      const res = await fetch(`/api/admin/questions/${editingQuestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Cập nhật câu hỏi thất bại");
      setEditingQuestionId(null);
      await loadData(assignmentId);
    } catch (err) {
      console.error("Lỗi cập nhật câu hỏi:", err);
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!confirm("Xóa câu hỏi này?")) return;
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xóa thất bại");
      await loadData(assignmentId);
    } catch (err) {
      console.error("Lỗi xóa câu hỏi:", err);
    }
  }

  // Multi-select functions for existing questions
  const toggleQuestionSelect = (id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllQuestions = () => {
    if (selectedQuestionIds.size === questions.length) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(questions.map((q) => q.id)));
    }
  };

  const deleteSelectedQuestions = async () => {
    if (selectedQuestionIds.size === 0) return;
    if (!confirm(`Xóa ${selectedQuestionIds.size} câu hỏi đã chọn?`)) return;
    
    try {
      await Promise.all(
        Array.from(selectedQuestionIds).map((id) =>
          fetch(`/api/admin/questions/${id}`, { method: "DELETE" })
        )
      );
      setSelectedQuestionIds(new Set());
      await loadData(assignmentId);
    } catch (err) {
      console.error("Lỗi xóa câu hỏi:", err);
    }
  };

  // AI generation functions
  const addAiFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    setAiFiles((prev) => [...prev, ...incoming].slice(0, 20));
    setAiError("");
  };

  const handleAiFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addAiFiles(files);
    e.target.value = "";
  };

  const handleAiPaste = (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.includes("image")) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      e.preventDefault();
      addAiFiles(files);
    }
  };

  const removeAiFile = (index: number) => {
    setAiFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeAllAiFiles = () => {
    setAiFiles([]);
    setAiTextInput("");
  };

  const addEmptyAiQuestion = () => {
    setAiQuestions((prev) => [
      ...prev,
      {
        question: "",
        options: { A: "", B: "", C: "", D: "" },
        correct_answer: "A",
      },
    ]);
  };

  const updateAiQuestion = (index: number, value: Partial<AiQuestion>) => {
    setAiQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...value } : q)));
  };

  const updateAiOption = (index: number, key: "A" | "B" | "C" | "D", value: string) => {
    setAiQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, options: { ...q.options, [key]: value } } : q))
    );
  };

  const removeAiQuestion = (index: number) => {
    setAiQuestions((prev) => prev.filter((_, i) => i !== index));
    setSelectedAiQuestionIndices((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const toggleAiQuestionSelect = (index: number) => {
    setSelectedAiQuestionIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAllAiQuestions = () => {
    if (selectedAiQuestionIndices.size === aiQuestions.length) {
      setSelectedAiQuestionIndices(new Set());
    } else {
      setSelectedAiQuestionIndices(new Set(aiQuestions.map((_, i) => i)));
    }
  };

  const removeSelectedAiQuestions = () => {
    if (selectedAiQuestionIndices.size === 0) return;
    if (!confirm(`Xóa ${selectedAiQuestionIndices.size} câu hỏi đã chọn?`)) return;
    setAiQuestions((prev) => prev.filter((_, i) => !selectedAiQuestionIndices.has(i)));
    setSelectedAiQuestionIndices(new Set());
  };

  const handleGenerateAi = async () => {
    if (!aiFiles.length && !aiTextInput.trim()) {
      setAiError("Thêm ít nhất 1 ảnh/PDF hoặc văn bản để AI xử lý.");
      return;
    }
    setAiStatus("running");
    setAiMessage("Đang quét nội dung và sinh câu hỏi...");
    setAiError("");

    const formData = new FormData();
    aiFiles.forEach((file) => formData.append("files", file));
    if (aiTextInput.trim()) {
      formData.append("manualText", aiTextInput.trim());
    }

    try {
      const res = await fetch("/api/admin/ai/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.details ? `\n${err.details}` : "";
        setAiError((err.error || "AI gặp lỗi, vui lòng thử lại.") + detail);
        setAiStatus("error");
        return;
      }

      const data = await res.json();
      // Thêm câu hỏi mới vào danh sách hiện có
      setAiQuestions((prev) => [...prev, ...(data.questions || [])]);
      setAiPreviewText(data.cleanedText || "");
      setAiSources(data.sources || []);
      setAiStatus("done");
      setAiMessage("Đã sinh câu hỏi, hãy rà soát và chỉnh sửa trước khi lưu.");
    } catch {
      setAiError("Không thể tạo câu hỏi bằng AI lúc này.");
      setAiStatus("error");
    }
  };

  const handleSaveAiQuestions = async () => {
    if (aiQuestions.length === 0) {
      setAiError("Chưa có câu hỏi để lưu.");
      return;
    }

    setSavingAi(true);
    try {
      for (const [index, q] of aiQuestions.entries()) {
        const questionRes = await fetch("/api/admin/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: assignmentId,
            type: "mcq",
            content: q.question,
            choices: [q.options.A, q.options.B, q.options.C, q.options.D],
            answerKey: q.correct_answer,
            order: questions.length + index + 1,
          }),
        });

        if (!questionRes.ok) {
          throw new Error(`Lỗi lưu câu hỏi ${index + 1}`);
        }
      }

      // Reset AI form
      setAiQuestions([]);
      setAiFiles([]);
      setAiTextInput("");
      setAiPreviewText("");
      setAiSources([]);
      setAiStatus("idle");
      setAiMessage("");
      setShowAiForm(false);
      
      // Reload questions
      await loadData(assignmentId);
    } catch (err) {
      console.error("Lỗi lưu câu hỏi AI", err);
      setAiError("Không thể lưu câu hỏi, vui lòng thử lại.");
    } finally {
      setSavingAi(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Đang tải...</div>;
  if (!assignment) return <div className="p-8 text-center">Không tìm thấy bài tập</div>;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{assignment.title}</h1>
            <p className="text-sm text-slate-600">{assignment.subject} · {assignment.grade}</p>
            <p className="text-xs text-slate-500 mt-1">
              Hạn: {assignment.due_at ? new Date(assignment.due_at).toLocaleString("vi-VN") : "Chưa đặt"}
              {assignment.is_hidden ? " · Đang ẩn" : ""}
            </p>
          </div>
          <Link href="/admin/dashboard" className="text-sm text-slate-600 hover:text-slate-800">
            ← Quay lại
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Thông tin bài tập</h2>
              <p className="text-sm text-slate-600">Tổng điểm: {assignment.total_score}</p>
              <p className="text-sm text-slate-600">Thời gian: {assignment.duration_minutes ? `${assignment.duration_minutes} phút` : "Không giới hạn"}</p>
              <p className="text-sm text-slate-600">Hạn nộp: {assignment.due_at ? new Date(assignment.due_at).toLocaleString("vi-VN") : "Chưa đặt"}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setShowEditForm((v) => !v)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400"
              >
                {showEditForm ? "Đóng" : "Chỉnh sửa"}
              </button>
              <button
                onClick={handleDeleteAssignment}
                disabled={deleting}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 disabled:opacity-60"
              >
                {deleting ? "Đang xóa..." : "Xóa bài"}
              </button>
              <button
                onClick={() => handleExtendDue(30)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-slate-400"
              >
                +30 phút
              </button>
              <button
                onClick={() => handleExtendDue(60)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-slate-400"
              >
                +1 giờ
              </button>
              <button
                onClick={handleExportCsv}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
              >
                Xuất CSV
              </button>
            </div>
          </div>
        </div>

        {showEditForm && (
          <form onSubmit={handleUpdateAssignment} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tên bài tập</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Môn học</label>
                <div className="mt-1 flex flex-col gap-2">
                  <select
                    value={subjectSelectValue}
                    onChange={(e) => handleSubjectSelectChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                    required
                  >
                    {SUBJECT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value={CUSTOM_VALUE}>Khác</option>
                  </select>
                  {subjectSelectValue === CUSTOM_VALUE && (
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                      value={editForm.subject}
                      onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
                      required
                      placeholder="Nhập môn khác"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Lớp</label>
                <div className="mt-1 flex flex-col gap-2">
                  <select
                    value={gradeSelectValue}
                    onChange={(e) => handleGradeSelectChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                    required
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                    <option value={CUSTOM_VALUE}>Khác</option>
                  </select>
                  {gradeSelectValue === CUSTOM_VALUE && (
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                      value={editForm.grade}
                      onChange={(e) => setEditForm((p) => ({ ...p, grade: e.target.value }))}
                      required
                      placeholder="Nhập lớp khác (vd: Lớp 10 nâng cao)"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Hạn nộp</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={editForm.dueAt}
                  onChange={(e) => setEditForm((p) => ({ ...p, dueAt: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Thời gian (phút)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={editForm.durationMinutes}
                  onChange={(e) => setEditForm((p) => ({ ...p, durationMinutes: e.target.value }))}
                  placeholder="Ví dụ: 30"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tổng điểm</label>
                <input
                  type="number"
                  step="0.5"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={editForm.totalScore}
                  onChange={(e) => setEditForm((p) => ({ ...p, totalScore: e.target.value }))}
                  required
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.isHidden}
                    onChange={(e) => setEditForm((p) => ({ ...p, isHidden: e.target.checked }))}
                  />
                  Ẩn bài
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Câu hỏi ({questions.length})</h2>
            <p className="text-sm text-slate-600">Tổng điểm: {assignment.total_score}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {questions.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={toggleSelectAllQuestions}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400"
                >
                  {selectedQuestionIds.size === questions.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
                {selectedQuestionIds.size > 0 && (
                  <button
                    type="button"
                    onClick={deleteSelectedQuestions}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm hover:border-red-400"
                  >
                    Xóa đã chọn ({selectedQuestionIds.size})
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => setShowAiForm(!showAiForm)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              {showAiForm ? "Đóng AI" : "🤖 Tạo bằng AI"}
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              {showAddForm ? "Hủy" : "+ Thêm câu hỏi"}
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Báo cáo chi tiết</h3>
            {analyticsLoading && <span className="text-xs text-slate-500">Đang tải...</span>}
          </div>
          {analytics ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-600 mb-2">Điểm số</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Trung bình</p>
                      <p className="text-2xl font-bold text-blue-600">{analytics.averageScore.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Cao nhất</p>
                      <p className="text-2xl font-bold text-emerald-600">{analytics.maxScore.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Thấp nhất</p>
                      <p className="text-2xl font-bold text-red-600">{analytics.minScore.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-600 mb-2">Thống kê</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Số lần nộp</p>
                      <p className="text-2xl font-bold text-slate-900">{analytics.submissionCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Thời gian TB</p>
                      <p className="text-2xl font-bold text-slate-900">{Math.round((analytics.averageDuration || 0) / 60)} ph</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Chưa có thống kê.</p>
          )}
        </div>

        {/* Danh sách học sinh */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">Danh sách học sinh</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                  <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                  Real-time
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1">Tự động cập nhật mỗi 3 giây</p>
            </div>
            <div className="flex gap-2">
              {studentSessions.length > 0 && (
                <>
                  <button
                    onClick={toggleSelectAllSessions}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400"
                  >
                    {selectedSessions.size === studentSessions.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </button>
                  {selectedSessions.size > 0 && (
                    <button
                      onClick={deleteSelectedSessions}
                      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm hover:border-red-400"
                    >
                      Xóa đã chọn ({selectedSessions.size})
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => loadStudentSessions(assignmentId)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400"
              >
                🔄 Làm mới
              </button>
            </div>
          </div>

          {/* Thống kê nhanh */}
          {studentSessions.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🔵</span>
                  <span className="text-xs font-medium text-blue-700">Đang làm</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {studentSessions.filter(s => {
                    const hasSubmission = s.submissions && s.submissions.score !== null;
                    return !hasSubmission && s.status === "active";
                  }).length}
                </p>
              </div>
              
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">⚠️</span>
                  <span className="text-xs font-medium text-yellow-700">Đã thoát</span>
                </div>
                <p className="text-2xl font-bold text-yellow-900">
                  {studentSessions.filter(s => {
                    const hasSubmission = s.submissions && s.submissions.score !== null;
                    return !hasSubmission && s.status === "exited";
                  }).length}
                </p>
              </div>
              
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">✅</span>
                  <span className="text-xs font-medium text-green-700">Đã nộp</span>
                </div>
                <p className="text-2xl font-bold text-green-900">
                  {studentSessions.filter(s => {
                    const hasSubmission = s.submissions && s.submissions.score !== null;
                    return hasSubmission || s.status === "submitted";
                  }).length}
                </p>
              </div>
              
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">👥</span>
                  <span className="text-xs font-medium text-slate-700">Tổng cộng</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {studentSessions.length}
                </p>
              </div>
            </div>
          )}

          {studentSessions.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm font-medium text-blue-900 mb-1">Chú thích trạng thái:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-blue-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🔵</span>
                    <span className="font-semibold">Đang làm:</span>
                    <span>Học sinh đang làm bài</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">⚠️</span>
                    <span className="font-semibold">Đã thoát:</span>
                    <span>Chuyển tab/đóng trình duyệt, chưa nộp</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">✅</span>
                    <span className="font-semibold">Đã nộp:</span>
                    <span>Đã nộp bài thành công</span>
                  </div>
                </div>
              </div>
              
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 w-10"></th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Tên học sinh</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Trạng thái</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Điểm</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Số lần thoát</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Thời gian bắt đầu</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Cập nhật cuối</th>
                  </tr>
                </thead>
                <tbody>
                  {studentSessions.map((session) => {
                    // Logic trạng thái ưu tiên:
                    // 1. Có submission (score != null) → "Đã nộp"
                    // 2. status = "submitted" → "Đã nộp" (backup)
                    // 3. status = "exited" và KHÔNG có submission → "Đã thoát"
                    // 4. status = "active" → "Đang làm"
                    
                    const hasSubmission = session.submissions && 
                      session.submissions.score !== null && 
                      session.submissions.score !== undefined;
                    
                    let displayStatus: "active" | "exited" | "submitted";
                    
                    if (hasSubmission || session.status === "submitted") {
                      displayStatus = "submitted";
                    } else if (session.status === "exited") {
                      displayStatus = "exited";
                    } else {
                      displayStatus = "active";
                    }
                    
                    const statusDisplay = {
                      active: { label: "Đang làm", color: "bg-blue-100 text-blue-700", icon: "🔵" },
                      exited: { label: "Đã thoát", color: "bg-yellow-100 text-yellow-700", icon: "⚠️" },
                      submitted: { label: "Đã nộp", color: "bg-green-100 text-green-700", icon: "✅" },
                    }[displayStatus];

                    // Kiểm tra hoạt động gần đây (trong 2 phút)
                    const lastActivityTime = new Date(session.last_activity_at).getTime();
                    const now = Date.now();
                    const isRecentActivity = (now - lastActivityTime) < 2 * 60 * 1000; // 2 phút
                    const minutesSinceActivity = Math.floor((now - lastActivityTime) / (60 * 1000));

                    // Tính progress nếu có draft_answers
                    const draftAnswers = session.draft_answers || {};
                    const answeredCount = Object.keys(draftAnswers).filter(k => draftAnswers[k]).length;
                    const progressText = answeredCount > 0 ? `Làm đến câu ${answeredCount}/${questions.length}` : "";

                    return (
                      <tr key={session.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedSessions.has(session.id)}
                            onChange={() => toggleSessionSelect(session.id)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => loadStudentDetail(session)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                          >
                            {session.student_name}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{statusDisplay.icon}</span>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusDisplay.color}`}>
                              {statusDisplay.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {session.submissions ? (
                            <span className="text-slate-900">{session.submissions.score.toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {session.exit_count > 0 ? (
                              <>
                                <span className="text-lg">🚪</span>
                                <span className={`font-bold ${
                                  session.exit_count >= 3 ? 'text-red-600' : 
                                  session.exit_count >= 1 ? 'text-amber-600' : 
                                  'text-slate-600'
                                }`}>
                                  {session.exit_count}
                                </span>
                                <span className="text-xs text-slate-500">lần</span>
                              </>
                            ) : (
                              <span className="text-slate-400 text-xs">Chưa thoát</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(session.started_at).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isRecentActivity && displayStatus === "active" && (
                              <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Đang hoạt động"></span>
                            )}
                            <div>
                              <div className="text-slate-900 font-medium">
                                {new Date(session.last_activity_at).toLocaleString("vi-VN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit"
                                })}
                              </div>
                              {progressText && displayStatus !== "submitted" && (
                                <div className="text-xs text-blue-600 font-semibold">
                                  📝 {progressText}
                                </div>
                              )}
                              {displayStatus === "active" && !progressText && (
                                <div className="text-xs text-slate-500">
                                  {minutesSinceActivity === 0 ? "Vừa xong" : `${minutesSinceActivity} phút trước`}
                                </div>
                              )}
                              {displayStatus === "exited" && !hasSubmission && (
                                <div className="text-xs text-amber-600 font-medium">
                                  Chưa nộp bài
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Thống kê theo học sinh */}
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">Thống kê theo học sinh</h4>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(
                    studentSessions.reduce((acc, session) => {
                      const name = session.student_name;
                      if (!acc[name]) {
                        acc[name] = { count: 0, submitted: 0, scores: [], totalExits: 0 };
                      }
                      acc[name].count++;
                      acc[name].totalExits += session.exit_count || 0;
                      // Kiểm tra xem có submissions không (dựa vào có điểm hay không)
                      if (session.submissions && session.submissions.score !== null && session.submissions.score !== undefined) {
                        acc[name].submitted++;
                        acc[name].scores.push(session.submissions.score);
                      }
                      return acc;
                    }, {} as Record<string, { count: number; submitted: number; scores: number[]; totalExits: number }>)
                  ).map(([name, stats]) => {
                    const avgScore = stats.scores.length > 0
                      ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length
                      : 0;
                    const maxScore = stats.scores.length > 0 ? Math.max(...stats.scores) : 0;

                    return (
                      <div key={name} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="font-semibold text-slate-900">{name}</p>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          <p>Số lần vào: <span className="font-semibold text-slate-900">{stats.count}</span></p>
                          <p>Đã nộp: <span className="font-semibold text-slate-900">{stats.submitted}</span></p>
                          <p className="flex items-center gap-1">
                            <span>🚪 Tổng số lần thoát:</span>
                            <span className={`font-semibold ${
                              stats.totalExits >= 5 ? 'text-red-600' : 
                              stats.totalExits >= 2 ? 'text-amber-600' : 
                              'text-slate-900'
                            }`}>
                              {stats.totalExits}
                            </span>
                          </p>
                          {stats.scores.length > 0 && (
                            <>
                              <p>Điểm TB: <span className="font-semibold text-slate-900">{avgScore.toFixed(2)}</span></p>
                              <p>Điểm cao nhất: <span className="font-semibold text-slate-900">{maxScore.toFixed(2)}</span></p>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Chưa có học sinh nào vào làm bài</p>
          )}
        </div>

        {showAiForm && (
          <div className="space-y-5 rounded-xl border border-indigo-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">🤖 Tạo câu hỏi bằng AI (OCR)</h3>
              <button
                type="button"
                onClick={() => setShowAiForm(false)}
                className="text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-800">Ảnh / PDF (paste hoặc upload)</label>
                <div
                  onPaste={handleAiPaste}
                  className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-4 text-sm text-slate-700"
                >
                  <p className="font-semibold text-indigo-700">Ctrl + V để dán nhiều ảnh cùng lúc</p>
                  <p className="text-center text-xs text-slate-600">Hỗ trợ nhiều ảnh và PDF, tối đa 8MB mỗi file</p>
                  <div className="flex gap-2">
                    <label className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700">
                      Chọn file
                      <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleAiFileInput} />
                    </label>
                    {aiFiles.length > 0 && (
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400"
                        onClick={removeAllAiFiles}
                      >
                        Xóa file/text (giữ câu hỏi)
                      </button>
                    )}
                  </div>
                </div>
                {aiFiles.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="text-xs font-semibold text-slate-600">Đã chọn ({aiFiles.length})</p>
                    {aiFiles.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1">
                        <span className="truncate text-slate-800">{file.name}</span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                          onClick={() => removeAiFile(idx)}
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-800">Văn bản bổ sung (tùy chọn)</label>
                <textarea
                  value={aiTextInput}
                  onChange={(e) => setAiTextInput(e.target.value)}
                  onPaste={handleAiPaste}
                  rows={8}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder="Dán nội dung sẵn có hoặc mô tả ngắn..."
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateAi}
                    disabled={aiStatus === "running"}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow disabled:opacity-60"
                  >
                    {aiStatus === "running" ? "AI đang xử lý..." : "Tạo câu hỏi bằng AI"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiQuestions([]);
                      setAiPreviewText("");
                      setAiSources([]);
                      setAiStatus("idle");
                      setAiMessage("");
                      setAiError("");
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400"
                  >
                    Xóa kết quả AI
                  </button>
                  <div className="text-xs font-semibold text-slate-600">
                    {aiStatus === "running" && aiMessage}
                    {aiStatus === "done" && aiMessage}
                  </div>
                </div>
                {aiError && <p className="text-sm font-semibold text-red-600">{aiError}</p>}
              </div>
            </div>

            {aiSources.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-800">Nguồn đã quét</p>
                <div className="mt-1 grid gap-2 md:grid-cols-2">
                  {aiSources.map((s, idx) => (
                    <div key={`${s.name}-${s.kind}-${s.chars}-${idx}`} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1">
                      <span className="truncate">{s.name}</span>
                      <span className="text-[11px] text-slate-500">{s.kind} · {s.chars} ký tự</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiPreviewText && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold text-slate-600">Text đã làm sạch (rút gọn)</p>
                <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">{aiPreviewText}</pre>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Danh sách câu hỏi AI ({aiQuestions.length})</h3>
                <p className="text-sm text-slate-600">Chỉnh sửa tự do trước khi lưu xuống CSDL.</p>
              </div>
              <div className="flex gap-2">
                {aiQuestions.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={toggleSelectAllAiQuestions}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400"
                    >
                      {selectedAiQuestionIndices.size === aiQuestions.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    </button>
                    {selectedAiQuestionIndices.size > 0 && (
                      <button
                        type="button"
                        onClick={removeSelectedAiQuestions}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm hover:border-red-400"
                      >
                        Xóa đã chọn ({selectedAiQuestionIndices.size})
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={addEmptyAiQuestion}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-400"
                >
                  + Thêm câu mới
                </button>
              </div>
            </div>

            {aiQuestions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                Chưa có câu hỏi. Hãy dùng AI tạo câu hỏi hoặc thêm thủ công.
              </div>
            ) : (
              <div className="space-y-4">
                {aiQuestions.map((q, idx) => (
                  <div key={`ai-q-${idx}`} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedAiQuestionIndices.has(idx)}
                          onChange={() => toggleAiQuestionSelect(idx)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <div className="text-xs font-semibold text-slate-500">Câu {idx + 1}</div>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                        onClick={() => removeAiQuestion(idx)}
                      >
                        Xóa
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Nội dung</label>
                      <textarea
                        value={q.question}
                        onChange={(e) => updateAiQuestion(idx, { question: e.target.value })}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {(["A", "B", "C", "D"] as Array<"A" | "B" | "C" | "D">).map((key) => (
                        <div key={key} className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700">Đáp án {key}</label>
                          <input
                            value={q.options[key]}
                            onChange={(e) => updateAiOption(idx, key, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-semibold text-slate-700">Đáp án đúng</label>
                      <select
                        value={q.correct_answer}
                        onChange={(e) => updateAiQuestion(idx, { correct_answer: e.target.value as AiQuestion["correct_answer"] })}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                      >
                        {"ABCD".split("").map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600">
                AI chỉ hỗ trợ gợi ý. Admin cần rà soát trước khi lưu xuống CSDL.
              </div>
              <button
                type="button"
                onClick={handleSaveAiQuestions}
                disabled={savingAi || aiQuestions.length === 0}
                className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow disabled:opacity-60"
              >
                {savingAi ? "Đang lưu..." : `Lưu ${aiQuestions.length} câu hỏi vào bài tập`}
              </button>
            </div>
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleAddQuestion} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-slate-700">Loại câu hỏi</label>
              <select
                name="type"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                onChange={(e) => {
                  const form = e.currentTarget.form;
                  const choicesDiv = form?.querySelector("#choices-section");
                  if (choicesDiv) {
                    (choicesDiv as HTMLElement).style.display = e.target.value === "mcq" ? "block" : "none";
                  }
                }}
              >
                <option value="mcq">Trắc nghiệm</option>
                <option value="essay">Tự luận</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                📷 Ảnh câu hỏi (paste ảnh vào ô dưới hoặc tải lên)
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {uploading ? "Đang tải..." : "📁 Chọn ảnh"}
                </button>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => setImagePreview("")}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    ✕ Xóa ảnh
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {imagePreview && (
                <div className="mt-3 rounded-lg border border-slate-200 p-2">
                  <img src={imagePreview} alt="Preview" className="max-h-64 w-auto rounded" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Nội dung câu hỏi (Ctrl+V để paste ảnh)</label>
              <textarea
                name="content"
                rows={3}
                onPaste={handlePaste}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="Nhập câu hỏi hoặc Ctrl+V để paste ảnh..."
              />
            </div>

            <div id="choices-section">
              <label className="block text-sm font-medium text-slate-700">Đáp án (trắc nghiệm)</label>
              <div className="mt-1 space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    type="text"
                    name={`choice${i}`}
                    placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  />
                ))}
              </div>
              <div className="mt-2">
                <label className="block text-sm font-medium text-slate-700">Đáp án đúng</label>
                <select
                  name="answerKey"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
            </div>

            <p className="text-sm text-slate-600">Điểm sẽ được hệ thống chia đều theo tổng điểm bài tập.</p>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              Thêm câu hỏi
            </button>
          </form>
        )}

        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <p className="text-slate-600">Chưa có câu hỏi nào. Thêm câu hỏi đầu tiên!</p>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.has(q.id)}
                      onChange={() => toggleQuestionSelect(q.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Câu {idx + 1} · {q.type === "mcq" ? "Trắc nghiệm" : "Tự luận"} · {Number(q.points ?? 0).toFixed(3)} điểm
                      </p>
                    {q.imageUrl && (
                      <div className="my-3 rounded-lg border border-slate-200 p-2">
                        <img src={q.imageUrl} alt="Câu hỏi" className="max-h-64 w-auto rounded" />
                      </div>
                    )}
                    {q.content && <p className="mt-1 text-base font-medium text-slate-900">{q.content}</p>}
                    {q.choices && (
                      <div className="mt-2 space-y-1 text-sm text-slate-600">
                        {q.choices.map((c, ci) => (
                          <div key={ci}>
                            <span className="font-semibold">{String.fromCharCode(65 + ci)}.</span> {c}
                            {q.answerKey === String.fromCharCode(65 + ci) && (
                              <span className="ml-2 text-emerald-600">✓</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-xs">
                    <button
                      className="rounded border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:border-slate-400"
                      onClick={() => startEditQuestion(q)}
                      type="button"
                    >
                      Sửa
                    </button>
                    <button
                      className="rounded border border-red-200 px-3 py-1 font-semibold text-red-600 hover:border-red-400"
                      onClick={() => handleDeleteQuestion(q.id)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
                {editingQuestionId === q.id && (
                  <form onSubmit={submitEditQuestion} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Loại</label>
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                          value={editQuestionForm.type}
                          onChange={(e) => setEditQuestionForm((p) => ({ ...p, type: e.target.value as "mcq" | "essay" }))}
                        >
                          <option value="mcq">Trắc nghiệm</option>
                          <option value="essay">Tự luận</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Ảnh (URL)</label>
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                          value={editQuestionForm.imageUrl}
                          onChange={(e) => setEditQuestionForm((p) => ({ ...p, imageUrl: e.target.value }))}
                          placeholder="Dán URL ảnh hoặc để trống"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Nội dung</label>
                      <textarea
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                        rows={3}
                        value={editQuestionForm.content}
                        onChange={(e) => setEditQuestionForm((p) => ({ ...p, content: e.target.value }))}
                      />
                    </div>

                    {editQuestionForm.type === "mcq" && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {[0, 1, 2, 3].map((i) => (
                          <input
                            key={i}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                            value={editQuestionForm.choices[i] || ""}
                            onChange={(e) => {
                              const next = [...editQuestionForm.choices];
                              next[i] = e.target.value;
                              setEditQuestionForm((p) => ({ ...p, choices: next }));
                            }}
                            placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                          />
                        ))}
                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                          value={editQuestionForm.answerKey}
                          onChange={(e) => setEditQuestionForm((p) => ({ ...p, answerKey: e.target.value }))}
                        >
                          {"ABCD".split("").map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingQuestionId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                      >
                        Lưu câu hỏi
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal chi tiết học sinh */}
      {showStudentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowStudentDetail(false)}>
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Chi tiết bài làm - {studentDetail?.studentName}
                </h3>
                {studentDetail && (
                  <div className="mt-1 flex items-center gap-3 text-sm">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      studentDetail.status === "submitted" ? "bg-green-100 text-green-700" :
                      studentDetail.status === "exited" ? "bg-yellow-100 text-yellow-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {studentDetail.status === "submitted" ? "✅ Đã nộp" :
                       studentDetail.status === "exited" ? "⚠️ Đã thoát" :
                       "🔵 Đang làm"}
                    </span>
                    {studentDetail.score !== undefined && (
                      <span className="font-semibold text-slate-900">
                        Điểm: {studentDetail.score.toFixed(2)}
                      </span>
                    )}
                    <span className="text-slate-600">
                      Đã làm: {studentDetail.answeredCount}/{studentDetail.totalQuestions} câu
                    </span>
                    {studentDetail.status === "submitted" && (
                      <span className="text-slate-600">
                        Đúng: {studentDetail.correctCount}/{studentDetail.totalQuestions} câu
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowStudentDetail(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center p-12">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
                  <p className="mt-3 text-sm text-slate-600">Đang tải chi tiết...</p>
                </div>
              </div>
            ) : studentDetail ? (
              <div className="p-6">
                <div className="space-y-3">
                  {studentDetail.questions.map((q) => {
                    const hasAnswer = q.studentAnswer !== undefined && q.studentAnswer !== null && q.studentAnswer !== "";
                    const isSubmitted = studentDetail.status === "submitted";
                    
                    // Xác định màu border và background
                    let borderColor = "border-slate-200";
                    let bgColor = "bg-white";
                    
                    if (isSubmitted && hasAnswer) {
                      if (q.isCorrect) {
                        borderColor = "border-green-300 bg-green-50";
                        bgColor = "bg-green-50";
                      } else {
                        borderColor = "border-red-300 bg-red-50";
                        bgColor = "bg-red-50";
                      }
                    } else if (hasAnswer) {
                      borderColor = "border-blue-300";
                      bgColor = "bg-blue-50";
                    }

                    return (
                      <div key={q.questionId} className={`rounded-lg border p-4 ${borderColor} ${bgColor}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-md bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700">
                              Câu {q.order}
                            </span>
                            <span className="text-xs text-slate-600">
                              {q.type === "mcq" ? "Trắc nghiệm" : "Tự luận"} · {q.points.toFixed(2)} điểm
                            </span>
                          </div>
                          <div>
                            {isSubmitted && hasAnswer && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                q.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              }`}>
                                {q.isCorrect ? "✓ Đúng" : "✗ Sai"}
                              </span>
                            )}
                            {!isSubmitted && hasAnswer && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                                ✓ Đã trả lời
                              </span>
                            )}
                          </div>
                        </div>

                        {q.imageUrl && (
                          <div className="mb-3 rounded-lg border border-slate-200 p-2">
                            <img src={q.imageUrl} alt="Câu hỏi" className="max-h-48 w-auto rounded" />
                          </div>
                        )}

                        {q.content && (
                          <p className="text-base font-medium text-slate-900 mb-3">{q.content}</p>
                        )}

                        {q.type === "mcq" && (
                          <div className="space-y-2">
                            {(q.choices && q.choices.length > 0 ? q.choices : ['', '', '', '']).map((choice, idx) => {
                              const choiceLetter = String.fromCharCode(65 + idx);
                              
                              // Chuẩn hóa để so sánh - xử lý cả null/undefined
                              const studentChoice = q.studentAnswer ? String(q.studentAnswer).trim().toUpperCase() : "";
                              const correctChoiceRaw = q.correctAnswer ? String(q.correctAnswer).trim().toUpperCase() : "";
                              const correctChoice = correctChoiceRaw || (q.isCorrect ? studentChoice : "");

                              const isCorrectAnswer = correctChoice && choiceLetter === correctChoice;
                              const isStudentChoice = studentChoice && choiceLetter === studentChoice;

                              // LUÔN ưu tiên đáp án đúng = xanh
                              const borderClass = isCorrectAnswer ? "border-emerald-600" : isStudentChoice ? "border-red-600" : "border-slate-200";
                              const bgClass = isCorrectAnswer ? "bg-emerald-50" : isStudentChoice ? "bg-red-50" : "bg-white";
                              const fontClass = (isCorrectAnswer || isStudentChoice) ? "font-medium" : "";

                              return (
                                <div 
                                  key={`${q.questionId}-${choiceLetter}`} 
                                  className={`rounded-lg border px-3 py-2 text-sm ${borderClass} ${bgClass} ${fontClass}`}
                                >
                                  <span className="font-semibold">{choiceLetter}.</span> {choice && <span>{choice}</span>}
                                  {isCorrectAnswer && (
                                    <span className="ml-2 text-emerald-700 font-semibold">← Đáp án đúng</span>
                                  )}
                                  {isStudentChoice && !isCorrectAnswer && (
                                    <span className="ml-2 text-red-700 font-semibold">← Học sinh chọn</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.type === "essay" && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-slate-700 mb-1">Câu trả lời của học sinh:</p>
                            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                              {hasAnswer ? q.studentAnswer : <em className="text-slate-400">Chưa trả lời</em>}
                            </div>
                          </div>
                        )}

                        {!hasAnswer && (
                          <p className="text-sm text-slate-400 italic mt-2">Chưa trả lời câu này</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-slate-600">Không có dữ liệu</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
