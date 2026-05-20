import dotenv from 'dotenv';
dotenv.config();

// ── Required environment variable validation ─────────────────────────────────
// Must run before any module that reads env vars (auth middleware, pool, etc.)
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('[Server] FATAL: Missing required environment variables:');
  missing.forEach((key) => console.error(`  • ${key}`));
  console.error('\nCopy server/.env.example → server/.env and fill in real values.');
  process.exit(1);
}

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { checkConnection, closePool } from './db/pool';
import { runMigrations } from './db/migrate';

import authRoutes from './routes/auth';
import profileRoutes from './routes/profiles';
import categoryRoutes from './routes/categories';
import transactionRoutes from './routes/transactions';
import budgetRoutes from './routes/budgets';
import goalRoutes from './routes/goals';
import groupRoutes from './routes/groups';
import debtRoutes from './routes/debts';
import recurringRoutes from './routes/recurring';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Security middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Rate limiting ───────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // stricter for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later' },
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/recurring', recurringRoutes);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Readiness probe (Docker / Kubernetes) ───────────────────────────────────
app.get('/api/ready', async (_req, res) => {
  try {
    await checkConnection();
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
  }
});

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
let server: ReturnType<typeof app.listen>;

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Server] ${signal} received — shutting down gracefully…`);
  server.close(async () => {
    await closePool();
    console.log('[Server] Shutdown complete.');
    process.exit(0);
  });

  // Force exit after 10s if shutdown hangs
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Startup ─────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await checkConnection();
    await runMigrations();
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Budget API server running on http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log(`   Ready:  http://localhost:${PORT}/api/ready\n`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
