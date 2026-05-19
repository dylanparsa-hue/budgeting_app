import { Router } from 'express';
import { body } from 'express-validator';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

// ── GET /api/goals ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM savings_goals
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId],
    );
    res.json({ data: rows });
  } catch (err: any) {
    console.error('[Goals] List error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/goals ─────────────────────────────────────────────────────────
router.post(
  '/',
  validate([
    body('name').isString().trim().notEmpty(),
    body('icon').optional().isString(),
    body('color').optional().isString(),
    body('target_amount').isFloat({ gt: 0 }),
    body('current_amount').optional().isFloat({ min: 0 }),
    body('deadline').optional({ nullable: true }).isISO8601(),
    body('group_id').optional({ nullable: true }).isUUID(),
  ]),
  async (req, res) => {
    try {
      const { name, icon, color, target_amount, current_amount, deadline, group_id } = req.body;

      const userId = group_id ? null : req.userId;

      const { rows } = await pool.query(
        `INSERT INTO savings_goals (user_id, group_id, name, icon, color, target_amount, current_amount, deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          group_id || null,
          name,
          icon || '🎯',
          color || '#6366F1',
          target_amount,
          current_amount || 0,
          deadline || null,
        ],
      );

      res.status(201).json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Goals] Create error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── PATCH /api/goals/:id ────────────────────────────────────────────────────
router.patch(
  '/:id',
  validate([
    body('name').optional().isString().trim().notEmpty(),
    body('icon').optional().isString(),
    body('color').optional().isString(),
    body('target_amount').optional().isFloat({ gt: 0 }),
    body('current_amount').optional().isFloat({ min: 0 }),
    body('deadline').optional({ nullable: true }).isISO8601(),
    body('is_completed').optional().isBoolean(),
  ]),
  async (req, res) => {
    try {
      const check = await pool.query(
        'SELECT id FROM savings_goals WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId],
      );
      if (check.rows.length === 0) {
        res.status(404).json({ error: 'Goal not found' });
        return;
      }

      const allowedFields = [
        'name', 'icon', 'color', 'target_amount',
        'current_amount', 'deadline', 'is_completed',
      ];
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${idx}`);
          values.push(req.body[field]);
          idx++;
        }
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No valid fields to update' });
        return;
      }

      values.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE savings_goals SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values,
      );

      res.json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Goals] Update error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── DELETE /api/goals/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM savings_goals WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    res.json({ data: { id: req.params.id } });
  } catch (err: any) {
    console.error('[Goals] Delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
