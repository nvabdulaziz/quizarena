// Integration test: real Socket.IO server + real clients; Prisma replaced by an in-memory stub.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.JWT_SECRET = 'test-secret';

const calls = { results: [], scores: [], answers: [], status: [] };
let n = 0;
const quiz = {
  id: 'quiz1', title: 'Demo',
  questions: [1, 2].map((i) => ({
    id: `q${i}`, text: `Question ${i}`, imageUrl: null, timeLimit: 2, points: 1000,
    answers: [
      { id: `q${i}a`, text: 'right', isCorrect: true },
      { id: `q${i}b`, text: 'wrong', isCorrect: false },
    ],
  })),
};
const fakePrisma = {
  quiz: { findFirst: async () => quiz },
  gameSession: { create: async ({ data }) => ({ id: 'game1', ...data, streakBonus: data.streakBonus }), update: async ({ data }) => { calls.status.push(data.status); } },
  player: { create: async ({ data }) => ({ id: `p${++n}`, joinedAt: new Date(), ...data }), deleteMany: async () => ({}) },
  playerAnswer: { createMany: async ({ data }) => { calls.answers.push(...data); } },
  score: { createMany: async ({ data }) => { calls.scores.push(...data); } },
  gameResult: { createMany: async ({ data }) => { calls.results.push(...data); } },
  $transaction: async (ops) => Promise.all(ops),
};
mock.module('../src/db.js', { namedExports: { prisma: fakePrisma } });

const { Server } = await import('socket.io');
const { io: connect } = await import('socket.io-client');
const { registerSocketHandlers } = await import('../src/game/socket.js');
const { signToken } = await import('../src/middleware/auth.js');

const server = http.createServer();
const io = new Server(server, { cors: { origin: '*' } });
registerSocketHandlers(io);
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}`;

const client = (auth) => new Promise((resolve) => { const s = connect(url, { auth, transports: ['websocket'] }); s.on('connect', () => resolve(s)); });
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));
const states = new Map();
const track = (name, s) => { states.set(name, null); s.on('game:state', (st) => states.set(name, st)); };
const until = async (name, pred, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const st = states.get(name); if (st && pred(st)) return st; await new Promise((r) => setTimeout(r, 25)); }
  throw new Error(`timeout waiting on ${name}; last=${JSON.stringify(states.get(name))?.slice(0, 200)}`);
};

test('full multiplayer game flow with server-side scoring', async (t) => {
  const teacher = await client({ token: signToken({ id: 't1' }) });
  track('host', teacher);
  const created = await emit(teacher, 'host:create', { quizId: 'quiz1', streakBonus: 100 });
  assert.match(created.pin, /^\d{6}$/);
  const pin = created.pin;

  const [s1, s2, s3] = await Promise.all([client({}), client({}), client({})]);
  const j1 = await emit(s1, 'player:join', { pin, nickname: 'Alice' });
  const j2 = await emit(s2, 'player:join', { pin, nickname: 'Bob' });
  track('alice', s1); track('bob', s2); track('carl', s3);
  assert.ok(j1.ok && j2.ok);

  await t.test('validation: duplicate nickname, bad PIN, invalid nickname', async () => {
    assert.equal((await emit(s3, 'player:join', { pin, nickname: 'alice' })).error, 'NICKNAME_TAKEN');
    assert.equal((await emit(s3, 'player:join', { pin: '000000', nickname: 'X' })).error, 'INVALID_PIN');
    assert.equal((await emit(s3, 'player:join', { pin, nickname: '   ' })).error, 'INVALID_NICKNAME');
    const j3 = await emit(s3, 'player:join', { pin, nickname: 'Carl' });
    assert.ok(j3.ok);
  });

  await t.test('only the host can control the game', async () => {
    assert.equal((await emit(s1, 'host:start')).error, 'NOT_HOST');
  });

  await until('host', (s) => s.phase === 'lobby' && s.playerCount === 3);
  assert.ok((await emit(teacher, 'host:start')).ok);

  // ---- Question 1
  const q1 = await until('alice', (s) => s.phase === 'question' && s.index === 0);
  assert.ok(q1.question.answers.every((a) => !('isCorrect' in a)), 'correct answers must never be sent during a question');
  assert.equal(q1.you.isCorrect, false);
  assert.equal((await emit(s1, 'player:answer', { answerIds: ['q1a'] })).ok, true);
  assert.equal((await emit(s1, 'player:answer', { answerIds: ['q1b'] })).error, 'ALREADY_ANSWERED', 'no answer changes');
  assert.equal((await emit(s2, 'player:answer', { answerIds: ['nope'] })).error, 'INVALID_ANSWER');
  assert.ok((await emit(s2, 'player:answer', { answerIds: ['q1b'] })).ok);
  // Carl never answers -> question closes on timer
  const r1 = await until('alice', (s) => s.phase === 'results' && s.index === 0, 6000);
  assert.ok(r1.question.answers.find((a) => a.id === 'q1a').isCorrect);
  assert.equal(r1.counts.q1a, 1); assert.equal(r1.counts.q1b, 1);
  assert.ok(r1.you.isCorrect && r1.you.points > 500 && r1.you.points <= 1000, `points ${r1.you.points}`);
  const bob1 = await until('bob', (s) => s.phase === 'results');
  assert.equal(bob1.you.points, 0); assert.equal(bob1.you.streak, 0);
  assert.equal((await emit(s1, 'player:answer', { answerIds: ['q1a'] })).error, 'NOT_ACCEPTING', 'late answers rejected');

  assert.ok((await emit(teacher, 'host:next')).ok);
  const lb = await until('host', (s) => s.phase === 'leaderboard');
  assert.equal(lb.top[0].nickname, 'Alice'); assert.equal(lb.top[0].rank, 1);

  // ---- Question 2 (with pause / resume)
  assert.ok((await emit(teacher, 'host:next')).ok);
  await until('alice', (s) => s.phase === 'question' && s.index === 1);
  assert.ok((await emit(teacher, 'host:pause')).ok);
  const paused = await until('alice', (s) => s.paused);
  assert.equal((await emit(s1, 'player:answer', { answerIds: ['q2a'] })).error, 'NOT_ACCEPTING');
  assert.ok(paused.remainingMs > 0);
  await new Promise((r) => setTimeout(r, 2500)); // longer than the 2s limit: pause must freeze the clock
  assert.equal(states.get('alice').phase, 'question');
  assert.ok((await emit(teacher, 'host:resume')).ok);
  assert.ok((await emit(s1, 'player:answer', { answerIds: ['q2a'] })).ok);
  assert.ok((await emit(s2, 'player:answer', { answerIds: ['q2a'] })).ok);
  assert.ok((await emit(s3, 'player:answer', { answerIds: ['q2a'] })).ok); // all answered -> closes early
  const r2 = await until('alice', (s) => s.phase === 'results' && s.index === 1);
  assert.equal(r2.you.streak, 2);
  assert.equal(r2.you.streakBonus, 100, 'streak bonus applied on 2nd consecutive correct');

  await t.test('reconnection restores the player session', async () => {
    const token = j1.token;
    s1.disconnect();
    const again = await client({});
    track('alice2', again);
    const res = await emit(again, 'player:rejoin', { pin, token });
    assert.ok(res.ok); assert.equal(res.nickname, 'Alice');
    const st = await until('alice2', (s) => s.phase === 'results');
    assert.equal(st.you.score, r2.you.score);
    assert.equal((await emit(again, 'player:rejoin', { pin, token: 'bogus' })).error, 'SESSION_NOT_FOUND');
    again.close();
  });

  // ---- Finish
  assert.ok((await emit(teacher, 'host:next')).ok); // -> leaderboard
  assert.ok((await emit(teacher, 'host:next')).ok); // -> finished
  const fin = await until('host', (s) => s.phase === 'finished');
  assert.deepEqual(fin.podium.map((p) => p.nickname), ['Alice', 'Bob', 'Carl'].sort((a, b) => fin.ranking.find((r) => r.nickname === a).rank - fin.ranking.find((r) => r.nickname === b).rank).slice(0, 3));
  assert.equal(fin.podium[0].nickname, 'Alice');
  assert.equal(fin.ranking.length, 3);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(calls.results.length, 3, 'results persisted');
  assert.equal(calls.results.find((r) => r.finalRank === 1).finalScore, fin.podium[0].score);
  assert.ok(calls.answers.length >= 5 && calls.scores.length === 6);
  assert.ok(calls.status.includes('FINISHED'));

  [teacher, s2, s3].forEach((s) => s.close());
});

test.after(() => { io.close(); server.close(); setTimeout(() => process.exit(0), 50); });
