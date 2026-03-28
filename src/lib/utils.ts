import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Question } from "./types";

/**
 * Merges standard Tailwind classes with conditional classes,
 * ensuring no conflicts (e.g., px-4 py-2 + p-4 -> p-4).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Filter out non-question items (sections, notes)
 * Sections are informational content, not actual questions to answer
 */
export function getActualQuestions(questions: Question[]): Question[] {
  return questions.filter(q => q.type !== 'section');
}

/**
 * Count only actual questions (excludes sections/notes)
 */
export function countActualQuestions(questions: Question[]): number {
  return questions.filter(q => q.type !== 'section').length;
}

/**
 * Check if a question is a note/section (not an answerable question)
 */
export function isNoteQuestion(question: Question): boolean {
  return question.type === 'section';
}
