export type AssignmentStatus = "not_started" | "completed" | "overdue";

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  grade: string;
  dueAt: string;
  durationMinutes?: number;
  totalScore: number;
  isHidden?: boolean;
  status: AssignmentStatus;
  latestSubmission?: SubmissionSummary | null;
}

export interface Question {
  id: string;
  assignmentId: string;
  order: number;
  type: "mcq" | "essay";
  content: string;
  choices?: string[];
  answerKey?: string;
  points: number;
  imageUrl?: string;
}

export interface SubmissionSummary {
  id: string;
  assignmentId: string;
  submittedAt: string;
  score: number;
  status: "pending" | "scored";
}
