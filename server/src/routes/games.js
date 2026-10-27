import { Router } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../db.js';
import { requireTeacher } from '../middleware/auth.js';

const router = Router();

router.get('/', requireTeacher, async (req, res) => {
  const games = await prisma.gameSession.findMany({
    where: { teacherId: req.teacherId, status: { in: ['FINISHED', 'ABORTED'] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { quiz: { select: { title: true } }, _count: { select: { players: true } } },
  });
  res.json({
    games: games.map((g) => ({
      id: g.id,
      pin: g.pin,
      quizTitle: g.quiz.title,
      status: g.status,
      startedAt: g.startedAt,
      finishedAt: g.finishedAt,
      createdAt: g.createdAt,
      playerCount: g._count.players,
    })),
  });
});

async function loadResults(gameId, teacherId) {
  const game = await prisma.gameSession.findFirst({
    where: { id: gameId, teacherId },
    include: {
      quiz: { select: { title: true } },
      results: { orderBy: { finalRank: 'asc' }, include: { player: { select: { nickname: true } } } },
    },
  });
  return game;
}

router.get('/:id/results', requireTeacher, async (req, res) => {
  const game = await loadResults(req.params.id, req.teacherId);
  if (!game) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({
    game: { id: game.id, pin: game.pin, quizTitle: game.quiz.title, status: game.status, finishedAt: game.finishedAt },
    results: game.results.map((r) => ({
      rank: r.finalRank,
      nickname: r.player.nickname,
      score: r.finalScore,
      correct: r.correctCount,
      answered: r.totalAnswered,
    })),
  });
});

const csvCell = (v) => {
  let s = String(v ?? '');
  // Neutralise spreadsheet formula injection from student nicknames.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

router.get('/:id/export.:format', requireTeacher, async (req, res) => {
  const game = await loadResults(req.params.id, req.teacherId);
  if (!game) return res.status(404).json({ error: 'NOT_FOUND' });
  const rows = game.results.map((r) => [r.finalRank, r.player.nickname, r.finalScore, r.correctCount, r.totalAnswered]);
  const header = ['Rank', 'Nickname', 'Score', 'Correct', 'Answered'];
  const base = `results-${game.pin}`;

  if (req.params.format === 'csv') {
    const body = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
    return res.send('﻿' + body);
  }
  if (req.params.format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Results');
    ws.addRow(header).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.columns = [{ width: 8 }, { width: 28 }, { width: 12 }, { width: 10 }, { width: 10 }];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  }
  res.status(400).json({ error: 'BAD_FORMAT' });
});

router.delete('/:id', requireTeacher, async (req, res) => {
  const { count } = await prisma.gameSession.deleteMany({ where: { id: req.params.id, teacherId: req.teacherId } });
  if (!count) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ok: true });
});

export default router;
