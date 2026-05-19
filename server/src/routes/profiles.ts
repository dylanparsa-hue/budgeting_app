import { Router } from 'express';
import { body } from 'express-validator';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// All profile routes require authentication
router.use(requireAuth);

// ── GET /api/profiles/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    // Users can only view their own profile
    if (req.params.id !== req.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, full_name, avatar_url, currency, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.params.id],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({ data: rows[0] });
  } catch (err: any) {
    console.error('[Profiles] Get error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/profiles/:id ─────────────────────────────────────────────────
router.patch(
  '/:id',
  validate([
    body('full_name').optional().isString().trim().isLength({ max: 100 }),
    body('currency').optional().isString().trim().isLength({ min: 3, max: 3 }),
    body('avatar_url').optional().isString(),
  ]),
  async (req, res) => {
    try {
      if (req.params.id !== req.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const allowedFields = ['full_name', 'currency', 'avatar_url'];
      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramIdx}`);
          values.push(req.body[field]);
          paramIdx++;
        }
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No valid fields to update' });
        return;
      }

      values.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE users SET ${updates.join(', ')}
         WHERE id = $${paramIdx}
         RETURNING id, full_name, avatar_url, currency, created_at, updated_at`,
        values,
      );

      res.json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Profiles] Update error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
