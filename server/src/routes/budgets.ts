import { Router } from 'express';
import { body, query } from 'express-validator';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

// ── GET /api/budgets ────────────────────────────────────────────────────────
router.get(
  '/',
  validate([
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('year').optional().isInt({ min: 2000, max: 2100 }),
  ]),
  async (req, res) => {
    try {
      const month = req.query.month ? parseInt(req.query.month as string) : null;
      const year = req.query.year ? parseInt(req.query.year as string) : null;

      let sql = `
        SELECT b.*, row_to_json(c.*) AS category
        FROM budgets b
        LEFT JOIN categories c ON c.id = b.category_id
        WHERE b.user_id = $1
      `;
      const params: any[] = [req.userId];
      let idx = 2;

      if (month !== null) {
        sql += ` AND b.month = $${idx}`;
        params.push(month);
        idx++;
      }
      if (year !== null) {
        sql += ` AND b.year = $${idx}`;
        params.push(year);
        idx++;
      }

      const { rows } = await pool.query(sql, params);
      res.json({ data: rows });
    } catch (err: any) {
      console.error('[Budgets] List error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── PUT /api/budgets (upsert) ───────────────────────────────────────────────
router.put(
  '/',
  validate([
    body('category_id').isUUID(),
    body('amount').isFloat({ gt: 0 }),
    body('period').optional().isIn(['monthly', 'weekly', 'yearly']),
    body('month').optional({ nullable: true }).isInt({ min: 1, max: 12 }),
    body('year').optional({ nullable: true }).isInt({ min: 2000, max: 2100 }),
    body('group_id').optional({ nullable: true }).isUUID(),
  ]),
  async (req, res) => {
    try {
      const { category_id, amount, period, month, year, group_id } = req.body;

      const userId = group_id ? null : req.userId;

      // If group budget, verify admin role
      if (group_id) {
        const adminCheck = await pool.query(
          `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin'`,
          [group_id, req.userId],
        );
        if (adminCheck.rows.length === 0) {
          res.status(403).json({ error: 'Only group admins can manage budgets' });
          return;
        }
      }

      const { rows } = await pool.query(
        `INSERT INTO budgets (user_id, group_id, category_id, amount, period, month, year)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, category_id, period, month, year)
         DO UPDATE SET amount = EXCLUDED.amount
         RETURNING *`,
        [
          userId,
          group_id || null,
          category_id,
          amount,
          period || 'monthly',
          month || null,
          year || null,
        ],
      );

      res.json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Budgets] Upsert error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── DELETE /api/budgets/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }
    res.json({ data: { id: req.params.id } });
  } catch (err: any) {
    console.error('[Budgets] Delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
