const { EventEmitter } = require('events');

// Bus interno: las integraciones publican cambios y el hub los reenvía por WS.
module.exports = new EventEmitter();
