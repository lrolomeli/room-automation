const sessionMiddleware = (req, res, next) => {
  // allow if logged in
  if (req.session && req.session.user) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
};

module.exports = { sessionMiddleware };