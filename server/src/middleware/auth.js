import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(teacher) {
  return jwt.sign({ sub: teacher.id }, config.jwtSecret, { expiresIn: '7d' });
}

export function requireTeacher(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.teacherId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'AUTH_INVALID' });
  }
}

export function verifyTokenValue(token) {
  try {
    return jwt.verify(token, config.jwtSecret).sub;
  } catch {
    return null;
  }
}
