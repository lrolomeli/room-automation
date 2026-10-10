const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname,'../..','data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const files = {
  acState: path.join(DATA_DIR, 'ac-state.json'),
  climateConfig: path.join(DATA_DIR, 'climate-config.json'),
  climateLog: path.join(DATA_DIR, 'climate-log.json'),
};

module.exports = {
  loadAcState() {
    return readJson(files.acState, null);
  },
  saveAcState(data) {
    writeJson(files.acState, data);
  },

  loadClimateConfig() {
    return readJson(files.climateConfig, null);
  },
  saveClimateConfig(data) {
    writeJson(files.climateConfig, data);
  },

  loadClimateLog() {
    return readJson(files.climateLog, []);
  },
  saveClimateLog(data) {
    writeJson(files.climateLog, data);
  },
};
