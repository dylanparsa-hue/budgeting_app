import { Router } from 'express';
import { body } from 'express-validator';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(requireAuth);

// ── GET /api/groups ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows: groups } = await pool.query(
      `SELECT fg.*
       FROM family_groups fg
       WHERE fg.created_by = $1
          OR fg.id IN (SELECT group_id FROM group_members WHERE user_id = $1)`,
      [req.userId],
    );

    // Fetch members with profiles for each group
    for (const group of groups) {
      const { rows: members } = await pool.query(
        `SELECT gm.*, row_to_json(
           (SELECT x FROM (SELECT u.id, u.full_name, u.avatar_url, u.currency, u.created_at, u.updated_at) x)
         ) AS profile
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1`,
        [group.id],
      );
      group.members = members;
    }

    res.json({ data: groups });
  } catch (err: any) {
    console.error('[Groups] List error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/groups ────────────────────────────────────────────────────────
router.post(
  '/',
  validate([
    body('name').isString().trim().notEmpty(),
    body('description').optional({ nullable: true }).isString(),
    body('icon').optional().isString(),
    body('color').optional().isString(),
  ]),
  async (req, res) => {
    try {
      const { name, description, icon, color } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create the group
        const { rows } = await client.query(
          `INSERT INTO family_groups (name, description, icon, color, created_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [name, description || null, icon || '👨‍👩‍👧‍👦', color || '#6366F1', req.userId],
        );
        const group = rows[0];

        // Add creator as admin member
        await client.query(
          `INSERT INTO group_members (group_id, user_id, role)
           VALUES ($1, $2, 'admin')`,
          [group.id, req.userId],
        );

        await client.query('COMMIT');
        res.status(201).json({ data: group });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[Groups] Create error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── POST /api/groups/join ───────────────────────────────────────────────────
router.post(
  '/join',
  validate([
    body('invite_code').isString().trim().notEmpty(),
  ]),
  async (req, res) => {
    try {
      const { invite_code } = req.body;
      const { rows } = await pool.query(
        'SELECT join_group_by_invite_code($1, $2) AS group_id',
        [invite_code, req.userId],
      );
      res.json({ data: { group_id: rows[0].group_id } });
    } catch (err: any) {
      if (err.message?.includes('Invalid invite code')) {
        res.status(404).json({ error: 'Invalid invite code' });
        return;
      }
      console.error('[Groups] Join error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
