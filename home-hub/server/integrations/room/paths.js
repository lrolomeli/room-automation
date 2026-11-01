const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const ROOM_DIR = path.join(DATA_DIR, 'room');

fs.mkdirSync(ROOM_DIR, { recursive: true });

module.exports = { DATA_DIR, ROOM_DIR };
