//Users/mac/crimemap/backend-express/src/middleware/adminAuth.js
module.exports = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};
