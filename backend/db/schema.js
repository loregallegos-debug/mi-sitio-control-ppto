// db/schema.js - Crea el schema de la base de datos
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'fintrack.db');

function getDB() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id        TEXT PRIMARY KEY,
      nombre    TEXT NOT NULL,
      pm        TEXT NOT NULL DEFAULT '',
      color     TEXT NOT NULL DEFAULT '#1B3A6B',
      activo    INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS codigos (
      id          TEXT PRIMARY KEY,
      codigo      TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      tipo        TEXT NOT NULL CHECK(tipo IN ('PEP','Orden')),
      naturaleza  TEXT NOT NULL CHECK(naturaleza IN ('CAPEX','OPEX')),
      team_id     TEXT REFERENCES teams(id),
      presupuesto REAL DEFAULT 0,
      activo      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id        TEXT PRIMARY KEY,
      nombre    TEXT NOT NULL,
      moneda    TEXT NOT NULL DEFAULT 'USD',
      categoria TEXT DEFAULT 'FTE',
      activo    INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS personas (
      id        TEXT PRIMARY KEY,
      nombre    TEXT NOT NULL,
      cargo     TEXT DEFAULT '',
      empresa   TEXT DEFAULT '',
      tipo      TEXT DEFAULT 'Externa',
      email     TEXT DEFAULT '',
      color     TEXT DEFAULT '#1B3A6B',
      estado    TEXT DEFAULT 'Activo',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS persona_teams (
      id         TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
      team_id    TEXT NOT NULL REFERENCES teams(id),
      pct        INTEGER DEFAULT 100,
      UNIQUE(persona_id, team_id)
    );

    CREATE TABLE IF NOT EXISTS presupuestos (
      id         TEXT PRIMARY KEY,
      team_id    TEXT NOT NULL REFERENCES teams(id),
      codigo_id  TEXT NOT NULL REFERENCES codigos(id),
      anio       INTEGER NOT NULL,
      mes        INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
      monto      REAL DEFAULT 0,
      UNIQUE(team_id, codigo_id, anio, mes)
    );

    CREATE TABLE IF NOT EXISTS pagos (
      id           TEXT PRIMARY KEY,
      team_id      TEXT NOT NULL REFERENCES teams(id),
      codigo_id    TEXT NOT NULL REFERENCES codigos(id),
      proveedor_id TEXT REFERENCES proveedores(id),
      persona_id   TEXT REFERENCES personas(id),
      categoria    TEXT DEFAULT 'FTE',
      fecha        TEXT NOT NULL,
      anio         INTEGER NOT NULL,
      mes          INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
      monto_orig   REAL NOT NULL,
      moneda       TEXT NOT NULL DEFAULT 'USD',
      tc           REAL NOT NULL DEFAULT 1,
      monto_usd    REAL NOT NULL,
      pct_codigo   INTEGER DEFAULT 100,
      descripcion  TEXT DEFAULT '',
      dias         INTEGER DEFAULT 21,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS forecast (
      id         TEXT PRIMARY KEY,
      team_id    TEXT NOT NULL REFERENCES teams(id),
      codigo_id  TEXT NOT NULL REFERENCES codigos(id),
      anio       INTEGER NOT NULL,
      mes        INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
      monto      REAL DEFAULT 0,
      UNIQUE(team_id, codigo_id, anio, mes)
    );

    CREATE TABLE IF NOT EXISTS tipos_cambio (
      id      TEXT PRIMARY KEY,
      fecha   TEXT NOT NULL,
      moneda  TEXT NOT NULL,
      valor   REAL NOT NULL,
      fuente  TEXT DEFAULT 'Manual',
      UNIQUE(fecha, moneda)
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pagos_anio_mes ON pagos(anio, mes);
    CREATE INDEX IF NOT EXISTS idx_pagos_team ON pagos(team_id);
    CREATE INDEX IF NOT EXISTS idx_presupuestos_anio ON presupuestos(anio);
  `);
}

module.exports = { getDB, createSchema, DB_PATH };
