const app = require('./app');
const cron = require('node-cron');
const climate = require('./automation/climate');
const acTimer = require('./automation/ac-timer');
const sensors = require('./db/sensors');
const { espRequest } = require('./esp');

async function pollSensor() {
  const parsed = await espRequest('/api/sensors');
  sensors.insertReading(parsed.temperature, parsed.humidity, parsed.unit || 'celsius', new Date().toISOString(), 'auto');
  console.log(`[sensor] stored: ${parsed.temperature}°${parsed.unit || 'celsius'}, ${parsed.humidity}%`);
  return parsed;
}

async function start() {
  await sensors.init();

  pollSensor().catch(() => console.log('[sensor] initial poll failed, will retry'));
  cron.schedule('*/5 * * * *', () => pollSensor().catch((err) => console.log('[sensor] poll failed:', err.message)));

  cron.schedule('* * * * *', async () => {
    const cfg = climate.getConfig();
    if (cfg.enabled) {
      await pollSensor().catch((err) => console.log('[climate] sensor poll failed:', err.message));
    }
    await climate.tick().catch((err) => console.log('[climate] tick failed:', err.message));
    await acTimer.tick().catch((err) => console.log('[ac-timer] tick failed:', err.message));
  });

  const PORT = Number(process.env.PORT) || 3000;
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${PORT} is already in use (EADDRINUSE).`);
      console.error('Options:');
      console.error(`  • Stop whatever is using it (e.g. another node, Docker: docker compose down)`);
      console.error(`  • Or use another port: PORT=3001 node src/index.js\n`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

start();
