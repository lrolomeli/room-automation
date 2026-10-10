const { Router } = require('express');
const sensors = require('../db/sensors');
const { espRequest } = require('../esp');

const router = Router();

function fetchFromESP() {
  return espRequest('/api/sensors');
}

router.get('/current', async (req, res) => {
  try {
    const espData = await fetchFromESP();
    const reading = {
      temperature: espData.temperature,
      humidity: espData.humidity,
      unit: espData.unit || 'celsius',
      status: espData.status,
    };
    sensors.insertReading(reading.temperature, reading.humidity, reading.unit, new Date().toISOString(), 'auto');
    res.json(reading);
  } catch (err) {
    const latest = sensors.getLatest();
    if (latest) {
      res.json({ ...latest, status: 'stale', warning: 'Sensor unreachable, showing last reading' });
    } else {
      res.status(503).json({ error: 'Sensor unreachable, no historical data' });
    }
  }
});

router.post('/readings', (req, res) => {
  const { temperature, humidity, unit = 'celsius', timestamp } = req.body || {};
  if (temperature == null || humidity == null) {
    return res.status(400).json({ error: 'temperature and humidity required' });
  }
  const result = sensors.insertReading(temperature, humidity, unit, timestamp, 'manual');
  res.json({ id: result.lastID });
});

router.get('/history', (req, res) => {
  const range = req.query.range || '24h';
  const hoursMap = { '1h': 1, '6h': 6, '12h': 12, '24h': 24, '7d': 168, '30d': 720 };
  const hours = hoursMap[range] || 24;
  const readings = sensors.getRange(hours);
  res.json(readings);
});

router.get('/stats', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const stats = sensors.getDailyStats(date);
  if (!stats || stats.sampleCount === 0) {
    return res.json({ error: 'No data for this date', date });
  }
  res.json({
    ...stats,
    date,
    minTemp: Number(stats.minTemp.toFixed(1)),
    maxTemp: Number(stats.maxTemp.toFixed(1)),
    avgTemp: Number(stats.avgTemp.toFixed(1)),
    minHumidity: Number(stats.minHumidity.toFixed(1)),
    maxHumidity: Number(stats.maxHumidity.toFixed(1)),
    avgHumidity: Number(stats.avgHumidity.toFixed(1)),
  });
});

router.get('/heatmap', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const data = sensors.getMonthlyHeatmap(month);
  res.json(data);
});

router.get('/trends', (req, res) => {
  const days = Number(req.query.days) || 30;
  const daily = sensors.getTrendAnalysis(days);
  const anomalies = sensors.getAnomalies(days);
  res.json({ daily, anomalies });
});

module.exports = router;
