const { Router } = require('express');
const automations = require('../integrations/zigbee/automations');

const router = Router();

router.get('/', (req, res) => {
  res.json(automations.status());
});

router.post('/reload', (req, res) => {
  res.json({ ok: true, ...automations.reload() });
});

router.post('/mode', (req, res) => {
  const { mode } = req.body || {};
  try {
    const result = automations.setMode(mode);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
});

module.exports = router;
