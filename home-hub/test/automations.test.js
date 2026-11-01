const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

process.env.AUTOMATION_MODE = 'shadow';
process.env.AUTOMATIONS_FILE = path.join(__dirname, '../config/automations.example.yaml');

const bus = require('../server/bus');
const registry = require('../server/integrations/zigbee/registry');
const automations = require('../server/integrations/zigbee/automations');

const DEVICES = [
  {
    ieee_address: '0x0000000000000001',
    friendly_name: 'relay-1',
    type: 'Router',
    definition: {
      exposes: [
        {
          type: 'switch',
          features: [
            { type: 'binary', property: 'state', access: 7, value_on: 'ON', value_off: 'OFF' },
          ],
        },
      ],
    },
  },
  {
    ieee_address: '0x0000000000000002',
    friendly_name: 'motion-1',
    type: 'EndDevice',
    definition: {
      exposes: [
        {
          type: 'occupancy',
          features: [{ type: 'binary', property: 'occupancy', access: 1, value_on: true }],
        },
      ],
    },
  },
];

test('carga las 4 reglas y dispara en modo shadow sin publicar comandos', () => {
  registry.applyBridgeDevices(DEVICES);
  automations.init();

  const status = automations.status();
  assert.equal(status.rules.length, 4);
  assert.equal(status.mode, 'shadow');

  const update = registry.applyState('motion-1', { occupancy: true, linkquality: 90 });
  bus.emit('zigbee.device.update', update);

  const after = automations.status();
  assert.ok(after.log.length > 0);
  assert.ok(after.log.some((entry) => String(entry.detail || '').includes('[shadow]')));
  assert.ok(after.log.some((entry) => String(entry.detail || '').includes('relay-1 -> ON')));
});
