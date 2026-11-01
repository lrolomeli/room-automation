const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');

const DATA_DIR = '/tmp/home-hub-test-data';
fs.rmSync(DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

process.env.NODE_ENV = 'test';
process.env.PORT = '3100';
process.env.MQTT_URL = 'mqtt://127.0.0.1:1884';
process.env.ESP_HOST = '127.0.0.1';
process.env.ESP_PORT = '18080';
process.env.DATA_DIR = DATA_DIR;
process.env.DASHBOARD_PASSWORD = 'test1234';
process.env.SESSION_SECRET = 'test-secret';
process.env.AUTH_DISABLED = '0';
process.env.AUTOMATION_MODE = 'live';
process.env.AUTOMATIONS_FILE = path.join(__dirname, '../config/automations.example.yaml');
process.env.CLIMATE_TZ = 'America/Mexico_City';
process.env.LOG_LEVEL = 'error';

const { Aedes } = require('aedes');
const mqtt = require('mqtt');
const WebSocket = require('ws');

let aedes = null;
let broker = null;
let wsClient = null;

const esp = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url.startsWith('/api/sensors')) {
    res.end(JSON.stringify({ temperature: 24.5, humidity: 55, unit: 'celsius', status: 'ok' }));
    return;
  }
  if (req.url.startsWith('/api/ac/set')) {
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not found' }));
});

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
          features: [{ type: 'binary', property: 'occupancy', access: 1, value_on: true }],
        },
      ],
    },
  },
];

const base = 'http://127.0.0.1:3100';
let cookie = '';
let client = null;
let hub = null;

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

async function waitFor(predicate, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('timeout esperando condición');
}

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

after(async () => {
  if (wsClient) wsClient.close();
  if (client) client.end(true);
  if (hub) await hub.stop();
  if (broker) await new Promise((resolve) => broker.close(resolve));
  await new Promise((resolve) => esp.close(resolve));
  if (aedes) {
    await new Promise((resolve) => aedes.close(resolve));
  }
});

test('flujo completo: MQTT, automatización, comandos y ESP32 simulado', async () => {
  aedes = await Aedes.createBroker();
  broker = net.createServer(aedes.handle);
  await listen(broker, 1884);
  await listen(esp, 18080);

  hub = require('../server/index');
  await hub.start();
  if (!hub.server.listening) {
    await new Promise((resolve) => hub.server.once('listening', resolve));
  }

  client = mqtt.connect('mqtt://127.0.0.1:1884', { connectTimeout: 2000 });
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
  });

  const commands = [];
  client.on('message', (topic, payload) => {
    commands.push({ topic, payload: JSON.parse(payload.toString()) });
  });
  client.subscribe('zigbee2mqtt/relay-1/set');

  client.publish('zigbee2mqtt/bridge/devices', JSON.stringify(DEVICES), { retain: true });
  client.publish('zigbee2mqtt/relay-1', JSON.stringify({ state: 'OFF', linkquality: 50 }), { retain: true });
  client.publish('zigbee2mqtt/motion-1', JSON.stringify({ occupancy: false, linkquality: 80 }), { retain: true });

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password: 'test1234' }),
  });
  assert.equal(login.response.status, 200);
  cookie = login.response.headers.get('set-cookie').split(';')[0];

  const wsMessages = [];
  wsClient = new WebSocket('ws://127.0.0.1:3100/ws', { headers: { Cookie: cookie } });
  wsClient.on('message', (raw) => {
    try {
      wsMessages.push(JSON.parse(raw.toString()));
    } catch {
      /* ignorar */
    }
  });
  await new Promise((resolve, reject) => {
    wsClient.once('open', resolve);
    wsClient.once('error', reject);
  });
  await waitFor(() => wsMessages.some((message) => message.type === 'snapshot'));

  const snapshot = await waitFor(async () => {
    const { body } = await api('/api/state');
    if (body?.zigbee?.devices?.length === 2) return body;
    return null;
  });

  const relay = snapshot.zigbee.devices.find((device) => device.name === 'relay-1');
  const sensor = snapshot.zigbee.devices.find((device) => device.name === 'motion-1');
  assert.equal(relay.kind, 'relay');
  assert.equal(relay.state, 'OFF');
  assert.equal(sensor.kind, 'sensor');
  assert.equal(sensor.readings.occupancy, false);

  // Automatización movimiento -> relé
  client.publish('zigbee2mqtt/motion-1', JSON.stringify({ occupancy: true, linkquality: 80 }));
  await waitFor(() => commands.some((entry) => entry.topic === 'zigbee2mqtt/relay-1/set' && entry.payload.state === 'ON'));
  client.publish('zigbee2mqtt/relay-1', JSON.stringify({ state: 'ON', linkquality: 50 }));
  await waitFor(async () => {
    const { body } = await api('/api/state');
    return body?.zigbee?.devices?.find((device) => device.name === 'relay-1')?.state === 'ON';
  });
  await waitFor(() =>
    wsMessages.some(
      (message) =>
        message.type === 'zigbee.device' &&
        message.data?.name === 'relay-1' &&
        message.data?.state === 'ON',
    ),
  );

  // Comando directo por REST
  const command = await api(`/api/zigbee/devices/${relay.ieee}/command`, {
    method: 'POST',
    body: JSON.stringify({ state: 'OFF' }),
  });
  assert.equal(command.response.status, 202);
  assert.equal(command.body.desired, 'OFF');
  await waitFor(() => commands.some((entry) => entry.topic === 'zigbee2mqtt/relay-1/set' && entry.payload.state === 'OFF'));

  // Integración de la habitación
  const room = await waitFor(async () => {
    const { body } = await api('/api/room/status');
    return body?.sensor ? body : null;
  });
  assert.equal(room.sensor.temperature, 24.5);
  assert.equal(room.sensor.humidity, 55);

  const ac = await api('/api/room/ac', {
    method: 'POST',
    body: JSON.stringify({ power: true, temp: 23, mode: 'cool', fan: 'med' }),
  });
  assert.equal(ac.response.status, 200);
  assert.equal(ac.body.state.power, true);
  assert.equal(ac.body.state.temp, 23);

  const timer = await api('/api/room/timer/start', {
    method: 'POST',
    body: JSON.stringify({ minutes: 5, loop: false }),
  });
  assert.equal(timer.response.status, 200);
  assert.equal(timer.body.status.active, true);

  const stopped = await api('/api/room/timer/stop', { method: 'POST' });
  assert.equal(stopped.body.status.active, false);

  const history = await api('/api/room/history?range=24h');
  assert.ok(Array.isArray(history.body));
  assert.ok(history.body.length >= 1);

  const health = await api('/api/health');
  assert.equal(health.body.ok, true);
  assert.equal(health.body.mqtt.connected, true);
  assert.equal(health.body.devices, 2);
});
