module.exports = function adminOrAuthorityAuth(req, res, next) {
  const adminSecret     = req.headers['x-admin-secret'];
  const authoritySecret = req.headers['x-authority-secret'];

  if (adminSecret === process.env.ADMIN_SECRET) {
    req.rol = 'admin';
    return next();
  }
  if (authoritySecret === process.env.AUTORIDAD_SECRET) {
    req.rol = 'autoridad';
    return next();
  }
  return res.status(401).json({ error: 'No autorizado' });
};