const test = require('node:test');
const assert = require('node:assert/strict');

const registry = require('../server/integrations/zigbee/registry');

const DEVICES = [
  {
    ieee_address: '0x0000000000000001',
    friendly_name: 'relay-1',
    type: 'Router',
    definition: {
      model: 'Relay',
      vendor: 'Test',
      exposes: [
        {
          type: 'switch',
          features: [
            { type: 'binary', property: 'state', access: 7, value_on: 'ON', value_off: 'OFF' },
            { type: 'numeric', property: 'linkquality', access: 1 },
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
      model: 'Motion',
      vendor: 'Test',
      exposes: [
        {
          type: 'occupancy',
          features: [
            { type: 'binary', property: 'occupancy', access: 1, value_on: true, value_off: false },
            { type: 'enum', property: 'illumination', access: 1, values: ['bright', 'dark'] },
            { type: 'numeric', property: 'linkquality', access: 1 },
          ],
        },
      ],
    },
  },
  {
    ieee_address: '0x0000000000000000',
    friendly_name: 'Coordinator',
    type: 'Coordinator',
    definition: {},
  },
];

test('registra solo dispositivos válidos y clasifica relés y sensores', () => {
  registry.applyBridgeDevices(DEVICES);
  const devices = registry.listDevices();
  assert.equal(devices.length, 2);

  const relay = registry.getByName('relay-1');
  assert.ok(relay);
  assert.equal(relay.kind, 'relay');
  assert.equal(relay.controllable, true);

  const sensor = registry.getByName('motion-1');
  assert.ok(sensor);
  assert.equal(sensor.kind, 'sensor');
  assert.equal(sensor.controllable, false);
});

test('actualiza estado, readings y disponibilidad', () => {
  registry.applyBridgeDevices(DEVICES);
  const result = registry.applyState('relay-1', { state: 'ON', linkquality: 42 });
  assert.ok(result);
  assert.equal(result.device.state, 'ON');
  assert.equal(result.device.linkquality, 42);
  assert.equal(result.changed, true);

  const sensorResult = registry.applyState('motion-1', {
    occupancy: true,
    illumination: 'bright',
    linkquality: 100,
  });
  assert.equal(sensorResult.device.readings.occupancy, true);
  assert.equal(sensorResult.device.readings.illumination, 'bright');

  registry.applyAvailability('relay-1', 'offline');
  assert.equal(registry.getByName('relay-1').availability, 'offline');

  const snapshot = registry.snapshot();
  assert.equal(snapshot.devices.length, 2);
});
