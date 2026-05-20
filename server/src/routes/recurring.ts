import { Router } from 'express';
import { body } from 'express-validator';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

// ── GET /api/recurring ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM recurring_expenses
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId],
    );
    res.json({ data: rows });
  } catch (err: any) {
    console.error('[Recurring] List error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/recurring ─────────────────────────────────────────────────────
router.post(
  '/',
  validate([
    body('name').isString().trim().notEmpty(),
    body('amount').isFloat({ gt: 0 }),
    body('category')
      .optional()
      .isIn(['rent', 'utilities', 'subscription', 'debt', 'insurance', 'transport', 'other']),
    body('frequency')
      .optional()
      .isIn(['monthly', 'weekly', 'yearly']),
    body('deduct_from_income').optional().isBoolean(),
    body('next_due_date').optional({ nullable: true }).isISO8601(),
  ]),
  async (req, res) => {
    try {
      const { name, amount, category, frequency, deduct_from_income, next_due_date } = req.body;

      const { rows } = await pool.query(
        `INSERT INTO recurring_expenses (user_id, name, amount, category, frequency, deduct_from_income, next_due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          req.userId,
          name,
          amount,
          category || 'other',
          frequency || 'monthly',
          deduct_from_income ?? false,
          next_due_date || null,
        ],
      );

      res.status(201).json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Recurring] Create error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── PATCH /api/recurring/:id ────────────────────────────────────────────────
router.patch(
  '/:id',
  validate([
    body('name').optional().isString().trim().notEmpty(),
    body('amount').optional().isFloat({ gt: 0 }),
    body('category')
      .optional()
      .isIn(['rent', 'utilities', 'subscription', 'debt', 'insurance', 'transport', 'other']),
    body('frequency')
      .optional()
      .isIn(['monthly', 'weekly', 'yearly']),
    body('deduct_from_income').optional().isBoolean(),
    body('next_due_date').optional({ nullable: true }).isISO8601(),
  ]),
  async (req, res) => {
    try {
      const check = await pool.query(
        'SELECT id FROM recurring_expenses WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId],
      );
      if (check.rows.length === 0) {
        res.status(404).json({ error: 'Recurring expense not found' });
        return;
      }

      const allowedFields = [
        'name', 'amount', 'category', 'frequency',
        'deduct_from_income', 'next_due_date',
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
        `UPDATE recurring_expenses SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values,
      );

      res.json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Recurring] Update error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── DELETE /api/recurring/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM recurring_expenses WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Recurring expense not found' });
      return;
    }
    res.json({ data: { id: req.params.id } });
  } catch (err: any) {
    console.error('[Recurring] Delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
