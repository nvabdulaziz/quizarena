/**
 * Kahoot-style scoring, computed only on the server.
 *
 * points = round(basePoints * (1 - (elapsed / timeLimit) / 2))   -> 100% .. 50% of base
 * Streak bonus: starting with the 2nd consecutive correct answer,
 * bonus = min(streak - 1, 5) * streakBonus  (configurable per game).
 * Wrong or missing answers score 0 and reset the streak.
 */
export function computePoints({ basePoints, timeLimitMs, elapsedMs }) {
  const clamped = Math.min(Math.max(elapsedMs, 0), timeLimitMs);
  const ratio = clamped / timeLimitMs;
  return Math.round(basePoints * (1 - ratio / 2));
}

export function computeStreakBonus({ newStreak, streakBonus }) {
  if (newStreak < 2) return 0;
  return Math.min(newStreak - 1, 5) * streakBonus;
}

/** Multi-answer questions require the exact set of correct answers. */
export function isAnswerCorrect(selectedIds, correctIds) {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return false;
  const sel = new Set(selectedIds);
  if (sel.size !== correctIds.length) return false;
  return correctIds.every((id) => sel.has(id));
}

/** Rank players by score desc, then by earliest join as a stable tiebreaker. Ties share a rank. */
export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
  let lastScore = null;
  let lastRank = 0;
  return sorted.map((p, i) => {
    const rank = p.score === lastScore ? lastRank : i + 1;
    lastScore = p.score;
    lastRank = rank;
    return { ...p, rank };
  });
}
