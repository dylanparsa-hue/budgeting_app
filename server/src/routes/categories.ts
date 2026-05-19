import { Router } from 'express';
import { body } from 'express-validator';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

// ── GET /api/categories ─────────────────────────────────────────────────────
// Returns system defaults (user_id IS NULL) + user's own categories
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM categories
       WHERE user_id IS NULL OR user_id = $1
       ORDER BY sort_order ASC`,
      [req.userId],
    );
    res.json({ data: rows });
  } catch (err: any) {
    console.error('[Categories] List error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/categories ────────────────────────────────────────────────────
router.post(
  '/',
  validate([
    body('name').isString().trim().notEmpty(),
    body('icon').optional().isString(),
    body('color').optional().isString(),
    body('type').optional().isIn(['expense', 'income', 'both']),
    body('is_default').optional().isBoolean(),
    body('sort_order').optional().isInt(),
  ]),
  async (req, res) => {
    try {
      const { name, icon, color, type, is_default, sort_order } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO categories (user_id, name, icon, color, type, is_default, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          req.userId,
          name,
          icon || '💰',
          color || '#6366F1',
          type || 'expense',
          is_default ?? false,
          sort_order ?? 0,
        ],
      );
      res.status(201).json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Categories] Create error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── PATCH /api/categories/:id ───────────────────────────────────────────────
router.patch(
  '/:id',
  validate([
    body('name').optional().isString().trim().notEmpty(),
    body('icon').optional().isString(),
    body('color').optional().isString(),
    body('type').optional().isIn(['expense', 'income', 'both']),
    body('is_default').optional().isBoolean(),
    body('sort_order').optional().isInt(),
  ]),
  async (req, res) => {
    try {
      // Verify ownership
      const check = await pool.query(
        'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId],
      );
      if (check.rows.length === 0) {
        res.status(404).json({ error: 'Category not found or not yours' });
        return;
      }

      const allowedFields = ['name', 'icon', 'color', 'type', 'is_default', 'sort_order'];
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
        `UPDATE categories SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values,
      );

      res.json({ data: rows[0] });
    } catch (err: any) {
      console.error('[Categories] Update error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── DELETE /api/categories/:id ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Category not found or not yours' });
      return;
    }
    res.json({ data: { id: req.params.id } });
  } catch (err: any) {
    console.error('[Categories] Delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
