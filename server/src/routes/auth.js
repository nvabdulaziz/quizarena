import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { signToken, requireTeacher } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(100),
});

router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION', details: parsed.error.flatten() });
  const { name, email, password } = parsed.data;
  const exists = await prisma.teacher.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'EMAIL_TAKEN' });
  const teacher = await prisma.teacher.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 11) } });
  res.status(201).json({ token: signToken(teacher), teacher: { id: teacher.id, name: teacher.name, email: teacher.email } });
});

router.post('/login', authLimiter, async (req, res) => {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION' });
  const teacher = await prisma.teacher.findUnique({ where: { email: parsed.data.email } });
  const ok = teacher && (await bcrypt.compare(parsed.data.password, teacher.passwordHash));
  if (!ok) return res.status(401).json({ error: 'BAD_CREDENTIALS' });
  res.json({ token: signToken(teacher), teacher: { id: teacher.id, name: teacher.name, email: teacher.email } });
});

router.get('/me', requireTeacher, async (req, res) => {
  const teacher = await prisma.teacher.findUnique({ where: { id: req.teacherId } });
  if (!teacher) return res.status(401).json({ error: 'AUTH_INVALID' });
  res.json({ teacher: { id: teacher.id, name: teacher.name, email: teacher.email } });
});

export default router;
