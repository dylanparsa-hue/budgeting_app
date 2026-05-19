import { Router } from 'express';
import { body, query } from 'express-validator';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

// ── GET /api/transactions ───────────────────────────────────────────────────
router.get(
  '/',
  validate([
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('group_id').optional().isUUID(),
  ]),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const groupId = req.query.group_id as string | undefined;

      let sql: string;
      let params: any[];

      if (groupId) {
        // Verify user is a member of this group
        const memberCheck = await pool.query(
          'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
          [groupId, req.userId],
        );
        if (memberCheck.rows.length === 0) {
          res.status(403).json({ error: 'Not a member of this group' });
          return;
        }
        sql = `
          SELECT t.*, row_to_json(c.*) AS category
          FROM transactions t
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.group_id = $1
          ORDER BY t.date DESC, t.created_at DESC
          LIMIT $2
        `;
        params = [groupId, limit];
      } else {
        sql = `
          SELECT t.*, row_to_json(c.*) AS category
          FROM transactions t
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = $1
          ORDER BY t.date DESC, t.created_at DESC
          LIMIT $2
        `;
        params = [req.userId, limit];
      }

      const { rows } = await pool.query(sql, params);
      res.json({ data: rows });
    } catch (err: any) {
      console.error('[Transactions] List error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── POST /api/transactions ──────────────────────────────────────────────────
router.post(
  '/',
  validate([
    body('type').isIn(['income', 'expense']),
    body('amount').isFloat({ gt: 0 }),
    body('category_id').optional({ nullable: true }).isUUID(),
    body('note').optional({ nullable: true }).isString(),
    body('date').optional().isISO8601(),
    body('payment_method')
      .optional({ nullable: true })
      .isIn(['cash', 'card', 'transfer', 'ewallet', 'other']),
    body('tags').optional().isArray(),
    body('is_recurring').optional().isBoolean(),
    body('group_id').optional({ nullable: true }).isUUID(),
  ]),
  async (req, res) => {
    try {
      const {
        type, amount, category_id, note, date,
        payment_method, tags, is_recurring, group_id,
      } = req.body;

      // If group transaction, verify membership
      if (group_id) {
        const memberCheck = await pool.query(
          'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
          [group_id, req.userId],
        );
        if (memberCheck.rows.length === 0) {
          res.status(403).json({ error: 'Not a member of this group' });
          return;
        }
      }

      const { rows } = await pool.query(
        `INSERT INTO transactions (user_id, group_id, category_id, type, amount, note, date, payment_method, tags, is_recurring)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          req.userId,
          group_id || null,
          category_id || null,
          type,
          amount,
          note || null,
          date || new Date().toISOString().slice(0, 10),
          payment_method || null,
          tags || [],
          is_recurring ?? false,
        ],
      );

      // Re-fetch with category join
      const { rows: fullRows } = await pool.query(
        `SELECT t.*, row_to_json(c.*) AS category
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.id = $1`,
        [rows[0].id],
      );

      res.status(201).json({ data: fullRows[0] });
    } catch (err: any) {
      console.error('[Transactions] Create error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── PATCH /api/transactions/:id ─────────────────────────────────────────────
router.patch(
  '/:id',
  validate([
    body('type').optional().isIn(['income', 'expense']),
    body('amount').optional().isFloat({ gt: 0 }),
    body('category_id').optional({ nullable: true }).isUUID(),
    body('note').optional({ nullable: true }).isString(),
    body('date').optional().isISO8601(),
    body('payment_method')
      .optional({ nullable: true })
      .isIn(['cash', 'card', 'transfer', 'ewallet', 'other']),
    body('tags').optional().isArray(),
    body('is_recurring').optional().isBoolean(),
  ]),
  async (req, res) => {
    try {
      // Verify ownership
      const check = await pool.query(
        'SELECT id FROM transactions WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId],
      );
      if (check.rows.length === 0) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const allowedFields = [
        'type', 'amount', 'category_id', 'note', 'date',
        'payment_method', 'tags', 'is_recurring',
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
        `UPDATE transactions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values,
      );

      res.json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Transactions] Update error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── DELETE /api/transactions/:id ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    res.json({ data: { id: req.params.id } });
  } catch (err: any) {
    console.error('[Transactions] Delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
