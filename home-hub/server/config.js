require('dotenv').config();

const path = require('path');

const config = {
  port: Number(process.env.PORT) || 3000,

  mqttUrl: process.env.MQTT_URL || 'mqtt://mqtt:1883',
  mqttUsername: process.env.MQTT_USERNAME || '',
  mqttPassword: process.env.MQTT_PASSWORD || '',
  z2mBaseTopic: process.env.Z2M_BASE_TOPIC || 'zigbee2mqtt',

  dashboardUser: process.env.DASHBOARD_USER || '',
  dashboardPassword: process.env.DASHBOARD_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS) || 30,
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  authDisabled: process.env.AUTH_DISABLED === '1',
  allowedOrigin: process.env.ALLOWED_ORIGIN || '',
  trustProxy: process.env.TRUST_PROXY === '1',

  dataDir: process.env.DATA_DIR || path.join(__dirname, '../data'),
  automationMode: process.env.AUTOMATION_MODE || 'shadow',
  automationModeOverride: process.env.AUTOMATION_MODE || '',
  automationsFile: process.env.AUTOMATIONS_FILE || path.join(__dirname, '../config/automations.yaml'),

  espHost: process.env.ESP_HOST || '',
  espPort: Number(process.env.ESP_PORT) || 80,
  climateTz: process.env.CLIMATE_TZ || 'America/Mexico_City',

  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
