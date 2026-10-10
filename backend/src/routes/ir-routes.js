const { Router } = require('express');
const acState = require('../data/ac-state');
const { applyAcState } = require('../services/ac');
const climate = require('../automation/climate');
const acTimer = require('../automation/ac-timer');

const router = Router();

router.get('/status', (req, res) => {
  res.json(acState.serialize());
});

router.all('/ac/set', async (req, res) => {
  const partial = { ...(req.query || {}), ...(req.body || {}) };

  try {
    await applyAcState(partial);
  } catch (err) {
    return res.status(503).json({
      ok: false,
      error: 'ESP unreachable',
      detail: err.message,
      state: acState.serialize(),
    });
  }

  if (acTimer.status().active) {
    await acTimer.stop({ turnOff: false });
  }
  climate.noteManualOverride();
  res.json({ ok: true, state: acState.serialize() });
});

module.exports = router;
