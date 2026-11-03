const config = require('./config');
const registry = require('./integrations/zigbee/registry');
const automations = require('./integrations/zigbee/automations');
const mqtt = require('./integrations/zigbee/mqtt');
const room = require('./integrations/room');

function snapshot() {
  const zigbee = registry.snapshot();
  let roomStatus = null;
  try {
    roomStatus = room.status();
  } catch (err) {
    roomStatus = { error: err.message };
  }
  return {
    serverTime: new Date().toISOString(),
    bridge: {
      ...zigbee.bridge,
      mqttConnected: mqtt.isConnected(),
    },
    zigbee: {
      devices: zigbee.devices,
    },
    room: roomStatus,
    automations: automations.status(),
    meta: {
      climateTz: config.climateTz,
      automationMode: automations.getMode(),
    },
  };
}

module.exports = { snapshot };
