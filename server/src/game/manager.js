import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { isQuestionComplete } from '../quizValidation.js';
import { computePoints, computeStreakBonus, isAnswerCorrect, rankPlayers } from './scoring.js';

/**
 * In-memory, server-authoritative game state. Each game is an isolated object keyed by PIN,
 * so concurrent sessions never share state. Everything that matters is also persisted to PostgreSQL.
 */
export const games = new Map(); // pin -> game
const byId = new Map(); // gameId -> game

const COUNTDOWN_MS = 3000;
const LOBBY_GRACE_MS = 30_000;
const STALE_MS = 4 * 60 * 60 * 1000;

let io = null;
export const attachIo = (server) => {
  io = server;
};

const log = (...a) => console.error('[game]', ...a);
const safe = (p) => p.catch((e) => log(e.message));

export function generatePin() {
  for (let i = 0; i < 50; i++) {
    const pin = String(crypto.randomInt(100000, 1000000));
    if (!games.has(pin)) return pin;
  }
  throw new Error('PIN_EXHAUSTED');
}

export function sanitizeNickname(raw) {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length >= 1 && s.length <= 20 ? s : null;
}

export async function createGame({ teacherId, quizId, streakBonus = 100 }) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, teacherId },
    include: { questions: { orderBy: { position: 'asc' }, include: { answers: { orderBy: { position: 'asc' } } } } },
  });
  if (!quiz) return { error: 'NOT_FOUND' };
  if (quiz.questions.length === 0) return { error: 'QUIZ_EMPTY' };
  if (!quiz.questions.every(isQuestionComplete)) return { error: 'QUIZ_INCOMPLETE' };

  const pin = generatePin();
  const row = await prisma.gameSession.create({
    data: { pin, quizId: quiz.id, teacherId, streakBonus: Math.max(0, Math.min(500, Number(streakBonus) || 0)) },
  });
  const game = {
    id: row.id,
    pin,
    teacherId,
    title: quiz.title,
    streakBonus: row.streakBonus,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      imageUrl: q.imageUrl,
      timeLimit: q.timeLimit,
      points: q.points,
      answers: q.answers.filter((a) => a.text.trim()).map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })),
    })),
    phase: 'lobby', // lobby | countdown | question | results | leaderboard | finished
    paused: false,
    pauseRemainingMs: 0,
    hostSocketId: null,
    players: new Map(),
    nicknames: new Set(),
    qIndex: -1,
    qStart: 0,
    qEnd: 0,
    answers: new Map(),
    timer: null,
    ranking: [],
    lastActivity: Date.now(),
  };
  games.set(pin, game);
  byId.set(game.id, game);
  return { game };
}

export const getByPin = (pin) => games.get(String(pin));
export const getById = (id) => byId.get(id);

/* ---------- views ---------- */

const rankOf = (game) =>
  rankPlayers([...game.players.values()].map((p) => ({ id: p.id, nickname: p.nickname, score: p.score, streak: p.streak, joinedAt: p.joinedAt, prevRank: p.prevRank })));

function entry(p) {
  return { id: p.id, nickname: p.nickname, score: p.score, streak: p.streak, rank: p.rank, movement: p.prevRank ? p.prevRank - p.rank : 0 };
}

const connectedCount = (game) => [...game.players.values()].filter((p) => p.connected).length;

function playerYou(game, p) {
  if (!p) return null;
  const last = p.last || {};
  return {
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    streak: p.streak,
    rank: p.rank || null,
    movement: p.prevRank && p.rank ? p.prevRank - p.rank : 0,
    answered: !!last.answered,
    isCorrect: !!last.isCorrect,
    points: last.points || 0,
    streakBonus: last.streakBonus || 0,
  };
}

export function buildState(game, player /* undefined => host */) {
  const q = game.questions[game.qIndex];
  const base = {
    pin: game.pin,
    title: game.title,
    phase: game.phase,
    paused: game.paused,
    serverNow: Date.now(),
    playerCount: connectedCount(game),
    totalQuestions: game.questions.length,
    index: game.qIndex,
  };
  switch (game.phase) {
    case 'lobby':
      return {
        ...base,
        players: [...game.players.values()].filter((p) => p.connected).map((p) => ({ id: p.id, nickname: p.nickname })),
        you: playerYou(game, player),
      };
    case 'countdown':
      return { ...base, endsAt: game.qEnd, you: playerYou(game, player) };
    case 'question': {
      const mine = player ? game.answers.get(player.id) : null;
      return {
        ...base,
        question: {
          text: q.text,
          imageUrl: q.imageUrl,
          timeLimit: q.timeLimit,
          multi: q.answers.filter((a) => a.isCorrect).length > 1,
          answers: q.answers.map((a) => ({ id: a.id, text: a.text })), // never includes isCorrect
        },
        endsAt: game.paused ? null : game.qEnd,
        remainingMs: game.paused ? game.pauseRemainingMs : Math.max(0, game.qEnd - Date.now()),
        answeredCount: game.answers.size,
        answered: !!mine,
        myAnswerIds: mine ? mine.answerIds : [],
        you: playerYou(game, player),
      };
    }
    case 'results':
      return {
        ...base,
        question: { text: q.text, imageUrl: q.imageUrl, answers: q.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })) },
        counts: game.lastCounts,
        answeredCount: game.answers.size,
        you: playerYou(game, player),
      };
    case 'leaderboard':
      return { ...base, top: game.ranking.slice(0, 5).map(entry), isLast: game.qIndex >= game.questions.length - 1, you: playerYou(game, player) };
    case 'finished':
      return { ...base, podium: game.ranking.slice(0, 3).map(entry), ranking: game.ranking.map(entry), you: playerYou(game, player) };
    default:
      return base;
  }
}

export function broadcast(game) {
  if (!io) return;
  if (game.hostSocketId) io.to(game.hostSocketId).emit('game:state', buildState(game));
  for (const p of game.players.values()) {
    if (p.connected && p.socketId) io.to(p.socketId).emit('game:state', buildState(game, p));
  }
}

const emitHostOnly = (game, event, payload) => {
  if (io && game.hostSocketId) io.to(game.hostSocketId).emit(event, payload);
};

/* ---------- players ---------- */

export async function joinPlayer(game, socketId, rawNickname) {
  if (game.phase !== 'lobby') return { error: 'GAME_STARTED' };
  if (game.players.size >= config.maxPlayers) return { error: 'ROOM_FULL' };
  const nickname = sanitizeNickname(rawNickname);
  if (!nickname) return { error: 'INVALID_NICKNAME' };
  const key = nickname.toLowerCase();
  if (game.nicknames.has(key)) return { error: 'NICKNAME_TAKEN' };
  game.nicknames.add(key); // reserve synchronously: prevents races between concurrent joins

  const token = crypto.randomBytes(24).toString('hex');
  try {
    const row = await prisma.player.create({ data: { gameId: game.id, nickname, reconnectToken: token } });
    const player = {
      id: row.id,
      nickname,
      token,
      socketId,
      connected: true,
      score: 0,
      streak: 0,
      rank: 0,
      prevRank: 0,
      joinedAt: row.joinedAt.getTime(),
      correct: 0,
      answered: 0,
      last: null,
      graceTimer: null,
    };
    game.players.set(player.id, player);
    game.lastActivity = Date.now();
    return { player, token };
  } catch (e) {
    game.nicknames.delete(key);
    log('join failed', e.message);
    return { error: 'SERVER_ERROR' };
  }
}

export function rejoinPlayer(game, token, socketId) {
  const player = [...game.players.values()].find((p) => p.token === token);
  if (!player) return { error: 'SESSION_NOT_FOUND' };
  if (player.graceTimer) clearTimeout(player.graceTimer);
  player.graceTimer = null;
  player.socketId = socketId;
  player.connected = true;
  return { player };
}

export function playerDisconnected(game, player) {
  player.connected = false;
  player.socketId = null;
  if (game.phase === 'lobby') {
    // Drop lobby ghosts after a grace period (page refreshes can rejoin with their token).
    player.graceTimer = setTimeout(() => {
      if (!player.connected && game.phase === 'lobby') removePlayer(game, player.id);
    }, LOBBY_GRACE_MS);
  }
  broadcastCounts(game);
}

export function removePlayer(game, playerId) {
  const p = game.players.get(playerId);
  if (!p) return;
  game.players.delete(playerId);
  game.nicknames.delete(p.nickname.toLowerCase());
  safe(prisma.player.deleteMany({ where: { id: playerId } }));
  if (io && p.socketId) io.to(p.socketId).emit('player:kicked');
  broadcast(game);
}

function broadcastCounts(game) {
  if (game.phase === 'lobby') return broadcast(game);
  emitHostOnly(game, 'game:counts', { playerCount: connectedCount(game), answeredCount: game.answers.size });
}

/* ---------- game flow ---------- */

function clearTimer(game) {
  if (game.timer) clearTimeout(game.timer);
  game.timer = null;
}

export function startGame(game) {
  if (game.phase !== 'lobby') return { error: 'BAD_STATE' };
  if (connectedCount(game) === 0) return { error: 'NO_PLAYERS' };
  safe(prisma.gameSession.update({ where: { id: game.id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } }));
  nextQuestion(game);
  return { ok: true };
}

function nextQuestion(game) {
  clearTimer(game);
  game.qIndex += 1;
  game.answers = new Map();
  game.paused = false;
  game.phase = 'countdown';
  game.qEnd = Date.now() + COUNTDOWN_MS;
  for (const p of game.players.values()) p.last = null;
  broadcast(game);
  game.timer = setTimeout(() => openQuestion(game), COUNTDOWN_MS);
}

function openQuestion(game) {
  const q = game.questions[game.qIndex];
  game.phase = 'question';
  game.qStart = Date.now();
  game.qEnd = game.qStart + q.timeLimit * 1000;
  broadcast(game);
  game.timer = setTimeout(() => closeQuestion(game), q.timeLimit * 1000);
}

export function submitAnswer(game, player, rawIds) {
  if (game.phase !== 'question' || game.paused) return { error: 'NOT_ACCEPTING' };
  if (game.answers.has(player.id)) return { error: 'ALREADY_ANSWERED' };
  const q = game.questions[game.qIndex];
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > q.answers.length) return { error: 'INVALID_ANSWER' };
  const valid = new Set(q.answers.map((a) => a.id));
  const ids = [...new Set(rawIds.map(String))];
  if (!ids.every((id) => valid.has(id))) return { error: 'INVALID_ANSWER' };
  const isMulti = q.answers.filter((a) => a.isCorrect).length > 1;
  if (!isMulti && ids.length !== 1) return { error: 'INVALID_ANSWER' };
  if (Date.now() > game.qEnd) return { error: 'TOO_LATE' };

  game.answers.set(player.id, { answerIds: ids, timeMs: Date.now() - game.qStart });
  game.lastActivity = Date.now();
  emitHostOnly(game, 'game:counts', { playerCount: connectedCount(game), answeredCount: game.answers.size });

  const allIn = [...game.players.values()].filter((p) => p.connected).every((p) => game.answers.has(p.id));
  if (allIn) closeQuestion(game);
  return { ok: true };
}

function closeQuestion(game) {
  if (game.phase !== 'question') return;
  clearTimer(game);
  const q = game.questions[game.qIndex];
  const correctIds = q.answers.filter((a) => a.isCorrect).map((a) => a.id);
  const timeLimitMs = q.timeLimit * 1000;
  const counts = Object.fromEntries(q.answers.map((a) => [a.id, 0]));
  const answerRows = [];

  for (const p of game.players.values()) {
    p.prevRank = p.rank || 0;
    const a = game.answers.get(p.id);
    let points = 0;
    let bonus = 0;
    let correct = false;
    if (a) {
      for (const id of a.answerIds) counts[id] += 1;
      correct = isAnswerCorrect(a.answerIds, correctIds);
      p.answered += 1;
      if (correct) {
        p.streak += 1;
        p.correct += 1;
        points = computePoints({ basePoints: q.points, timeLimitMs, elapsedMs: a.timeMs });
        bonus = computeStreakBonus({ newStreak: p.streak, streakBonus: game.streakBonus });
        p.score += points + bonus;
      } else {
        p.streak = 0;
      }
      answerRows.push({
        playerId: p.id, questionId: q.id, gameId: game.id, answerIds: a.answerIds,
        isCorrect: correct, timeMs: a.timeMs, pointsEarned: points + bonus,
      });
    } else {
      p.streak = 0;
    }
    p.last = { answered: !!a, isCorrect: correct, points: points + bonus, streakBonus: bonus };
  }

  const ranked = rankOf(game);
  const rankMap = new Map(ranked.map((r) => [r.id, r.rank]));
  for (const p of game.players.values()) p.rank = rankMap.get(p.id);
  // Keep movement meaningful on the first question: no previous rank means no movement.
  for (const p of game.players.values()) if (!p.prevRank) p.prevRank = p.rank;
  game.ranking = ranked.map((r) => game.players.get(r.id)).map((p) => ({ ...p }));
  game.lastCounts = counts;
  game.phase = 'results';
  broadcast(game);

  const idx = game.qIndex;
  const scoreRows = [...game.players.values()].map((p) => ({
    playerId: p.id, questionIdx: idx, points: p.last.points, total: p.score, streak: p.streak, rank: p.rank,
  }));
  safe(prisma.$transaction([
    prisma.playerAnswer.createMany({ data: answerRows, skipDuplicates: true }),
    prisma.score.createMany({ data: scoreRows, skipDuplicates: true }),
  ]));
}

export function hostAdvance(game) {
  if (game.paused) return { error: 'PAUSED' };
  if (game.phase === 'question') {
    closeQuestion(game); // "skip" the remaining time
    return { ok: true };
  }
  if (game.phase === 'results') {
    game.phase = 'leaderboard';
    broadcast(game);
    return { ok: true };
  }
  if (game.phase === 'leaderboard') {
    if (game.qIndex >= game.questions.length - 1) return finishGame(game);
    nextQuestion(game);
    return { ok: true };
  }
  return { error: 'BAD_STATE' };
}

export function pauseGame(game) {
  if (game.phase !== 'question' || game.paused) return { error: 'BAD_STATE' };
  clearTimer(game);
  game.paused = true;
  game.pauseRemainingMs = Math.max(0, game.qEnd - Date.now());
  game.pausedAt = Date.now();
  broadcast(game);
  return { ok: true };
}

export function resumeGame(game) {
  if (game.phase !== 'question' || !game.paused) return { error: 'BAD_STATE' };
  const pausedFor = Date.now() - game.pausedAt;
  game.qStart += pausedFor; // paused time must not count against anyone's answer speed
  game.qEnd = Date.now() + game.pauseRemainingMs;
  game.paused = false;
  broadcast(game);
  game.timer = setTimeout(() => closeQuestion(game), game.pauseRemainingMs);
  return { ok: true };
}

export function finishGame(game, { aborted = false } = {}) {
  clearTimer(game);
  game.paused = false;
  const ranked = rankOf(game);
  const rankMap = new Map(ranked.map((r) => [r.id, r.rank]));
  for (const p of game.players.values()) p.rank = rankMap.get(p.id);
  game.ranking = ranked.map((r) => ({ ...game.players.get(r.id) }));
  game.phase = 'finished';
  broadcast(game);

  safe(prisma.$transaction([
    prisma.gameResult.createMany({
      data: game.ranking.map((p) => ({
        gameId: game.id, playerId: p.id, finalRank: p.rank, finalScore: p.score, correctCount: p.correct, totalAnswered: p.answered,
      })),
      skipDuplicates: true,
    }),
    prisma.gameSession.update({ where: { id: game.id }, data: { status: aborted ? 'ABORTED' : 'FINISHED', finishedAt: new Date() } }),
  ]));
  setTimeout(() => destroyGame(game), 30 * 60 * 1000).unref?.();
  return { ok: true };
}

export function destroyGame(game) {
  clearTimer(game);
  for (const p of game.players.values()) if (p.graceTimer) clearTimeout(p.graceTimer);
  games.delete(game.pin);
  byId.delete(game.id);
}

// Abort games nobody has touched for hours (e.g. a teacher closed the laptop).
setInterval(() => {
  const now = Date.now();
  for (const game of games.values()) {
    if (game.phase !== 'finished' && now - game.lastActivity > STALE_MS) finishGame(game, { aborted: true });
  }
}, 60_000).unref?.();
