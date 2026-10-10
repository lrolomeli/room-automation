const http = require('http');

const ESP_HOST = process.env.ESP_HOST || '192.168.100.239';
const ESP_PORT = Number(process.env.ESP_PORT) || 80;

const TRANSIENT_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
]);

function isTransient(err) {
  if (err.message === 'ESP timeout') return true;
  return TRANSIENT_CODES.has(err.code);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function doRequest(path, method, timeout) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: ESP_HOST, port: ESP_PORT, path, method },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid ESP response'));
          }
        });
      }
    );
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('ESP timeout'));
    }, timeout);
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.end();
  });
}

async function espRequest(path, { method = 'GET', timeout = 5000, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await doRequest(path, method, timeout);
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isTransient(err)) {
        await delay(300);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

module.exports = { espRequest, ESP_HOST, ESP_PORT };
