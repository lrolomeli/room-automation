const { Router } = require('express');
const climate = require('../automation/climate');

const router = Router();

router.get('/status', (req, res) => {
  res.json(climate.status());
});

router.post('/enabled', (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  const value = climate.setEnabled(enabled);
  res.json({ ok: true, enabled: value, status: climate.status() });
});

router.get('/log', (req, res) => {
  res.json(climate.getLog());
});

router.post('/run-now', async (req, res) => {
  const result = await climate.tick(new Date(), { force: true });
  res.json({ ok: true, result });
});

module.exports = router;
