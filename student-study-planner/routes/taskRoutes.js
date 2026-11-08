const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const router = express.Router();
router.use(requireAuth);

async function getSubjects(userId) {
  return (await pool.query('SELECT id, name FROM subjects WHERE user_id=$1 ORDER BY name', [userId])).rows;
}
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(`SELECT t.*, s.name AS subject_name FROM tasks t
    LEFT JOIN subjects s ON s.id=t.subject_id AND s.user_id=t.user_id
    WHERE t.user_id=$1 ORDER BY
    CASE t.status WHEN 'Pending' THEN 1 WHEN 'In Progress' THEN 2 ELSE 3 END,
    t.due_date ASC NULLS LAST, t.created_at DESC`, [req.session.user.id]);
  res.render('tasks/index', { title: 'My tasks', tasks: result.rows });
}));
router.get('/new', asyncHandler(async (req, res) => res.render('tasks/form', {
  title: 'Add task', task: {}, subjects: await getSubjects(req.session.user.id), errors: [], action: '/tasks'
})));
router.post('/', body('title').trim().isLength({ min: 2, max: 160 }).withMessage('Task title must be 2–160 characters.'),
  body('priority').isIn(['Low','Medium','High']).withMessage('Choose a valid priority.'),
  body('status').isIn(['Pending','In Progress','Completed']).withMessage('Choose a valid status.'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    const subjects = await getSubjects(req.session.user.id);
    if (!errors.isEmpty()) return res.status(400).render('tasks/form', { title: 'Add task', task: req.body, subjects, errors: errors.array(), action: '/tasks' });
    const subjectId = req.body.subject_id || null;
    if (subjectId) {
      const own = await pool.query('SELECT id FROM subjects WHERE id=$1 AND user_id=$2', [subjectId, req.session.user.id]);
      if (!own.rowCount) return res.status(400).render('tasks/form', { title: 'Add task', task: req.body, subjects, errors: [{msg:'Select one of your own subjects.'}], action:'/tasks' });
    }
    await pool.query(`INSERT INTO tasks (user_id,subject_id,title,description,due_date,priority,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.session.user.id, subjectId, req.body.title, req.body.description || null, req.body.due_date || null, req.body.priority, req.body.status]);
    req.session.flash = { type: 'success', message: 'Task created.' };
    res.redirect('/tasks');
  }));
router.get('/:id/edit', asyncHandler(async (req, res) => {
  const [task, subjects] = await Promise.all([
    pool.query('SELECT * FROM tasks WHERE id=$1 AND user_id=$2', [req.params.id, req.session.user.id]),
    getSubjects(req.session.user.id)
  ]);
  if (!task.rowCount) return res.status(404).render('404', { title: 'Task not found' });
  res.render('tasks/form', { title: 'Edit task', task: task.rows[0], subjects, errors: [], action: `/tasks/${req.params.id}?_method=PUT` });
}));
router.put('/:id', body('title').trim().isLength({ min: 2, max: 160 }).withMessage('Task title must be 2–160 characters.'),
  body('priority').isIn(['Low','Medium','High']).withMessage('Choose a valid priority.'),
  body('status').isIn(['Pending','In Progress','Completed']).withMessage('Choose a valid status.'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    const subjects = await getSubjects(req.session.user.id);
    const task = { ...req.body, id: req.params.id };
    if (!errors.isEmpty()) return res.status(400).render('tasks/form', { title: 'Edit task', task, subjects, errors: errors.array(), action: `/tasks/${req.params.id}?_method=PUT` });
    const subjectId = req.body.subject_id || null;
    if (subjectId) {
      const own = await pool.query('SELECT id FROM subjects WHERE id=$1 AND user_id=$2', [subjectId, req.session.user.id]);
      if (!own.rowCount) return res.status(400).render('tasks/form', { title: 'Edit task', task, subjects, errors: [{msg:'Select one of your own subjects.'}], action:`/tasks/${req.params.id}?_method=PUT` });
    }
    const result = await pool.query(`UPDATE tasks SET subject_id=$1,title=$2,description=$3,due_date=$4,priority=$5,status=$6
      WHERE id=$7 AND user_id=$8`,
      [subjectId, req.body.title, req.body.description || null, req.body.due_date || null, req.body.priority, req.body.status, req.params.id, req.session.user.id]);
    if (!result.rowCount) return res.status(404).render('404', { title: 'Task not found' });
    req.session.flash = { type: 'success', message: 'Task updated.' };
    res.redirect('/tasks');
  }));
router.patch('/:id/complete', asyncHandler(async (req, res) => {
  await pool.query(`UPDATE tasks SET status='Completed' WHERE id=$1 AND user_id=$2`, [req.params.id, req.session.user.id]);
  req.session.flash = { type: 'success', message: 'Task marked as completed.' };
  res.redirect('/tasks');
}));
router.delete('/:id', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2', [req.params.id, req.session.user.id]);
  req.session.flash = { type: 'success', message: 'Task deleted.' };
  res.redirect('/tasks');
}));
module.exports = router;
