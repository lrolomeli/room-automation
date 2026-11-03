const db = require('./init');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temperature REAL NOT NULL,
    humidity REAL NOT NULL,
    unit TEXT DEFAULT 'celsius',
    timestamp DATETIME DEFAULT (datetime('now')),
    source TEXT DEFAULT 'auto',
    ac_power INTEGER,
    ac_setpoint REAL,
    ac_mode TEXT,
    ac_fan TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp);
`;

const AC_COLUMNS = [
  ['ac_power', 'INTEGER'],
  ['ac_setpoint', 'REAL'],
  ['ac_mode', 'TEXT'],
  ['ac_fan', 'TEXT'],
];

function migrate() {
  const columns = new Set(
    db.queryAll('sensors', 'PRAGMA table_info(readings)').map((row) => row.name),
  );
  for (const [name, type] of AC_COLUMNS) {
    if (!columns.has(name)) {
      db.exec('sensors', `ALTER TABLE readings ADD COLUMN ${name} ${type}`);
    }
  }
}

function init() {
  return db.init('sensors').then(() => {
    db.exec('sensors', SCHEMA);
    migrate();
  });
}

module.exports = {
  init,

  insertReading(temperature, humidity, unit = 'celsius', timestamp, source = 'auto', ac = null) {
    const ts = timestamp || new Date().toISOString();
    const acPower = ac && typeof ac.power === 'boolean' ? (ac.power ? 1 : 0) : null;
    db.run(
      'sensors',
      `INSERT INTO readings
        (temperature, humidity, unit, timestamp, source, ac_power, ac_setpoint, ac_mode, ac_fan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        temperature,
        humidity,
        unit,
        ts,
        source,
        acPower,
        ac?.temp ?? null,
        ac?.mode ?? null,
        ac?.fan ?? null,
      ],
    );
    const row = db.queryOne('sensors', 'SELECT last_insert_rowid() AS id');
    return { lastID: row ? row.id : null };
  },

  getLatest() {
    return db.queryOne('sensors', 'SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1');
  },

  getRange(hours = 24) {
    return db.queryAll('sensors', `SELECT * FROM readings WHERE timestamp >= datetime('now', ? || ' hours') ORDER BY timestamp ASC`, [`-${hours}`]);
  },

  getDailyStats(dateStr) {
    return db.queryOne('sensors', `
      SELECT MIN(temperature) as minTemp, MAX(temperature) as maxTemp, AVG(temperature) as avgTemp,
             MIN(humidity) as minHumidity, MAX(humidity) as maxHumidity, AVG(humidity) as avgHumidity,
             COUNT(*) as sampleCount
      FROM readings WHERE date(timestamp) = ?
    `, [dateStr]);
  },

  getMonthlyHeatmap(yearMonth) {
    return db.queryAll('sensors', `
      SELECT date(timestamp) as day, MIN(temperature) as minTemp, MAX(temperature) as maxTemp,
             AVG(temperature) as avgTemp, AVG(humidity) as avgHumidity
      FROM readings WHERE strftime('%Y-%m', timestamp) = ?
      GROUP BY date(timestamp) ORDER BY day ASC
    `, [yearMonth]);
  },

  getTrendAnalysis(days = 30) {
    return db.queryAll('sensors', `
      SELECT date(timestamp) as day, MIN(temperature) as minTemp, MAX(temperature) as maxTemp,
             AVG(temperature) as avgTemp, MIN(humidity) as minHumidity, MAX(humidity) as maxHumidity,
             AVG(humidity) as avgHumidity, COUNT(*) as samples
      FROM readings WHERE timestamp >= datetime('now', ? || ' days')
      GROUP BY date(timestamp) ORDER BY day ASC
    `, [`-${days}`]);
  },

  getAnomalies(days = 30, threshold = 2) {
    const daily = this.getTrendAnalysis(days);
    if (daily.length < 3) return [];
    const temps = daily.map(d => d.avgTemp);
    const mean = temps.reduce((a, b) => a + b, 0) / temps.length;
    const std = Math.sqrt(temps.reduce((sum, t) => sum + (t - mean) ** 2, 0) / temps.length);
    if (std === 0) return [];
    return daily
      .filter(d => Math.abs(d.avgTemp - mean) > threshold * std)
      .map(d => ({ ...d, deviation: ((d.avgTemp - mean) / std).toFixed(2) }));
  },
};
