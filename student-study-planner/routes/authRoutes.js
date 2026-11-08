const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Create account', errors: [], form: {} });
});

router.post('/register',
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),
  body('email').trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match.'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    const form = { name: req.body.name, email: req.body.email };
    if (!errors.isEmpty()) return res.status(400).render('auth/register', { title: 'Create account', errors: errors.array(), form });
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    try {
      const result = await pool.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
        [form.name, form.email, passwordHash]
      );
      req.session.user = result.rows[0];
      req.session.flash = { type: 'success', message: 'Your account has been created. Welcome!' };
      res.redirect('/dashboard');
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).render('auth/register', {
          title: 'Create account', errors: [{ msg: 'That email address is already registered.' }], form
        });
      }
      throw err;
    }
  })
);

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Log in', errors: [], form: {} });
});

router.post('/login',
  body('email').trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').notEmpty().withMessage('Enter your password.'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    const form = { email: req.body.email };
    if (!errors.isEmpty()) return res.status(400).render('auth/login', { title: 'Log in', errors: errors.array(), form });
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [form.email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
      return res.status(401).render('auth/login', {
        title: 'Log in', errors: [{ msg: 'Incorrect email or password.' }], form
      });
    }
    req.session.regenerate(err => {
      if (err) return res.status(500).send('Could not start session.');
      req.session.user = { id: user.id, name: user.name, email: user.email };
      req.session.flash = { type: 'success', message: `Welcome back, ${user.name}!` };
      res.redirect('/dashboard');
    });
  })
);

router.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;
