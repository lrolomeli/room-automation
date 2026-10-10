const express = require('express');
const session = require("express-session");

const limiter = require('./middleware/rateLimiter');
const { sessionMiddleware } = require("./middleware/auth");

const authRoutes = require("./routes/auth-routes");
const sensorRoutes = require('./routes/sensor-routes');
const irRoutes = require('./routes/ir-routes');
const climateRoutes = require('./routes/climate-routes');
const acTimerRoutes = require('./routes/ac-timer-routes');

const app = express();

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

app.use(limiter);
app.use(express.json());

// 🔐 session setup
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: COOKIE_SECURE,
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

// =========================
// ✅ PUBLIC ROUTES
// =========================
app.use('/api/auth', authRoutes);
app.use('/api/sensors', sensorRoutes);

// =========================
// 🔒 DEFAULT DENY
// =========================
app.use('/api', sessionMiddleware);

// =========================
// 🔒 PROTECTED ROUTES
// =========================
app.use('/api/ir', irRoutes);
app.use('/api/climate', climateRoutes);
app.use('/api/ac-timer', acTimerRoutes);

module.exports = app;
