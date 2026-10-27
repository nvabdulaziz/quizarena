import 'dotenv/config';

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
};

export const config = {
  port: Number(process.env.PORT || 4000),
  isProd: process.env.NODE_ENV === 'production',
  jwtSecret: required('JWT_SECRET'),
  clientOrigins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, ''),
  maxPlayers: Number(process.env.MAX_PLAYERS || 200),
  redisUrl: process.env.REDIS_URL || '',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  allowedTimeLimits: [5, 10, 15, 20, 30, 60, 120],
};
