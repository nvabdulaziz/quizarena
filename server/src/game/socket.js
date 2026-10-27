import { verifyTokenValue } from '../middleware/auth.js';
import * as gm from './manager.js';

// Tiny in-memory sliding-window limiter for socket events (per IP + bucket).
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (!v.some((t) => now - t < 120_000)) hits.delete(k);
}, 60_000).unref?.();

const ipOf = (socket) =>
  (socket.handshake.headers['x-forwarded-for'] || '').split(',')[0].trim() || socket.handshake.address;

export function registerSocketHandlers(io) {
  gm.attachIo(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) socket.data.teacherId = verifyTokenValue(token) || null;
    next();
  });

  io.on('connection', (socket) => {
    const ack = (cb, payload) => typeof cb === 'function' && cb(payload);
    const hostGame = () => {
      const game = socket.data.hostGameId && gm.getById(socket.data.hostGameId);
      return game && game.hostSocketId === socket.id && game.teacherId === socket.data.teacherId ? game : null;
    };

    /* ----- host ----- */
    socket.on('host:create', async ({ quizId, streakBonus } = {}, cb) => {
      if (!socket.data.teacherId) return ack(cb, { error: 'AUTH_REQUIRED' });
      try {
        const { game, error } = await gm.createGame({ teacherId: socket.data.teacherId, quizId: String(quizId), streakBonus });
        if (error) return ack(cb, { error });
        game.hostSocketId = socket.id;
        socket.data.hostGameId = game.id;
        socket.join(`game:${game.id}`);
        ack(cb, { ok: true, pin: game.pin, gameId: game.id });
        gm.broadcast(game);
      } catch (e) {
        console.error(e);
        ack(cb, { error: 'SERVER_ERROR' });
      }
    });

    // Host refreshed the page / lost connection: reclaim the game by PIN.
    socket.on('host:rejoin', ({ pin } = {}, cb) => {
      const game = gm.getByPin(pin);
      if (!game || game.teacherId !== socket.data.teacherId) return ack(cb, { error: 'NOT_FOUND' });
      game.hostSocketId = socket.id;
      socket.data.hostGameId = game.id;
      ack(cb, { ok: true, pin: game.pin, gameId: game.id });
      gm.broadcast(game);
    });

    socket.on('host:start', (_p, cb) => {
      const g = hostGame();
      if (!g) return ack(cb, { error: 'NOT_HOST' });
      ack(cb, gm.startGame(g));
    });
    socket.on('host:next', (_p, cb) => {
      const g = hostGame();
      if (!g) return ack(cb, { error: 'NOT_HOST' });
      ack(cb, gm.hostAdvance(g));
    });
    socket.on('host:skip', (_p, cb) => {
      const g = hostGame();
      if (!g) return ack(cb, { error: 'NOT_HOST' });
      // Skip = end the current question now (question phase) or move on from any other phase.
      ack(cb, gm.hostAdvance(g));
    });
    socket.on('host:pause', (_p, cb) => {
      const g = hostGame();
      if (!g) return ack(cb, { error: 'NOT_HOST' });
      ack(cb, gm.pauseGame(g));
    });
    socket.on('host:resume', (_p, cb) => {
      const g = hostGame();
      if (!g) return ack(cb, { error: 'NOT_HOST' });
      ack(cb, gm.resumeGame(g));
    });
    socket.on('host:end', (_p, cb) => {
      const g = hostGame();
      if (!g) return ack(cb, { error: 'NOT_HOST' });
      if (g.phase === 'finished') return ack(cb, { ok: true });
      ack(cb, gm.finishGame(g, { aborted: g.phase === 'lobby' }));
    });
    socket.on('host:kick', ({ playerId } = {}, cb) => {
      const g = hostGame();
      if (!g) return ack(cb, { error: 'NOT_HOST' });
      gm.removePlayer(g, String(playerId));
      ack(cb, { ok: true });
    });

    /* ----- players ----- */
    socket.on('player:join', async ({ pin, nickname } = {}, cb) => {
      const ip = ipOf(socket);
      if (limited(`join:${ip}`, 15, 60_000)) return ack(cb, { error: 'RATE_LIMITED' });
      const game = gm.getByPin(String(pin || ''));
      if (!game) return ack(cb, { error: 'INVALID_PIN' });
      const res = await gm.joinPlayer(game, socket.id, nickname);
      if (res.error) return ack(cb, { error: res.error });
      socket.data.gameId = game.id;
      socket.data.playerId = res.player.id;
      socket.join(`game:${game.id}`);
      ack(cb, { ok: true, playerId: res.player.id, token: res.token, nickname: res.player.nickname, pin: game.pin });
      gm.broadcast(game);
    });

    socket.on('player:rejoin', ({ pin, token } = {}, cb) => {
      if (limited(`rejoin:${ipOf(socket)}`, 30, 60_000)) return ack(cb, { error: 'RATE_LIMITED' });
      const game = gm.getByPin(String(pin || ''));
      if (!game) return ack(cb, { error: 'INVALID_PIN' });
      const res = gm.rejoinPlayer(game, String(token || ''), socket.id);
      if (res.error) return ack(cb, { error: res.error });
      socket.data.gameId = game.id;
      socket.data.playerId = res.player.id;
      socket.join(`game:${game.id}`);
      ack(cb, { ok: true, playerId: res.player.id, nickname: res.player.nickname, pin: game.pin });
      gm.broadcast(game);
    });

    socket.on('player:answer', ({ answerIds } = {}, cb) => {
      const game = socket.data.gameId && gm.getById(socket.data.gameId);
      const player = game && game.players.get(socket.data.playerId);
      if (!player || player.socketId !== socket.id) return ack(cb, { error: 'NOT_IN_GAME' });
      const res = gm.submitAnswer(game, player, answerIds);
      ack(cb, res);
    });

    /* ----- disconnect ----- */
    socket.on('disconnect', () => {
      const game = socket.data.gameId && gm.getById(socket.data.gameId);
      if (game) {
        const player = game.players.get(socket.data.playerId);
        if (player && player.socketId === socket.id) gm.playerDisconnected(game, player);
      }
      const hg = socket.data.hostGameId && gm.getById(socket.data.hostGameId);
      if (hg && hg.hostSocketId === socket.id) hg.hostSocketId = null; // game keeps running; host can rejoin
    });
  });
}
