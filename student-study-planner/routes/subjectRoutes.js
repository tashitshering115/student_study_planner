const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT s.*, COUNT(t.id)::int AS task_count
     FROM subjects s LEFT JOIN tasks t ON t.subject_id = s.id AND t.user_id = s.user_id
     WHERE s.user_id = $1 GROUP BY s.id ORDER BY s.name`, [req.session.user.id]);
  res.render('subjects/index', { title: 'My subjects', subjects: result.rows });
}));

router.get('/new', (req, res) => res.render('subjects/form', { title: 'Add subject', subject: {}, errors: [], action: '/subjects' }));

router.post('/', body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Subject name must be 2–100 characters.'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).render('subjects/form', { title: 'Add subject', subject: req.body, errors: errors.array(), action: '/subjects' });
    try {
      await pool.query('INSERT INTO subjects (user_id, name, color, description) VALUES ($1,$2,$3,$4)',
        [req.session.user.id, req.body.name, req.body.color || '#4f46e5', req.body.description || null]);
      req.session.flash = { type: 'success', message: 'Subject added.' };
      res.redirect('/subjects');
    } catch (err) {
      if (err.code === '23505') return res.status(409).render('subjects/form', { title: 'Add subject', subject: req.body, errors: [{ msg: 'You already have a subject with that name.' }], action: '/subjects' });
      throw err;
    }
  }));

router.get('/:id/edit', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM subjects WHERE id=$1 AND user_id=$2', [req.params.id, req.session.user.id]);
  if (!result.rowCount) return res.status(404).render('404', { title: 'Subject not found' });
  res.render('subjects/form', { title: 'Edit subject', subject: result.rows[0], errors: [], action: `/subjects/${req.params.id}?_method=PUT` });
}));

router.put('/:id', body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Subject name must be 2–100 characters.'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).render('subjects/form', { title: 'Edit subject', subject: { ...req.body, id: req.params.id }, errors: errors.array(), action: `/subjects/${req.params.id}?_method=PUT` });
    const result = await pool.query('UPDATE subjects SET name=$1,color=$2,description=$3 WHERE id=$4 AND user_id=$5',
      [req.body.name, req.body.color || '#4f46e5', req.body.description || null, req.params.id, req.session.user.id]);
    if (!result.rowCount) return res.status(404).render('404', { title: 'Subject not found' });
    req.session.flash = { type: 'success', message: 'Subject updated.' };
    res.redirect('/subjects');
  }));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM subjects WHERE id=$1 AND user_id=$2', [req.params.id, req.session.user.id]);
  req.session.flash = { type: 'success', message: 'Subject deleted. Related tasks and sessions are kept without a subject.' };
  res.redirect('/subjects');
}));
module.exports = router;
