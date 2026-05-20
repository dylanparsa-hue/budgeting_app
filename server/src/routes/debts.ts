import { Router } from 'express';
import { body } from 'express-validator';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

// ── GET /api/debts ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM debts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId],
    );
    res.json({ data: rows });
  } catch (err: any) {
    console.error('[Debts] List error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/debts ─────────────────────────────────────────────────────────
router.post(
  '/',
  validate([
    body('name').isString().trim().notEmpty(),
    body('lender').isString().trim().notEmpty(),
    body('total_amount').isFloat({ gt: 0 }),
    body('amount_paid').optional().isFloat({ min: 0 }),
    body('due_date').optional({ nullable: true }).isISO8601(),
    body('interest_rate').optional({ nullable: true }).isFloat({ min: 0 }),
    body('notes').optional({ nullable: true }).isString(),
  ]),
  async (req, res) => {
    try {
      const { name, lender, total_amount, amount_paid, due_date, interest_rate, notes } = req.body;

      const { rows } = await pool.query(
        `INSERT INTO debts (user_id, name, lender, total_amount, amount_paid, due_date, interest_rate, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          req.userId,
          name,
          lender,
          total_amount,
          amount_paid ?? 0,
          due_date || null,
          interest_rate ?? null,
          notes || null,
        ],
      );

      res.status(201).json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Debts] Create error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── PATCH /api/debts/:id ────────────────────────────────────────────────────
router.patch(
  '/:id',
  validate([
    body('name').optional().isString().trim().notEmpty(),
    body('lender').optional().isString().trim().notEmpty(),
    body('total_amount').optional().isFloat({ gt: 0 }),
    body('amount_paid').optional().isFloat({ min: 0 }),
    body('due_date').optional({ nullable: true }).isISO8601(),
    body('interest_rate').optional({ nullable: true }).isFloat({ min: 0 }),
    body('notes').optional({ nullable: true }).isString(),
  ]),
  async (req, res) => {
    try {
      const check = await pool.query(
        'SELECT id FROM debts WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId],
      );
      if (check.rows.length === 0) {
        res.status(404).json({ error: 'Debt not found' });
        return;
      }

      const allowedFields = [
        'name', 'lender', 'total_amount', 'amount_paid',
        'due_date', 'interest_rate', 'notes',
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
        `UPDATE debts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values,
      );

      res.json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Debts] Update error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── DELETE /api/debts/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM debts WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Debt not found' });
      return;
    }
    res.json({ data: { id: req.params.id } });
  } catch (err: any) {
    console.error('[Debts] Delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
