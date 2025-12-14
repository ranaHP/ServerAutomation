import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { db } from './db.js';
import { logger } from './logger.js';
import { generateToken, authMiddleware, validateCredentials, verifyUser } from './auth.js';
import { loadInventory, findServer } from './inventory.js';
import { buildDeploySteps, buildRollbackSteps } from './steps.js';
import { runRemoteCommands } from './ssh.js';

const app = express();
app.use(express.json());
app.use(helmet());
app.use(cors({ origin: config.webOrigin, credentials: true }));
app.use(pinoHttp({ logger }));
const limiter = rateLimit({ windowMs: 60_000, limit: 20 });
app.use('/api/auth/login', limiter);

function logSession(sessionId, level, message) {
  db.prepare('INSERT INTO logs (session_id, ts, level, message) VALUES (?,?,?,?)')
    .run(sessionId, new Date().toISOString(), level, message);
  const listeners = sseClients.get(sessionId) || [];
  listeners.forEach((res) => {
    res.write(`data: ${JSON.stringify({ level, message, ts: new Date().toISOString() })}\n\n`);
  });
}

function audit(userId, action, sessionId, metadata = {}) {
  db.prepare('INSERT INTO audit (user_id, action, session_id, ts, metadata_json) VALUES (?,?,?,?,?)')
    .run(userId, action, sessionId, new Date().toISOString(), JSON.stringify(metadata));
}

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = validateCredentials(req.body);
    const user = verifyUser(username, password);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const token = generateToken(user);
    audit(user.id, 'login');
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.user.sub);
  res.json({ user });
});

app.get('/api/inventory', authMiddleware, (req, res) => {
  res.json(loadInventory());
});

const sessionSchema = z.object({
  type: z.enum(['deploy', 'rollback']),
  mode: z.enum(['dry-run', 'execute']),
  serverGroup: z.string(),
  serverName: z.string(),
  releaseDir: z.string().optional(),
  serverDir: z.string(),
  backupBase: z.string(),
  rollbackBackupTs: z.string().optional()
});

function insertSteps(sessionId, steps) {
  const stmt = db.prepare('INSERT INTO session_steps (session_id, step_key, step_name, commands_json, status) VALUES (?,?,?,?,?)');
  for (const s of steps) stmt.run(sessionId, s.key, s.name, JSON.stringify(s.commands || []), 'pending');
}

app.post('/api/sessions', authMiddleware, (req, res) => {
  try {
    const parsed = sessionSchema.parse(req.body);
    if (req.user.role === 'operator' && parsed.serverGroup !== 'UAT') {
      return res.status(403).json({ error: 'operators restricted to UAT' });
    }
    const server = findServer(parsed.serverGroup, parsed.serverName);
    if (!server) return res.status(400).json({ error: 'server not allowed' });
    const id = nanoid();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO sessions (id, created_by_user_id, server_group, server_name, server_host, mode, type, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id, req.user.sub, parsed.serverGroup, parsed.serverName, server.host, parsed.mode, parsed.type, 'created', now, now);
    const steps = parsed.type === 'deploy' ? buildDeploySteps(parsed) : buildRollbackSteps(parsed);
    insertSteps(id, steps);
    audit(req.user.sub, 'session:create', id, parsed);
    res.status(201).json({ id, status: 'created', steps });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/sessions', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
  const filtered = req.user.role === 'operator' ? rows.filter((r) => r.created_by_user_id === req.user.sub) : rows;
  res.json(filtered);
});

app.get('/api/sessions/:id', authMiddleware, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  if (req.user.role === 'operator' && session.created_by_user_id !== req.user.sub) return res.status(403).json({ error: 'forbidden' });
  const steps = db.prepare('SELECT * FROM session_steps WHERE session_id = ?').all(req.params.id);
  res.json({ ...session, steps });
});

const sseClients = new Map();
app.get('/api/sessions/:id/logs/stream', authMiddleware, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  const arr = sseClients.get(req.params.id) || [];
  arr.push(res);
  sseClients.set(req.params.id, arr);
  req.on('close', () => {
    const next = (sseClients.get(req.params.id) || []).filter((r) => r !== res);
    sseClients.set(req.params.id, next);
  });
});

app.get('/api/sessions/:id/logs', authMiddleware, (req, res) => {
  const logs = db.prepare('SELECT * FROM logs WHERE session_id = ? ORDER BY id DESC LIMIT 200').all(req.params.id);
  res.json(logs.reverse());
});

app.post('/api/sessions/:id/approve-step', authMiddleware, async (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  if (req.user.role === 'operator' && session.created_by_user_id !== req.user.sub) return res.status(403).json({ error: 'forbidden' });
  const stepKey = req.body.stepKey;
  const step = db.prepare('SELECT * FROM session_steps WHERE session_id = ? AND step_key = ?').get(req.params.id, stepKey);
  if (!step) return res.status(404).json({ error: 'step not found' });
  if (step.status !== 'pending') return res.status(400).json({ error: 'step not pending' });
  db.prepare('UPDATE session_steps SET status = ? WHERE id = ?').run('approved', step.id);
  audit(req.user.sub, 'step:approve', req.params.id, { stepKey });
  res.json({ ok: true });
});

app.post('/api/sessions/:id/abort', authMiddleware, (req, res) => {
  db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
    .run('aborted', new Date().toISOString(), req.params.id);
  audit(req.user.sub, 'session:abort', req.params.id);
  logSession(req.params.id, 'warn', 'Session aborted by user');
  res.json({ status: 'aborted' });
});

async function executeSession(sessionId) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  const steps = db.prepare('SELECT * FROM session_steps WHERE session_id = ?').all(sessionId);
  const server = findServer(session.server_group, session.server_name);
  for (const step of steps) {
    if (db.prepare('SELECT status FROM sessions WHERE id = ?').get(sessionId).status === 'aborted') break;
    if (step.status !== 'approved') {
      logSession(sessionId, 'info', `Waiting approval for ${step.step_name}`);
      db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('waiting_approval', sessionId);
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    db.prepare('UPDATE session_steps SET status = ?, started_at = ? WHERE id = ?')
      .run('running', new Date().toISOString(), step.id);
    db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
      .run('running', new Date().toISOString(), sessionId);
    logSession(sessionId, 'info', `Executing step ${step.step_name}`);
    const commands = JSON.parse(step.commands_json || '[]');
    if (session.mode === 'dry-run') {
      commands.forEach((c) => logSession(sessionId, 'info', `[dry-run] ${c}`));
      db.prepare('UPDATE session_steps SET status = ?, finished_at = ?, exit_code = ? WHERE id = ?')
        .run('success', new Date().toISOString(), 0, step.id);
      continue;
    }
    try {
      const code = await runRemoteCommands(server, commands, (level, message) => logSession(sessionId, level, message));
      db.prepare('UPDATE session_steps SET status = ?, finished_at = ?, exit_code = ? WHERE id = ?')
        .run(code === 0 ? 'success' : 'failed', new Date().toISOString(), code, step.id);
      if (code !== 0) {
        db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
          .run('failed', new Date().toISOString(), sessionId);
        return;
      }
    } catch (err) {
      logSession(sessionId, 'error', err.message);
      db.prepare('UPDATE session_steps SET status = ?, finished_at = ?, error = ? WHERE id = ?')
        .run('failed', new Date().toISOString(), err.message, step.id);
      db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
        .run('failed', new Date().toISOString(), sessionId);
      return;
    }
  }
  db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
    .run('completed', new Date().toISOString(), sessionId);
}

app.post('/api/sessions/:id/run', authMiddleware, async (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  if (req.user.role === 'operator' && session.created_by_user_id !== req.user.sub) return res.status(403).json({ error: 'forbidden' });
  executeSession(session.id);
  res.json({ started: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(config.port, () => logger.info(`ReleasePilot API listening on ${config.port}`));
