const sensors = require('./db/sensors');
const climate = require('./automation/climate');
const acTimer = require('./automation/ac-timer');
const acState = require('./data/ac-state');
const { applyAcState } = require('./services/ac');
const { espRequest } = require('./esp');

const POLL_SLOW_MS = 5 * 60 * 1000;
const POLL_FAST_MS = 60 * 1000;
const CHECK_MS = 30 * 1000;
const TICK_MS = 60 * 1000;

const logger = {
  info: (...args) => console.log('[room]', ...args),
  warn: (...args) => console.warn('[room]', ...args),
  error: (...args) => console.error('[room]', ...args),
};

let bus = null;
let started = false;
let timers = [];
let polling = false;
let lastPollAt = 0;
let lastTickAt = 0;
let lastError = null;

function emit(event, payload) {
  if (bus) bus.emit(event, payload);
}

function latestSensor() {
  const latest = sensors.getLatest();
  if (!latest) return null;
  const ageMs = Date.now() - Date.parse(latest.timestamp);
  return {
    ...latest,
    stale: Number.isFinite(ageMs) ? ageMs > 10 * 60 * 1000 : false,
    ageSeconds: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 1000)) : null,
  };
}

function status() {
  const c = climate.status();
  const sensor = latestSensor() || c.sensor;
  return {
    sensor,
    ac: c.ac,
    timer: acTimer.status(),
    climate: {
      ...c,
      sensor,
    },
    updatedAt: new Date().toISOString(),
  };
}

async function pollSensor() {
  if (polling) return null;
  polling = true;
  try {
    const parsed = await espRequest('/api/sensors');
    const temperature = Number(parsed.temperature);
    const humidity = Number(parsed.humidity);
    if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
      throw new Error('ESP returned invalid sensor readings');
    }
    const timestamp = new Date().toISOString();
    sensors.insertReading(temperature, humidity, parsed.unit || 'celsius', timestamp, 'auto');
    lastError = null;
    const reading = { temperature, humidity, unit: parsed.unit || 'celsius', timestamp };
    emit('room.sensor', reading);
    return reading;
  } catch (err) {
    lastError = err.message;
    logger.warn('sensor poll failed:', err.message);
    return null;
  } finally {
    polling = false;
    // También en error, para no martillear al ESP32 cada 30 s.
    lastPollAt = Date.now();
  }
}

async function tick() {
  if (lastTickAt && Date.now() - lastTickAt < TICK_MS - 500) return;
  lastTickAt = Date.now();
  try {
    if (climate.getConfig().enabled) {
      await climate.tick().catch((err) => logger.warn('climate tick failed:', err.message));
    }
    await acTimer.tick().catch((err) => logger.warn('timer tick failed:', err.message));
  } finally {
    emit('room.status', status());
  }
}

function schedule() {
  if (started) return;
  started = true;

  timers.push(setInterval(async () => {
    const interval = climate.getConfig().enabled ? POLL_FAST_MS : POLL_SLOW_MS;
    if (!lastPollAt || Date.now() - lastPollAt >= interval) {
      await pollSensor();
      emit('room.status', status());
    }
  }, CHECK_MS));

  timers.push(setInterval(() => {
    tick().catch((err) => logger.warn('room tick failed:', err.message));
  }, TICK_MS));

  emit('room.status', status());
}

async function init(eventBus) {
  bus = eventBus;
  await sensors.init();
  schedule();
  await pollSensor();
  emit('room.status', status());
  return status();
}

function stop() {
  for (const timer of timers) clearInterval(timer);
  timers = [];
  started = false;
}

async function setAc(partial) {
  await applyAcState(partial || {});
  if (acTimer.status().active) {
    await acTimer.stop({ turnOff: false });
  }
  climate.noteManualOverride();
  emit('room.status', status());
  // El frontend espera el mismo formato que /api/room/status (valid, *_raw).
  return acState.serialize();
}

async function startTimer(options) {
  const timer = await acTimer.start(options || {});
  emit('room.status', status());
  return timer;
}

async function stopTimer(options) {
  const timer = await acTimer.stop(options || {});
  emit('room.status', status());
  return timer;
}

function setClimateEnabled(enabled) {
  const value = climate.setEnabled(enabled);
  emit('room.status', status());
  return value;
}

async function runClimateNow() {
  const result = await climate.tick(new Date(), { force: true });
  emit('room.status', status());
  return result;
}

function history(range = '24h') {
  const hoursMap = { '1h': 1, '6h': 6, '12h': 12, '24h': 24, '7d': 168, '30d': 720 };
  const hours = hoursMap[range] || 24;
  return sensors.getRange(hours);
}

function stats(date) {
  const dateStr = date || new Date().toISOString().slice(0, 10);
  const row = sensors.getDailyStats(dateStr);
  if (!row || row.sampleCount === 0) return { error: 'No data for this date', date: dateStr };
  return {
    ...row,
    date: dateStr,
    minTemp: Number(row.minTemp.toFixed(1)),
    maxTemp: Number(row.maxTemp.toFixed(1)),
    avgTemp: Number(row.avgTemp.toFixed(1)),
    minHumidity: Number(row.minHumidity.toFixed(1)),
    maxHumidity: Number(row.maxHumidity.toFixed(1)),
    avgHumidity: Number(row.avgHumidity.toFixed(1)),
  };
}

function heatmap(month) {
  return sensors.getMonthlyHeatmap(month || new Date().toISOString().slice(0, 7));
}

function trends(days = 30) {
  return {
    daily: sensors.getTrendAnalysis(Number(days) || 30),
    anomalies: sensors.getAnomalies(Number(days) || 30),
  };
}

function health() {
  return {
    started,
    polling,
    lastPollAt: lastPollAt ? new Date(lastPollAt).toISOString() : null,
    lastError,
    sensor: latestSensor(),
  };
}

module.exports = {
  init,
  stop,
  pollSensor,
  status,
  latestSensor,
  setAc,
  startTimer,
  stopTimer,
  setClimateEnabled,
  runClimateNow,
  history,
  stats,
  heatmap,
  trends,
  health,
  climate,
  acTimer,
  acState,
  sensors,
};
