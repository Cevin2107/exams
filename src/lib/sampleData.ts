import { Assignment, Question } from "./types";

export const sampleAssignments: Assignment[] = [
  {
    id: "math-1",
    title: "Toán - Hàm số bậc nhất",
    subject: "Toán",
    grade: "Lớp 9",
    dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 30,
    totalScore: 10,
    status: "not_started",
  },
  {
    id: "phys-1",
    title: "Vật lý - Điện trở",
    subject: "Vật lý",
    grade: "Lớp 9",
    dueAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 25,
    totalScore: 10,
    status: "overdue",
  },
];

export const sampleQuestions: Question[] = [
  {
    id: "q1",
    assignmentId: "math-1",
    order: 1,
    type: "mcq",
    content: "Giá trị của f(2) = 3x + 1 là?",
    choices: ["7", "5", "9", "11"],
    answerKey: "A",
    points: 1,
  },
  {
    id: "q2",
    assignmentId: "math-1",
    order: 2,
    type: "mcq",
    content: "Nghiệm của phương trình 2x + 4 = 0 là?",
    choices: ["-2", "2", "-1", "1"],
    answerKey: "A",
    points: 1,
  },
];
