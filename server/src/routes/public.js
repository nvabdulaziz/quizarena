import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getByPin } from '../game/manager.js';
import { config } from '../config.js';

const router = Router();

// Brute-force protection for PIN guessing.
const pinLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'RATE_LIMITED' } });

router.get('/pin/:pin', pinLimiter, (req, res) => {
  const game = /^\d{6}$/.test(req.params.pin) ? getByPin(req.params.pin) : null;
  if (!game) return res.status(404).json({ error: 'INVALID_PIN' });
  res.json({
    valid: true,
    open: game.phase === 'lobby',
    full: game.players.size >= config.maxPlayers,
    title: game.title,
  });
});

export default router;
