import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { config } from './config.js';
import { db } from './db.js';

export function generateToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, username: user.username }, config.jwtSecret, { expiresIn: '12h' });
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'missing auth' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch (err) {
    res.status(401).json({ error: 'invalid token' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

export function validateCredentials(body) {
  const schema = z.object({ username: z.string(), password: z.string() });
  return schema.parse(body);
}

export function verifyUser(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.password_hash);
  return ok ? user : null;
}
