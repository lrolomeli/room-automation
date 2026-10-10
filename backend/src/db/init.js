const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DATA_DIR = path.join(__dirname, '../..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const databases = {};

async function initDb(name) {
  if (databases[name]) return databases[name];
  const SQL = await initSqlJs();
  const dbPath = path.join(DATA_DIR, `${name}.db`);
  const exists = fs.existsSync(dbPath);
  const db = exists ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  databases[name] = { SQL, db, dbPath };
  return databases[name];
}

function save(name) {
  const entry = databases[name];
  if (!entry) return;
  const data = entry.db.export();
  fs.writeFileSync(entry.dbPath, Buffer.from(data));
}

function rowToObject(row, columns) {
  const obj = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
}

module.exports = {
  async init(name) { return initDb(name); },

  db(name) {
    const entry = databases[name];
    if (!entry) throw new Error(`DB "${name}" not initialized`);
    return entry.db;
  },

  save(name) { save(name); },

  queryAll(name, sql, params = []) {
    const db = this.db(name);
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(rowToObject(stmt.get(), stmt.getColumnNames()));
    }
    stmt.free();
    return results;
  },

  queryOne(name, sql, params = []) {
    const db = this.db(name);
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const result = rowToObject(stmt.get(), stmt.getColumnNames());
      stmt.free();
      return result;
    }
    stmt.free();
    return null;
  },

  run(name, sql, params = []) {
    const db = this.db(name);
    db.run(sql, params);
    save(name);
  },

  exec(name, sql) {
    const db = this.db(name);
    db.run(sql);
    save(name);
  },
};
