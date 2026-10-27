import 'express-async-errors';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { config } from './config.js';
import { prisma } from './db.js';
import authRoutes from './routes/auth.js';
import quizRoutes from './routes/quizzes.js';
import gameRoutes from './routes/games.js';
import publicRoutes from './routes/public.js';
import { registerSocketHandlers } from './game/socket.js';

const app = express();
app.set('trust proxy', 1); // Render / Railway sit behind a proxy; needed for correct client IPs

const corsOptions = {
  origin(origin, cb) {
    if (!origin || config.clientOrigins.includes(origin.replace(/\/$/, ''))) return cb(null, true);
    cb(new Error('CORS_BLOCKED'));
  },
  credentials: true,
};

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/uploads', express.static(path.resolve(config.uploadDir), { maxAge: '7d' }));
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/public', publicRoutes);

app.use((err, _req, res, _next) => {
  if (err.message === 'CORS_BLOCKED') return res.status(403).json({ error: 'CORS_BLOCKED' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'FILE_TOO_LARGE' });
  console.error(err);
  res.status(500).json({ error: 'SERVER_ERROR' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.clientOrigins, credentials: true },
  pingInterval: 10_000,
  pingTimeout: 8_000,
});

// Optional Redis adapter for multi-instance broadcasting (see README for the caveat).
if (config.redisUrl) {
  const { createClient } = await import('redis');
  const { createAdapter } = await import('@socket.io/redis-adapter');
  const pub = createClient({ url: config.redisUrl });
  const sub = pub.duplicate();
  await Promise.all([pub.connect(), sub.connect()]);
  io.adapter(createAdapter(pub, sub));
  console.log('Socket.IO Redis adapter enabled');
}

registerSocketHandlers(io);

server.listen(config.port, () => console.log(`QuizArena server listening on :${config.port}`));

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
