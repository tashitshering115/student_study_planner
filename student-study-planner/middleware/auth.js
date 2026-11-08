function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: 'warning', message: 'Please log in to continue.' };
    return res.redirect('/login');
  }
  next();
}

module.exports = { requireAuth };
