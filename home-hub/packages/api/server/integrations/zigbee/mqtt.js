const crypto = require('crypto');
const mqtt = require('mqtt');
const config = require('../../config');
const logger = require('../../logger');
const bus = require('../../bus');
const registry = require('./registry');

const COMMAND_TIMEOUT_MS = 3000;
const pending = new Map();

let client = null;
let connected = false;
let stopping = false;
let lastErrorLogAt = 0;

function parseJson(buffer) {
  try {
    return JSON.parse(buffer.toString());
  } catch {
    return null;
  }
}

function handleMessage(topic, buffer) {
  const base = `${config.z2mBaseTopic}/`;
  if (!topic.startsWith(base)) return;
  const rest = topic.slice(base.length);

  if (rest === 'bridge/devices') {
    const list = parseJson(buffer);
    if (Array.isArray(list)) {
      registry.applyBridgeDevices(list);
      bus.emit('zigbee.devices', registry.listDevices());
    }
    return;
  }

  if (rest === 'bridge/state') {
    registry.setBridgeState(buffer.toString());
    bus.emit('zigbee.bridge', registry.health());
    return;
  }

  if (rest === 'bridge/info') {
    registry.setVersion(parseJson(buffer));
    bus.emit('zigbee.bridge', registry.health());
    return;
  }

  if (rest.startsWith('bridge/')) return;

  const slash = rest.indexOf('/');
  if (slash === -1) {
    const payload = parseJson(buffer);
    if (!payload || typeof payload !== 'object') return;
    const result = registry.applyState(rest, payload);
    if (!result) return;

    const pendingCommand = pending.get(result.device.ieee);
    if (pendingCommand && pendingCommand.desired === result.device.state) {
      clearTimeout(pendingCommand.timer);
      pending.delete(result.device.ieee);
      bus.emit('zigbee.command', {
        commandId: pendingCommand.commandId,
        ieee: result.device.ieee,
        name: result.device.name,
        status: 'confirmed',
        state: result.device.state,
      });
    }

    // Un pulsador puede mandar la misma action varias veces; aunque
    // `changed` sea false, hay que emitir para que la regla dispare.
    const hasAction = Object.prototype.hasOwnProperty.call(payload, 'action');
    if (result.changed || hasAction) {
      bus.emit('zigbee.device', result.device);
      bus.emit('zigbee.device.update', { ...result, payload });
    }
    return;
  }

  const name = rest.slice(0, slash);
  const sub = rest.slice(slash + 1);
  if (sub === 'availability') {
    const device = registry.applyAvailability(name, parseJson(buffer) ?? buffer.toString());
    bus.emit('zigbee.device', device);
  }
}

function connect() {
  if (client) return client;
  const options = {
    reconnectPeriod: 2000,
    connectTimeout: 10000,
    clean: true,
    clientId: `home-hub-${crypto.randomBytes(4).toString('hex')}`,
  };
  if (config.mqttUsername) {
    options.username = config.mqttUsername;
    options.password = config.mqttPassword;
  }

  logger.info(`connecting to MQTT ${config.mqttUrl}`);
  client = mqtt.connect(config.mqttUrl, options);

  client.on('connect', () => {
    connected = true;
    lastErrorLogAt = 0;
    registry.setBrokerConnected(true);
    bus.emit('zigbee.bridge', registry.health());
    logger.info('MQTT connected');
    client.subscribe(`${config.z2mBaseTopic}/#`, { qos: 0 }, (err) => {
      if (err) logger.error('MQTT subscribe failed:', err.message);
    });
  });

  client.on('reconnect', () => logger.warn('MQTT reconnecting...'));

  client.on('close', () => {
    if (!connected) return;
    connected = false;
    registry.setBrokerConnected(false);
    bus.emit('zigbee.bridge', registry.health());
    logger.warn('MQTT disconnected');
  });

  client.on('error', (err) => {
    const now = Date.now();
    if (now - lastErrorLogAt > 30000) {
      lastErrorLogAt = now;
      logger.error('MQTT error:', err.message);
    }
  });
  client.on('message', handleMessage);

  return client;
}

function isConnected() {
  return connected;
}

function publishCommand(deviceId, state) {
  const device = registry.getById(deviceId);
  if (!device) {
    const err = new Error('Dispositivo no encontrado');
    err.statusCode = 404;
    throw err;
  }
  if (!device.controllable) {
    const err = new Error('El dispositivo no es controlable');
    err.statusCode = 400;
    throw err;
  }
  if (!['ON', 'OFF'].includes(state)) {
    const err = new Error('Estado inválido');
    err.statusCode = 400;
    throw err;
  }
  if (!connected || !client) {
    const err = new Error('MQTT desconectado');
    err.statusCode = 503;
    throw err;
  }

  const commandId = crypto.randomUUID();

  if (device.state === state) {
    bus.emit('zigbee.command', {
      commandId,
      ieee: device.ieee,
      name: device.name,
      status: 'confirmed',
      state,
      already: true,
    });
    return { commandId, ieee: device.ieee, name: device.name, desired: state, already: true };
  }

  const previous = pending.get(device.ieee);
  if (previous) clearTimeout(previous.timer);

  const topic = `${config.z2mBaseTopic}/${device.name}/set`;
  const payload = JSON.stringify({ state });

  client.publish(topic, payload, { qos: 0, retain: false }, (err) => {
    if (err) {
      logger.error(`MQTT publish failed for ${device.name}:`, err.message);
      const entry = pending.get(device.ieee);
      if (entry) clearTimeout(entry.timer);
      pending.delete(device.ieee);
      bus.emit('zigbee.command', {
        commandId,
        ieee: device.ieee,
        name: device.name,
        status: 'error',
        error: err.message,
      });
    }
  });

  const timer = setTimeout(() => {
    const entry = pending.get(device.ieee);
    if (!entry || entry.commandId !== commandId) return;
    pending.delete(device.ieee);
    bus.emit('zigbee.command', {
      commandId,
      ieee: device.ieee,
      name: device.name,
      status: 'timeout',
      desired: state,
      state: registry.getById(device.ieee)?.state,
    });
  }, COMMAND_TIMEOUT_MS);

  pending.set(device.ieee, {
    commandId,
    desired: state,
    deviceName: device.name,
    timer,
    sentAt: Date.now(),
  });

  bus.emit('zigbee.command', {
    commandId,
    ieee: device.ieee,
    name: device.name,
    status: 'sent',
    desired: state,
  });

  return { commandId, ieee: device.ieee, name: device.name, desired: state };
}

function health() {
  return {
    connected,
    pending: pending.size,
    ...registry.health(),
  };
}

function disconnect() {
  stopping = true;
  for (const entry of pending.values()) clearTimeout(entry.timer);
  pending.clear();
  if (client) client.end(true);
  client = null;
  connected = false;
}

// Las automatizaciones piden comandos por el bus para evitar dependencias circulares.
bus.on('zigbee.command.request', ({ deviceId, state, source }) => {
  try {
    const result = publishCommand(deviceId, state);
    logger.info(`automation ${source || '?'} -> ${deviceId} ${state}`);
    bus.emit('automation.command', { ...result, source });
  } catch (err) {
    logger.warn(`automation ${source || '?'} failed:`, err.message);
    bus.emit('automation.command', {
      deviceId,
      state,
      source,
      status: 'error',
      error: err.message,
    });
  }
});

module.exports = {
  connect,
  disconnect,
  publishCommand,
  isConnected,
  health,
};
