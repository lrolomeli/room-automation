const crypto = require('crypto');
const config = require('./config');

const COOKIE_NAME = 'hub.sid';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map();

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(body)
    .digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header = '') {
  const result = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function getSessionFromCookieHeader(header) {
  if (config.authDisabled) return { sub: 'dev', exp: Date.now() + 86400000 };
  return verify(parseCookies(header)[COOKIE_NAME]);
}

function getSession(req) {
  return getSessionFromCookieHeader(req.headers.cookie || '');
}

function createSession(username) {
  return {
    token: sign({
      sub: username || config.dashboardUser || 'home',
      exp: Date.now() + config.sessionTtlDays * 86400000,
    }),
  };
}

function setSessionCookie(res, token) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${config.sessionTtlDays * 86400}`,
  ];
  if (config.cookieSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (config.cookieSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function checkCredentials(username, password) {
  if (config.authDisabled) return true;
  if (!config.dashboardPassword) return false;
  return safeEqual(password || '', config.dashboardPassword);
}

function loginRateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.reset) {
    loginAttempts.set(key, { count: 1, reset: now + LOGIN_WINDOW_MS });
    return next();
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  }
  entry.count += 1;
  return next();
}

function clearLoginAttempts(req) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  loginAttempts.delete(key);
}

function requireAuth(req, res, next) {
  if (config.authDisabled) return next();
  const session = getSession(req);
  if (session) {
    req.session = session;
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

function originGuard(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  // Los navegadores modernos envían Origin en peticiones mutantes.
  // Si no viene, se permite (clientes internos / curl), porque la cookie
  // ya es SameSite=Strict y HttpOnly.
  if (!origin) return next();
  try {
    const originHost = new URL(origin).host;
    const host = req.get('x-forwarded-host') || req.get('host');
    if (config.allowedOrigin) {
      const allowed = new URL(config.allowedOrigin).host;
      if (originHost !== allowed && originHost !== host) {
        return res.status(403).json({ error: 'Origin not allowed' });
      }
      return next();
    }
    if (originHost !== host) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    return next();
  } catch {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

module.exports = {
  COOKIE_NAME,
  getSession,
  getSessionFromCookieHeader,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  checkCredentials,
  loginRateLimit,
  clearLoginAttempts,
  requireAuth,
  originGuard,
  securityHeaders,
};
