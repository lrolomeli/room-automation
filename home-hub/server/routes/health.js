const { Router } = require('express');
const mqtt = require('../integrations/zigbee/mqtt');
const registry = require('../integrations/zigbee/registry');
const room = require('../integrations/room');
const pkg = require('../../package.json');

const router = Router();

router.get('/', (req, res) => {
  res.json({
    ok: true,
    name: pkg.name,
    version: pkg.version,
    uptime: process.uptime(),
    devices: registry.listDevices().length,
    mqtt: mqtt.health(),
    room: room.health(),
  });
});

module.exports = router;
