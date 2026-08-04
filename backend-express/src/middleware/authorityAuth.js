module.exports = (req, res, next) => {
  const secret = req.headers['x-authority-secret'];
  if (!secret || secret !== process.env.AUTORIDAD_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};