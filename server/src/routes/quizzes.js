import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { requireTeacher } from '../middleware/auth.js';
import { quizSchema, draftQuizSchema } from '../quizValidation.js';
import { buildTemplate, parseImport } from '../importer.js';

const router = Router();

fs.mkdirSync(config.uploadDir, { recursive: true });

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const imgUpload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype)),
});

// Template download is public-safe but kept behind auth for consistency with the dashboard.
router.get('/template.xlsx', requireTeacher, async (_req, res) => {
  const buf = await buildTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="quiz-template.xlsx"');
  res.send(buf);
});

router.post('/import/parse', requireTeacher, memUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'NO_FILE' });
  try {
    const result = await parseImport(req.file.buffer, req.file.originalname);
    res.json(result);
  } catch {
    res.status(400).json({ questions: [], errors: [{ row: 0, code: 'UNREADABLE_FILE' }] });
  }
});

router.post('/upload-image', requireTeacher, imgUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'INVALID_IMAGE' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

const include = { questions: { orderBy: { position: 'asc' }, include: { answers: { orderBy: { position: 'asc' } } } } };

const toDto = (q) => ({
  id: q.id,
  title: q.title,
  description: q.description,
  published: q.published,
  updatedAt: q.updatedAt,
  createdAt: q.createdAt,
  questions: q.questions.map((qq) => ({
    id: qq.id,
    text: qq.text,
    imageUrl: qq.imageUrl,
    timeLimit: qq.timeLimit,
    points: qq.points,
    answers: qq.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })),
  })),
});

const questionCreates = (questions) =>
  questions.map((q, i) => ({
    position: i,
    text: q.text,
    imageUrl: q.imageUrl || null,
    timeLimit: q.timeLimit,
    points: q.points,
    answers: { create: q.answers.map((a, j) => ({ position: j, text: a.text, isCorrect: a.isCorrect })) },
  }));

router.get('/', requireTeacher, async (req, res) => {
  const quizzes = await prisma.quiz.findMany({
    where: { teacherId: req.teacherId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { questions: true, games: true } } },
  });
  res.json({
    quizzes: quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      published: q.published,
      updatedAt: q.updatedAt,
      questionCount: q._count.questions,
      gameCount: q._count.games,
    })),
  });
});

router.post('/', requireTeacher, async (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 120) || 'Untitled quiz';
  const quiz = await prisma.quiz.create({ data: { teacherId: req.teacherId, title }, include });
  res.status(201).json({ quiz: toDto(quiz) });
});

router.get('/:id', requireTeacher, async (req, res) => {
  const quiz = await prisma.quiz.findFirst({ where: { id: req.params.id, teacherId: req.teacherId }, include });
  if (!quiz) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ quiz: toDto(quiz) });
});

// Full replace save (used by the editor's autosave). Draft saves may contain incomplete questions
// only if `draft=1`; otherwise every question is strictly validated.
router.put('/:id', requireTeacher, async (req, res) => {
  const existing = await prisma.quiz.findFirst({ where: { id: req.params.id, teacherId: req.teacherId } });
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });
  const parsed = (req.query.draft ? draftQuizSchema : quizSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION', details: parsed.error.flatten() });
  const { title, description, published, questions } = parsed.data;

  const quiz = await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { quizId: existing.id } });
    return tx.quiz.update({
      where: { id: existing.id },
      data: { title, description, published: published ?? existing.published, questions: { create: questionCreates(questions) } },
      include,
    });
  });
  res.json({ quiz: toDto(quiz) });
});

router.post('/:id/duplicate', requireTeacher, async (req, res) => {
  const src = await prisma.quiz.findFirst({ where: { id: req.params.id, teacherId: req.teacherId }, include });
  if (!src) return res.status(404).json({ error: 'NOT_FOUND' });
  const copy = await prisma.quiz.create({
    data: {
      teacherId: req.teacherId,
      title: `${src.title} (copy)`.slice(0, 120),
      description: src.description,
      questions: {
        create: questionCreates(
          src.questions.map((q) => ({ ...q, answers: q.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect })) })),
        ),
      },
    },
    include,
  });
  res.status(201).json({ quiz: toDto(copy) });
});

router.delete('/:id', requireTeacher, async (req, res) => {
  const { count } = await prisma.quiz.deleteMany({ where: { id: req.params.id, teacherId: req.teacherId } });
  if (!count) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ok: true });
});

export default router;
