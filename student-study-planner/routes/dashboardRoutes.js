const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const router = express.Router();

router.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

router.get('/dashboard', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.user.id;
  const [subjects, taskStats, upcoming, sessions] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM subjects WHERE user_id = $1', [userId]),
    pool.query(`SELECT
      COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
      COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
      COUNT(*)::int AS total
      FROM tasks WHERE user_id = $1`, [userId]),
    pool.query(`SELECT t.*, s.name AS subject_name FROM tasks t
      LEFT JOIN subjects s ON s.id = t.subject_id AND s.user_id = t.user_id
      WHERE t.user_id = $1 AND t.status <> 'Completed'
      ORDER BY t.due_date ASC NULLS LAST LIMIT 5`, [userId]),
    pool.query(`SELECT ss.*, s.name AS subject_name FROM study_sessions ss
      LEFT JOIN subjects s ON s.id = ss.subject_id AND s.user_id = ss.user_id
      WHERE ss.user_id = $1 AND ss.study_date >= CURRENT_DATE
      ORDER BY ss.study_date, ss.start_time LIMIT 5`, [userId])
  ]);
  res.render('dashboard', {
    title: 'Dashboard',
    subjectCount: subjects.rows[0].count,
    stats: taskStats.rows[0],
    upcoming: upcoming.rows,
    sessions: sessions.rows
  });
}));

module.exports = router;
