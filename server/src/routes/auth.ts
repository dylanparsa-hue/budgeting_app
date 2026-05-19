import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { body } from 'express-validator';
import pool from '../db/pool';
import { validate } from '../middleware/validate';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  requireAuth,
} from '../middleware/auth';

const router = Router();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// ── Helper: hash a refresh token for DB storage ─────────────────────────────
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Helper: store refresh token ─────────────────────────────────────────────
async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt],
  );
}

// ── Helper: cleanup expired tokens ──────────────────────────────────────────
async function cleanupExpiredTokens(userId: string): Promise<void> {
  await pool.query(
    'DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()',
    [userId],
  );
}

// ── POST /api/auth/register ─────────────────────────────────────────────────
router.post(
  '/register',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('full_name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 }),
  ]),
  async (req, res) => {
    try {
      const { email, password, full_name } = req.body;

      // Check if user exists
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email],
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Create user
      const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, full_name, avatar_url, currency, created_at, updated_at`,
        [email, passwordHash, full_name || null],
      );

      const user = rows[0];

      // Generate tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);
      await storeRefreshToken(user.id, refreshToken);

      res.status(201).json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { full_name: user.full_name },
          },
          session: {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: 900, // 15 minutes in seconds
          },
          profile: {
            id: user.id,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            currency: user.currency,
            created_at: user.created_at,
            updated_at: user.updated_at,
          },
        },
      });
    } catch (err: any) {
      console.error('[Auth] Register error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  '/login',
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').isString().notEmpty(),
  ]),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const { rows } = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email],
      );
      if (rows.length === 0) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const user = rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Cleanup old tokens & generate new ones
      await cleanupExpiredTokens(user.id);
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);
      await storeRefreshToken(user.id, refreshToken);

      res.json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { full_name: user.full_name },
          },
          session: {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: 900,
          },
          profile: {
            id: user.id,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            currency: user.currency,
            created_at: user.created_at,
            updated_at: user.updated_at,
          },
        },
      });
    } catch (err: any) {
      console.error('[Auth] Login error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── POST /api/auth/refresh ──────────────────────────────────────────────────
router.post(
  '/refresh',
  validate([body('refresh_token').isString().notEmpty()]),
  async (req, res) => {
    try {
      const { refresh_token } = req.body;

      // Verify JWT signature
      const userId = verifyRefreshToken(refresh_token);
      if (!userId) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      // Verify token exists in DB (not revoked)
      const tokenHash = hashToken(refresh_token);
      const { rows } = await pool.query(
        'SELECT id FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 AND expires_at > NOW()',
        [tokenHash, userId],
      );
      if (rows.length === 0) {
        res.status(401).json({ error: 'Refresh token revoked or expired' });
        return;
      }

      // Rotate: delete old token, issue new pair
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);

      const newAccessToken = generateAccessToken(userId);
      const newRefreshToken = generateRefreshToken(userId);
      await storeRefreshToken(userId, newRefreshToken);

      res.json({
        data: {
          session: {
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
            expires_in: 900,
          },
        },
      });
    } catch (err: any) {
      console.error('[Auth] Refresh error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  try {
    // Revoke all refresh tokens for this user
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.userId]);
    res.json({ data: { message: 'Logged out successfully' } });
  } catch (err: any) {
    console.error('[Auth] Logout error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, avatar_url, currency, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.userId],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const user = rows[0];
    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          user_metadata: { full_name: user.full_name },
        },
        profile: {
          id: user.id,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          currency: user.currency,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      },
    });
  } catch (err: any) {
    console.error('[Auth] Me error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
