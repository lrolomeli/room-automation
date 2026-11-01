const { Router } = require('express');
const registry = require('../integrations/zigbee/registry');
const mqtt = require('../integrations/zigbee/mqtt');

const router = Router();

router.get('/devices', (req, res) => {
  res.json(registry.listDevices());
});

router.get('/bridge', (req, res) => {
  res.json(mqtt.health());
});

router.post('/devices/:id/command', (req, res) => {
  const { state } = req.body || {};
  if (state !== 'ON' && state !== 'OFF') {
    return res.status(400).json({ error: 'state debe ser ON u OFF' });
  }
  try {
    const result = mqtt.publishCommand(req.params.id, state);
    return res.status(202).json({ ok: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
