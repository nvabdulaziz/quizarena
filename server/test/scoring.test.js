import test from 'node:test';
import assert from 'node:assert/strict';
import { computePoints, computeStreakBonus, isAnswerCorrect, rankPlayers } from '../src/game/scoring.js';

test('instant correct answer earns full base points', () => {
  assert.equal(computePoints({ basePoints: 1000, timeLimitMs: 20000, elapsedMs: 0 }), 1000);
});

test('answer at the last moment earns half', () => {
  assert.equal(computePoints({ basePoints: 1000, timeLimitMs: 20000, elapsedMs: 20000 }), 500);
});

test('elapsed time is clamped to the time limit', () => {
  assert.equal(computePoints({ basePoints: 1000, timeLimitMs: 10000, elapsedMs: 99999 }), 500);
  assert.equal(computePoints({ basePoints: 1000, timeLimitMs: 10000, elapsedMs: -50 }), 1000);
});

test('streak bonus starts at the 2nd correct answer and caps at 5 steps', () => {
  assert.equal(computeStreakBonus({ newStreak: 1, streakBonus: 100 }), 0);
  assert.equal(computeStreakBonus({ newStreak: 2, streakBonus: 100 }), 100);
  assert.equal(computeStreakBonus({ newStreak: 4, streakBonus: 100 }), 300);
  assert.equal(computeStreakBonus({ newStreak: 50, streakBonus: 100 }), 500);
});

test('multi-answer questions need the exact correct set', () => {
  assert.equal(isAnswerCorrect(['a', 'b'], ['a', 'b']), true);
  assert.equal(isAnswerCorrect(['a'], ['a', 'b']), false);
  assert.equal(isAnswerCorrect(['a', 'b', 'c'], ['a', 'b']), false);
  assert.equal(isAnswerCorrect([], ['a']), false);
});

test('ranking sorts by score, ties share a rank', () => {
  const r = rankPlayers([
    { id: 'a', score: 500, joinedAt: 3 },
    { id: 'b', score: 900, joinedAt: 2 },
    { id: 'c', score: 500, joinedAt: 1 },
  ]);
  assert.deepEqual(r.map((p) => [p.id, p.rank]), [['b', 1], ['c', 2], ['a', 2]]);
});
