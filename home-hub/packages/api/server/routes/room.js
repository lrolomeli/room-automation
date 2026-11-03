const { Router } = require('express');
const room = require('../integrations/room');

const router = Router();

router.get('/status', (req, res) => {
  res.json(room.status());
});

router.get('/sensors/latest', (req, res) => {
  const latest = room.latestSensor();
  if (!latest) return res.status(503).json({ error: 'Sin lecturas todavía' });
  return res.json(latest);
});

router.post('/ac', async (req, res) => {
  try {
    const state = await room.setAc(req.body || {});
    return res.json({ ok: true, state });
  } catch (err) {
    return res.status(err.statusCode || 503).json({
      ok: false,
      error: 'ESP no disponible',
      detail: err.message,
    });
  }
});

router.post('/timer/start', async (req, res) => {
  const { minutes, loop, state } = req.body || {};
  const n = Math.round(Number(minutes));
  if (!Number.isFinite(n) || n < 1) {
    return res.status(400).json({ error: 'minutes debe ser un entero positivo' });
  }
  try {
    const status = await room.startTimer({ minutes: n, loop: !!loop, state });
    return res.json({ ok: true, status });
  } catch (err) {
    return res.status(err.statusCode || 503).json({
      ok: false,
      error: 'ESP no disponible',
      detail: err.message,
    });
  }
});

router.post('/timer/stop', async (req, res) => {
  const status = await room.stopTimer();
  return res.json({ ok: true, status });
});

router.post('/climate/enabled', (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled debe ser booleano' });
  }
  const value = room.setClimateEnabled(enabled);
  return res.json({ ok: true, enabled: value, status: room.status().climate });
});

router.post('/climate/run-now', async (req, res) => {
  const result = await room.runClimateNow();
  return res.json({ ok: true, result, status: room.status() });
});

router.get('/history', (req, res) => {
  res.json(room.history(req.query.range || '24h'));
});

router.get('/stats', (req, res) => {
  res.json(room.stats(req.query.date));
});

router.get('/heatmap', (req, res) => {
  res.json(room.heatmap(req.query.month));
});

router.get('/trends', (req, res) => {
  res.json(room.trends(Number(req.query.days) || 30));
});

module.exports = router;
