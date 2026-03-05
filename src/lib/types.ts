export type AssignmentStatus = "not_started" | "completed" | "overdue";

export interface PointRange {
  fromQuestion: number;
  toQuestion: number;
  totalPoints: number;
}

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  grade: string;
  dueAt: string;
  durationMinutes?: number;
  totalScore: number;
  isHidden?: boolean;
  hideScore?: boolean;
  pointRanges?: PointRange[];
  status: AssignmentStatus;
  latestSubmission?: SubmissionSummary | null;
}

export interface SubQuestion {
  id: string;
  content: string;
  answerKey: "true" | "false" | string;
  order: number;
}

export interface Question {
  id: string;
  assignmentId: string;
  order: number;
  type: "mcq" | "essay" | "section" | "short_answer" | "true_false";
  content: string;
  choices?: string[];
  answerKey?: string;
  points: number;
  imageUrl?: string;
  subQuestions?: SubQuestion[];
}

export interface SubmissionSummary {
  id: string;
  assignmentId: string;
  submittedAt: string;
  score: number;
  status: "pending" | "scored";
}
