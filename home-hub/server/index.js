const path = require('path');
const fs = require('fs');
const http = require('http');

const config = require('./config');

// Los módulos de la habitación leen DATA_DIR/ESP_HOST/CLIMATE_TZ al cargarse.
process.env.DATA_DIR = process.env.DATA_DIR || config.dataDir;
if (!process.env.ESP_HOST && config.espHost) process.env.ESP_HOST = config.espHost;
process.env.CLIMATE_TZ = process.env.CLIMATE_TZ || config.climateTz;

const express = require('express');
const logger = require('./logger');
const bus = require('./bus');
const auth = require('./auth');
const realtime = require('./realtime');
const state = require('./state');

const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const stateRoutes = require('./routes/state');
const zigbeeRoutes = require('./routes/zigbee');
const roomRoutes = require('./routes/room');
const automationsRoutes = require('./routes/automations');

const mqtt = require('./integrations/zigbee/mqtt');
const registry = require('./integrations/zigbee/registry');
const automations = require('./integrations/zigbee/automations');
const room = require('./integrations/room');

if (!config.authDisabled && (!config.dashboardPassword || !config.sessionSecret)) {
  logger.error('Faltan DASHBOARD_PASSWORD y/o SESSION_SECRET. El hub no arranca.');
  logger.error('Copia home-hub/.env.example a home-hub/.env y define valores seguros.');
  process.exit(1);
}

if (config.authDisabled) {
  logger.warn('AUTH_DISABLED=1: la autenticación está desactivada. No usar en producción.');
}

if (
  config.dashboardPassword === 'change-me-please' ||
  config.sessionSecret === 'change-me-to-a-long-random-string'
) {
  logger.warn('Estás usando credenciales de ejemplo. Cámbialas antes de exponer el hub.');
}

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);
app.use(auth.securityHeaders);
app.use(express.json({ limit: '2mb' }));
app.use(auth.originGuard);

app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api', auth.requireAuth);
app.use('/api/state', stateRoutes);
app.use('/api/zigbee', zigbeeRoutes);
app.use('/api/room', roomRoutes);
app.use('/api/automations', automationsRoutes);

const webDist = path.join(__dirname, '../dist/web');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    return res.sendFile(path.join(webDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).send('home-hub API. Ejecuta "npm run build" para generar el frontend.');
  });
}

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  return res.status(404).send('Not found');
});

app.use((err, req, res, next) => {
  logger.error('request error:', err.message);
  if (res.headersSent) return next(err);
  return res.status(err.statusCode || 500).json({ error: err.message || 'Internal error' });
});

const server = http.createServer(app);
realtime.init(server, { getSnapshot: () => state.snapshot() });

server.on('error', (err) => {
  logger.error('HTTP server error:', err.message);
  process.exit(1);
});

bus.on('zigbee.device', (device) => realtime.broadcast('zigbee.device', device));
bus.on('zigbee.devices', (devices) => realtime.broadcast('zigbee.devices', devices));
bus.on('zigbee.bridge', (bridge) => realtime.broadcast('zigbee.bridge', bridge));
bus.on('zigbee.command', (command) => realtime.broadcast('zigbee.command', command));
bus.on('room.status', (status) => realtime.broadcast('room.status', status));
bus.on('room.sensor', (reading) => realtime.broadcast('room.sensor', reading));
bus.on('automation.log', (entry) => realtime.broadcast('automation.log', entry));
bus.on('automation.command', (command) => realtime.broadcast('automation.command', command));

async function start() {
  automations.init();
  mqtt.connect();

  // El servidor HTTP arranca primero: si el ESP32 tarda en responder,
  // el login y la pestaña Casa siguen disponibles.
  server.listen(config.port, () => {
    logger.info(`home-hub listening on :${config.port}`);
    logger.info(`MQTT: ${config.mqttUrl} | ESP32: ${config.espHost || '(default)'}:${config.espPort}`);
  });

  try {
    await room.init(bus);
  } catch (err) {
    logger.error('room integration init failed:', err.message);
  }
}

async function stop() {
  realtime.close();
  mqtt.disconnect();
  room.stop();
  await new Promise((resolve) => {
    if (!server.listening) return resolve();
    server.close(() => resolve());
  });
}

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`received ${signal}, shutting down`);
  stop()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  start().catch((err) => {
    logger.error('fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = { app, server, start, stop };
