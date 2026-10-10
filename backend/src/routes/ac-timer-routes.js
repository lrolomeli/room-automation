const { Router } = require('express');
const acTimer = require('../automation/ac-timer');

const router = Router();

router.get('/status', (req, res) => {
  res.json(acTimer.status());
});

router.post('/start', async (req, res) => {
  const { minutes, loop, state } = req.body || {};

  const n = Math.round(Number(minutes));
  if (!Number.isFinite(n) || n < 1) {
    return res.status(400).json({ error: 'minutes must be a positive integer' });
  }

  try {
    const status = await acTimer.start({ minutes: n, loop: !!loop, state });
    res.json({ ok: true, status });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'ESP unreachable', detail: err.message });
  }
});

router.post('/stop', async (req, res) => {
  const status = await acTimer.stop();
  res.json({ ok: true, status });
});

module.exports = router;
