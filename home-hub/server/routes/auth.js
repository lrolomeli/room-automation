const { Router } = require('express');
const auth = require('../auth');
const config = require('../config');

const router = Router();

router.post('/login', auth.loginRateLimit, (req, res) => {
  const { username, password } = req.body || {};
  if (!auth.checkCredentials(username, password)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  auth.clearLoginAttempts(req);
  const { token } = auth.createSession(username);
  auth.setSessionCookie(res, token);
  return res.json({ ok: true, authenticated: true });
});

router.post('/logout', (req, res) => {
  auth.clearSessionCookie(res);
  return res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (config.authDisabled) return res.json({ authenticated: true, user: { username: 'dev' } });
  const session = auth.getSession(req);
  if (!session) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true, user: { username: session.sub } });
});

module.exports = router;
