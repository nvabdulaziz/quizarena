import { z } from 'zod';
import { config } from './config.js';

export const answerSchema = z.object({
  text: z.string().trim().min(1).max(120),
  isCorrect: z.boolean(),
});

export const questionSchema = z
  .object({
    text: z.string().trim().min(1).max(300),
    imageUrl: z.string().max(500).nullable().optional(),
    timeLimit: z.number().int().refine((v) => config.allowedTimeLimits.includes(v), 'INVALID_TIME_LIMIT'),
    points: z.number().int().min(0).max(10000),
    answers: z.array(answerSchema).min(2).max(6),
  })
  .refine((q) => q.answers.some((a) => a.isCorrect), { message: 'NO_CORRECT_ANSWER', path: ['answers'] });

export const quizSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().default(''),
  published: z.boolean().optional(),
  questions: z.array(questionSchema).max(500),
});

/** Questions must be complete (>=1 question) to start a live game. */
export function assertPlayable(quiz) {
  if (!quiz.questions || quiz.questions.length === 0) return 'QUIZ_EMPTY';
  return null;
}

/** Lenient schema for editor autosave: incomplete questions are allowed while the teacher is typing. */
export const draftQuestionSchema = z.object({
  text: z.string().max(300),
  imageUrl: z.string().max(500).nullable().optional(),
  timeLimit: z.number().int().refine((v) => config.allowedTimeLimits.includes(v), 'INVALID_TIME_LIMIT'),
  points: z.number().int().min(0).max(10000),
  answers: z.array(z.object({ text: z.string().max(120), isCorrect: z.boolean() })).max(6),
});
export const draftQuizSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().default(''),
  published: z.boolean().optional(),
  questions: z.array(draftQuestionSchema).max(500),
});

/** A question can be played only when it has text, >=2 non-empty answers and >=1 correct one. */
export function isQuestionComplete(q) {
  const filled = q.answers.filter((a) => a.text.trim());
  return !!q.text.trim() && filled.length >= 2 && filled.some((a) => a.isCorrect);
}
