const { WebSocketServer } = require('ws');
const auth = require('./auth');
const logger = require('./logger');

let wss = null;
let heartbeat = null;
let getSnapshot = () => ({});
const clients = new Set();

function init(server, options = {}) {
  getSnapshot = options.getSnapshot || getSnapshot;
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let pathname = '/';
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }
    const session = auth.getSessionFromCookieHeader(req.headers.cookie || '');
    if (!session) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      ws.on('close', () => clients.delete(ws));
      ws.on('error', () => clients.delete(ws));
      clients.add(ws);
      try {
        ws.send(JSON.stringify({
          type: 'snapshot',
          data: getSnapshot(),
          ts: new Date().toISOString(),
        }));
      } catch (err) {
        logger.warn('WS snapshot failed:', err.message);
      }
    });
  });

  heartbeat = setInterval(() => {
    for (const ws of clients) {
      if (ws.isAlive === false) {
        clients.delete(ws);
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        clients.delete(ws);
      }
    }
  }, 30000);
}

function broadcast(type, data) {
  if (!wss || clients.size === 0) return;
  const message = JSON.stringify({ type, data, ts: new Date().toISOString() });
  for (const ws of clients) {
    if (ws.readyState !== ws.OPEN) continue;
    try {
      ws.send(message);
    } catch {
      clients.delete(ws);
    }
  }
}

function close() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  for (const ws of clients) {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  }
  clients.clear();
  if (wss) wss.close();
  wss = null;
}

function count() {
  return clients.size;
}

module.exports = { init, broadcast, close, count };
