// db/database.js — SQLite schema + seed con datos reales
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'fintrack.db');
const db = new Database(DB_PATH);

// ── PRAGMA ──────────────────────────────────────────────────────────
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── SCHEMA ──────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS teams (
  id        TEXT PRIMARY KEY,
  nombre    TEXT NOT NULL,
  pm        TEXT NOT NULL,
  color     TEXT DEFAULT '#1B3A6B',
  activo    INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS codigos (
  id          TEXT PRIMARY KEY,
  codigo      TEXT NOT NULL UNIQUE,
  descripcion TEXT DEFAULT '',
  tipo        TEXT CHECK(tipo IN ('PEP','Orden')) NOT NULL,
  naturaleza  TEXT CHECK(naturaleza IN ('CAPEX','OPEX')) NOT NULL,
  team_id     TEXT REFERENCES teams(id),
  presupuesto REAL DEFAULT 0,
  activo      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proveedores (
  id        TEXT PRIMARY KEY,
  nombre    TEXT NOT NULL,
  moneda    TEXT CHECK(moneda IN ('USD','CLP','UF','BRL')) DEFAULT 'USD',
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
  persona_id TEXT REFERENCES personas(id) ON DELETE CASCADE,
  team_id    TEXT REFERENCES teams(id),
  pct        INTEGER DEFAULT 100,
  fecha_ini  TEXT,
  fecha_fin  TEXT
);

CREATE TABLE IF NOT EXISTS presupuestos (
  id         TEXT PRIMARY KEY,
  team_id    TEXT REFERENCES teams(id),
  codigo_id  TEXT REFERENCES codigos(id),
  anio       INTEGER NOT NULL,
  mes        INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
  monto      REAL DEFAULT 0,
  UNIQUE(team_id, codigo_id, anio, mes)
);

CREATE TABLE IF NOT EXISTS pagos (
  id          TEXT PRIMARY KEY,
  team_id     TEXT REFERENCES teams(id),
  codigo_id   TEXT REFERENCES codigos(id),
  proveedor_id TEXT REFERENCES proveedores(id),
  persona_id  TEXT REFERENCES personas(id),
  categoria   TEXT DEFAULT 'FTE',
  fecha       TEXT NOT NULL,
  anio        INTEGER NOT NULL,
  mes         INTEGER NOT NULL,
  monto_orig  REAL NOT NULL,
  moneda      TEXT DEFAULT 'USD',
  tc          REAL DEFAULT 1,
  monto_usd   REAL NOT NULL,
  pct_codigo  INTEGER DEFAULT 100,
  descripcion TEXT DEFAULT '',
  dias        INTEGER DEFAULT 21,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forecast (
  id         TEXT PRIMARY KEY,
  team_id    TEXT REFERENCES teams(id),
  codigo_id  TEXT REFERENCES codigos(id),
  anio       INTEGER NOT NULL,
  mes        INTEGER NOT NULL,
  monto      REAL DEFAULT 0,
  UNIQUE(team_id, codigo_id, anio, mes)
);

CREATE TABLE IF NOT EXISTS tipos_cambio (
  id      TEXT PRIMARY KEY,
  fecha   TEXT NOT NULL,
  moneda  TEXT NOT NULL,
  valor   REAL NOT NULL,
  fuente  TEXT DEFAULT 'Manual'
);

CREATE TABLE IF NOT EXISTS alert_prefs (
  id        TEXT PRIMARY KEY,
  email     TEXT NOT NULL UNIQUE,
  nombre    TEXT NOT NULL,
  activo    INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sso_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`);

// ── SEED (solo si está vacío) ────────────────────────────────────────
const seedIfEmpty = () => {
  const count = db.prepare('SELECT COUNT(*) as n FROM teams').get();
  if (count.n > 0) return;

  console.log('🌱 Sembrando datos iniciales...');

  const insertTeam = db.prepare('INSERT OR IGNORE INTO teams (id,nombre,pm,color) VALUES (?,?,?,?)');
  const insertCod  = db.prepare('INSERT OR IGNORE INTO codigos (id,codigo,descripcion,tipo,naturaleza,team_id,presupuesto) VALUES (?,?,?,?,?,?,?)');
  const insertProv = db.prepare('INSERT OR IGNORE INTO proveedores (id,nombre,moneda,categoria) VALUES (?,?,?,?)');
  const insertPers = db.prepare('INSERT OR IGNORE INTO personas (id,nombre,cargo,empresa,tipo,color,email) VALUES (?,?,?,?,?,?,?)');
  const insertPT   = db.prepare('INSERT OR IGNORE INTO persona_teams (id,persona_id,team_id,pct) VALUES (?,?,?,?)');
  const insertPpto = db.prepare('INSERT OR IGNORE INTO presupuestos (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?)');
  const insertPago = db.prepare('INSERT OR IGNORE INTO pagos (id,team_id,codigo_id,proveedor_id,persona_id,categoria,fecha,anio,mes,monto_orig,moneda,tc,monto_usd,pct_codigo,descripcion,dias) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insertTC   = db.prepare('INSERT OR IGNORE INTO tipos_cambio (id,fecha,moneda,valor,fuente) VALUES (?,?,?,?,?)');
  const insertAP   = db.prepare('INSERT OR IGNORE INTO alert_prefs (id,email,nombre) VALUES (?,?,?)');
  const insertSSO  = db.prepare('INSERT OR IGNORE INTO sso_config (clave,valor) VALUES (?,?)');

  // TEAMS
  const teams = [
    ['T1','Dispatch Management','Maria Jesus Vilas','#1B3A6B'],
    ['T2','FlightOps Engineering','Catalina Silvestre','#00A8A8'],
    ['T3','DispatchCore Systems','Thiago Moura','#FB8C00'],
  ];
  teams.forEach(t => insertTeam.run(...t));

  // CODIGOS — con descripciones reales
  const cods = [
    ['C1','VPA-GCI-26-011','Funding Dev',      'PEP','CAPEX','T1', 43000],
    ['C2','VPA-GCI-26-030','Funding ADO',      'PEP','CAPEX','T1', 81000],
    ['C3','VPA-GCI-26-045','BCP OFP',          'PEP','CAPEX','T1', 41000],
    ['C4','VPT-GPZ-25-029','Embraer E2',       'PEP','CAPEX','T1', 46000],
    ['C5','VPA-GCI-26-046','BCP Fligt Tracking','PEP','CAPEX','T1',120000],
    ['C6','VPA-GCI-26-048','BCP Asignación de vuelos','PEP','CAPEX','T1',8000],
    ['C7','GCLACLMNT531',  '1 FTE',            'Orden','OPEX','T1', 91000],
    ['C8','GCLACLMNT080',  '3 FTE',            'Orden','OPEX','T1',348000],
    ['CE1','VPA-GCI-25-010','Funding Dev 2025', 'PEP','CAPEX','T1',0],
    ['CE2','GCLACLMNT553',  'FTE FlightOps',    'Orden','OPEX','T2',0],
    ['CE3','GCLACLMNT554',  'FTE DispatchCore', 'Orden','OPEX','T3',0],
    ['CE4','VPA-GCI-24-042','PEP 2024',         'PEP','CAPEX','T2',0],
    ['CE5','TAM-VTI-25-002','TAM Brasil 2025',  'PEP','CAPEX','T3',0],
    ['CE6','TAM-VTI-26-004','TAM Brasil 2026',  'PEP','CAPEX','T3',0],
    ['CE7','GCJJBRMNT106',  'FTE Brasil',       'Orden','OPEX','T3',0],
    ['CE8','GCLACLMNT532',  'FTE Stefanini',    'Orden','OPEX','T3',0],
    ['CE9','ADO',           'ADO - Tryolabs',   'Orden','OPEX','T1',0],
  ];
  cods.forEach(c => insertCod.run(...c));

  // PROVEEDORES
  const provs = [
    ['P10','Indra',          'UF', 'FTE'],
    ['P11','NTTData',        'CLP','FTE'],
    ['P12','Acid Labs',      'CLP','FTE'],
    ['P13','Everis Brasil',  'USD','FTE'],
    ['P14','Tryolabs',       'USD','FTE'],
    ['P15','Stefanini Chile','CLP','FTE'],
  ];
  provs.forEach(p => insertProv.run(...p));

  // PERSONAS (FTE reales 2026)
  const personas = [
    ['F1','Maria Jesus Vilas',  'PM','Dispatch Management','Interna','#1B3A6B','mvilas@empresa.cl'],
    ['F2','Catalina Silvestre', 'PM','FlightOps Engineering','Interna','#00A8A8','csilvestre@empresa.cl'],
    ['F3','Thiago Moura',       'PM','DispatchCore Systems','Interna','#FB8C00','tmoura@empresa.cl'],
    ['F10','Rodrigo Ulloa',          'FTE','Indra',           'Externa','#1B3A6B',''],
    ['F11','Nicolas Monarde',        'FTE','Indra',           'Externa','#1B3A6B',''],
    ['F12','Ricardo Herrera',        'FTE','Indra',           'Externa','#1B3A6B',''],
    ['F13','Daniela Baeza',          'FTE','NTTData',         'Externa','#00A8A8',''],
    ['F14','Luis Fuentes',           'FTE','NTTData',         'Externa','#00A8A8',''],
    ['F15','Rodrigo Quinteros',      'FTE','Acid Labs',       'Externa','#FB8C00',''],
    ['F16','Maria del Pilar Ureta',  'FTE','Acid Labs',       'Externa','#FB8C00',''],
    ['F17','Cristian Flores',        'FTE','Acid Labs',       'Externa','#FB8C00',''],
    ['F18','Ricardo Giovanni Lobos', 'FTE','Acid Labs',       'Externa','#FB8C00',''],
    ['F19','Nicolas Gomez',          'FTE','Acid Labs',       'Externa','#FB8C00',''],
    ['F20','Pablo',                  'FTE','Acid Labs',       'Externa','#FB8C00',''],
    ['F21','Arthur Arantes',         'FTE','Everis Brasil',   'Externa','#2E7D32',''],
    ['F22','Gabriel Cerdeira',       'FTE','Everis Brasil',   'Externa','#2E7D32',''],
    ['F23','Nicolas Vasquez',        'FTE','Tryolabs',        'Externa','#6C3FC5',''],
    ['F24','Kevin Leiva',            'FTE','Stefanini Chile', 'Externa','#E53935',''],
  ];
  personas.forEach(p => insertPers.run(...p));

  // PERSONA-TEAMS
  const pt = [
    ['PT1','F1','T1',100],['PT2','F2','T2',100],['PT3','F3','T3',100],
    ['PT10','F10','T1',100],['PT11','F11','T1',100],['PT12','F12','T1',100],
    ['PT13','F13','T1',100],['PT14','F14','T1',100],
    ['PT15','F15','T1',100],['PT16','F16','T1',100],
    ['PT17','F17','T2',100],['PT18','F18','T3',100],
    ['PT19','F19','T1',100],['PT20','F20','T1',100],
    ['PT21','F21','T3',100],['PT22','F22','T2',100],
    ['PT23','F23','T1',100],['PT24','F24','T3',100],
  ];
  pt.forEach(r => insertPT.run(...r));

  // PRESUPUESTOS 2025
  const ppto25 = [
    // VPA-GCI-26-011: Feb-Abr $14K
    ['B25_1_2','T1','C1',2025,2,14000],['B25_1_3','T1','C1',2025,3,14000],['B25_1_4','T1','C1',2025,4,14000],
    // VPA-GCI-26-030: Feb-Abr $27K
    ['B25_2_2','T1','C2',2025,2,27000],['B25_2_3','T1','C2',2025,3,27000],['B25_2_4','T1','C2',2025,4,27000],
    // GCLACLMNT531: $8K todos los meses
    ...Array.from({length:12},(_,i)=>['B25_7_'+(i+1),'T1','C7',2025,i+1,8000]),
    // GCLACLMNT080: $29K todos los meses
    ...Array.from({length:12},(_,i)=>['B25_8_'+(i+1),'T1','C8',2025,i+1,29000]),
    // VPA-GCI-26-045: Feb-Dic $4K
    ...Array.from({length:11},(_,i)=>['B25_3_'+(i+2),'T1','C3',2025,i+2,4000]),
    // VPT-GPZ-25-029: Mar $8K, Abr $8K, May $16K, Jun $16K
    ['B25_4_3','T1','C4',2025,3,8000],['B25_4_4','T1','C4',2025,4,8000],
    ['B25_4_5','T1','C4',2025,5,16000],['B25_4_6','T1','C4',2025,6,16000],
    // VPA-GCI-26-046: Jun-Oct $20K, Nov-Dic $10K
    ['B25_5_6','T1','C5',2025,6,20000],['B25_5_7','T1','C5',2025,7,20000],
    ['B25_5_8','T1','C5',2025,8,20000],['B25_5_9','T1','C5',2025,9,20000],
    ['B25_5_10','T1','C5',2025,10,20000],['B25_5_11','T1','C5',2025,11,10000],['B25_5_12','T1','C5',2025,12,10000],
    // VPA-GCI-26-048: May $8K
    ['B25_6_5','T1','C6',2025,5,8000],
  ];
  ppto25.forEach(b => insertPpto.run(...b));

  // PRESUPUESTOS 2026
  const ppto26 = [
    ['B26_1_2','T1','C1',2026,2,14000],['B26_1_3','T1','C1',2026,3,14000],['B26_1_4','T1','C1',2026,4,14000],
    ['B26_2_2','T1','C2',2026,2,27000],['B26_2_3','T1','C2',2026,3,27000],['B26_2_4','T1','C2',2026,4,27000],
    ['B26_3_2','T1','C3',2026,2,4000],['B26_3_3','T1','C3',2026,3,4000],['B26_3_4','T1','C3',2026,4,4000],
    ['B26_3_5','T1','C3',2026,5,4000],['B26_3_6','T1','C3',2026,6,4000],['B26_3_7','T1','C3',2026,7,4000],
    ['B26_3_8','T1','C3',2026,8,4000],['B26_3_9','T1','C3',2026,9,54000],['B26_3_10','T1','C3',2026,10,54000],
    ['B26_3_11','T1','C3',2026,11,64000],['B26_3_12','T1','C3',2026,12,4000],
    ['B26_4_3','T1','C4',2026,3,8000],['B26_4_4','T1','C4',2026,4,8000],
    ['B26_4_5','T1','C4',2026,5,16000],['B26_4_6','T1','C4',2026,6,16000],
    ['B26_5_6','T1','C5',2026,6,20000],['B26_5_7','T1','C5',2026,7,20000],
    ['B26_5_8','T1','C5',2026,8,20000],['B26_5_9','T1','C5',2026,9,20000],
    ['B26_5_10','T1','C5',2026,10,20000],['B26_5_11','T1','C5',2026,11,10000],['B26_5_12','T1','C5',2026,12,10000],
    ['B26_6_5','T1','C6',2026,5,8000],
    ...Array.from({length:12},(_,i)=>['B26_7_'+(i+1),'T1','C7',2026,i+1,8000]),
    ...Array.from({length:12},(_,i)=>['B26_8_'+(i+1),'T1','C8',2026,i+1,29000]),
  ];
  ppto26.forEach(b => insertPpto.run(...b));

  // PAGOS REALES 2026
  const TC_UF=37.5, TC_CLP=0.00105;
  const pagos = [
    ['P2026_001','T1','CE1','P10','F10','FTE','2026-01-31',2026,1,218.49,'UF',TC_UF,Math.round(218.49*TC_UF),100,'Rodrigo Ulloa · 21 días',21],
    ['P2026_002','T1','C1', 'P10','F10','FTE','2026-02-28',2026,2,235,  'UF',TC_UF,Math.round(235*TC_UF),  100,'Rodrigo Ulloa · 21 días',21],
    ['P2026_003','T1','C7', 'P10','F10','FTE','2026-03-31',2026,3,235.2,'UF',TC_UF,Math.round(235.2*TC_UF),100,'Rodrigo Ulloa · 21 días',21],
    ['P2026_004','T1','C8', 'P10','F10','FTE','2026-04-30',2026,4,235.2,'UF',TC_UF,Math.round(235.2*TC_UF),100,'Rodrigo Ulloa · 21 días',21],
    ['P2026_005','T1','CE1','P10','F11','FTE','2026-01-31',2026,1,43.2, 'UF',TC_UF,Math.round(43.2*TC_UF), 100,'Nicolas Monarde · 6 días',6],
    ['P2026_006','T1','C1', 'P10','F12','FTE','2026-02-28',2026,2,1607, 'USD',1,   1607,                   100,'Ricardo Herrera · 21 días',21],
    ['P2026_007','T1','C1', 'P10','F12','FTE','2026-03-31',2026,3,1606, 'USD',1,   1606,                   100,'Ricardo Herrera · 21 días',21],
    ['P2026_008','T1','C1', 'P10','F12','FTE','2026-04-30',2026,4,1607, 'USD',1,   1607,                   100,'Ricardo Herrera · 21 días',21],
    ['P2026_009','T1','C8', 'P11','F13','FTE','2026-01-31',2026,1,5616.07,'UF',TC_UF,Math.round(5616.07*TC_UF),100,'Daniela Baeza · 21 días',21],
    ['P2026_010','T1','C8', 'P11','F14','FTE','2026-02-28',2026,2,53486,'USD',1,   53486,                  100,'Luis Fuentes · 21 días',21],
    ['P2026_011','T1','C1', 'P11','F14','FTE','2026-03-31',2026,3,5883.5,'UF',TC_UF,Math.round(5883.5*TC_UF),100,'Luis Fuentes · 22 días',22],
    ['P2026_012','T1','C1', 'P11','F14','FTE','2026-04-30',2026,4,5616.07,'UF',TC_UF,Math.round(5616.07*TC_UF),100,'Luis Fuentes · 21 días',21],
    ['P2026_013','T1','C8','P12','F15','FTE','2026-01-31',2026,1,5460000,'CLP',TC_CLP,Math.round(5460000*TC_CLP),100,'Rodrigo Quinteros · 21 días',21],
    ['P2026_014','T1','C8','P12','F15','FTE','2026-02-28',2026,2,5200000,'CLP',TC_CLP,Math.round(5200000*TC_CLP),100,'Rodrigo Quinteros · 20 días',20],
    ['P2026_015','T1','C8','P12','F15','FTE','2026-03-31',2026,3,5720000,'CLP',TC_CLP,Math.round(5720000*TC_CLP),100,'Rodrigo Quinteros · 22 días',22],
    ['P2026_016','T1','C8','P12','F15','FTE','2026-04-30',2026,4,5460000,'CLP',TC_CLP,Math.round(5460000*TC_CLP),100,'Rodrigo Quinteros · 21 días',21],
    ['P2026_017','T1','C8','P12','F16','FTE','2026-01-31',2026,1,4200000,'CLP',TC_CLP,Math.round(4200000*TC_CLP),100,'Maria del Pilar Ureta · 21 días',21],
    ['P2026_018','T1','C8','P12','F16','FTE','2026-02-28',2026,2,4000000,'CLP',TC_CLP,Math.round(4000000*TC_CLP),100,'Maria del Pilar Ureta · 20 días',20],
    ['P2026_019','T1','C8','P12','F16','FTE','2026-03-31',2026,3,4400000,'CLP',TC_CLP,Math.round(4400000*TC_CLP),100,'Maria del Pilar Ureta · 22 días',22],
    ['P2026_020','T1','C8','P12','F16','FTE','2026-04-30',2026,4,4200000,'CLP',TC_CLP,Math.round(4200000*TC_CLP),100,'Maria del Pilar Ureta · 21 días',21],
    ['P2026_021','T2','CE4','P12','F17','FTE','2026-01-31',2026,1,5754000,'CLP',TC_CLP,Math.round(5754000*TC_CLP),100,'Cristian Flores · 21 días',21],
    ['P2026_022','T2','CE2','P12','F17','FTE','2026-02-28',2026,2,2740000,'CLP',TC_CLP,Math.round(2740000*TC_CLP),100,'Cristian Flores · 15 días',15],
    ['P2026_023','T2','CE2','P12','F17','FTE','2026-03-31',2026,3,6028000,'CLP',TC_CLP,Math.round(6028000*TC_CLP),100,'Cristian Flores · 22 días',22],
    ['P2026_024','T2','CE2','P12','F17','FTE','2026-04-30',2026,4,5754000,'CLP',TC_CLP,Math.round(5754000*TC_CLP),100,'Cristian Flores · 21 días',21],
    ['P2026_025','T3','C8', 'P12','F18','FTE','2026-01-31',2026,1,5754000,'CLP',TC_CLP,Math.round(5754000*TC_CLP),100,'R. Giovanni Lobos · 21 días',21],
    ['P2026_026','T3','CE3','P12','F18','FTE','2026-02-28',2026,2,5480000,'CLP',TC_CLP,Math.round(5480000*TC_CLP),100,'R. Giovanni Lobos · 20 días',20],
    ['P2026_027','T3','C1', 'P12','F18','FTE','2026-03-31',2026,3,4658000,'CLP',TC_CLP,Math.round(4658000*TC_CLP),100,'R. Giovanni Lobos · 17 días',17],
    ['P2026_028','T3','C1', 'P12','F18','FTE','2026-04-30',2026,4,5754000,'CLP',TC_CLP,Math.round(5754000*TC_CLP),100,'R. Giovanni Lobos · 17 días',17],
    ['P2026_029','T1','C8', 'P12','F19','FTE','2026-02-28',2026,2,3900000,'CLP',TC_CLP,Math.round(3900000*TC_CLP),100,'Nicolas Gomez · 15 días',15],
    ['P2026_030','T1','C7', 'P12','F19','FTE','2026-03-31',2026,3,5720000,'CLP',TC_CLP,Math.round(5720000*TC_CLP),100,'Nicolas Gomez · 22 días',22],
    ['P2026_031','T1','C7', 'P12','F19','FTE','2026-04-30',2026,4,5460000,'CLP',TC_CLP,Math.round(5460000*TC_CLP),100,'Nicolas Gomez · 21 días',21],
    ['P2026_032','T1','C4', 'P12','F20','FTE','2026-03-31',2026,3,390042,'CLP',TC_CLP,Math.round(390042*TC_CLP),100,'Pablo · 3 días',3],
    ['P2026_033','T3','CE5','P13','F21','FTE','2026-01-31',2026,1,44352,'USD',1,44352,100,'Arthur Arantes · 21 días',21],
    ['P2026_034','T3','CE7','P13','F21','FTE','2026-02-28',2026,2,39072,'USD',1,39072,100,'Arthur Arantes · 19 días',19],
    ['P2026_035','T3','CE7','P13','F21','FTE','2026-03-31',2026,3,46464,'USD',1,46464,100,'Arthur Arantes · 22 días',22],
    ['P2026_036','T3','CE6','P13','F21','FTE','2026-04-30',2026,4,42240,'USD',1,42240,100,'Arthur Arantes · 21 días',21],
    ['P2026_037','T2','CE7','P13','F22','FTE','2026-01-31',2026,1,33936,'USD',1,33936,100,'Gabriel Cerdeira · 21 días',21],
    ['P2026_038','T2','CE7','P13','F22','FTE','2026-02-28',2026,2,29088,'USD',1,29088,100,'Gabriel Cerdeira · 18 días',18],
    ['P2026_040','T2','CE6','P13','F22','FTE','2026-04-30',2026,4,32306,'USD',1,32306,100,'Gabriel Cerdeira · 21 días',21],
    ['P2026_042','T3','CE8','P15','F24','FTE','2026-01-31',2026,1,5065920,'CLP',TC_CLP,Math.round(5065920*TC_CLP),100,'Kevin Leiva · 21 días',21],
    ['P2026_043','T3','CE8','P15','F24','FTE','2026-02-28',2026,2,3166200,'CLP',TC_CLP,Math.round(3166200*TC_CLP),100,'Kevin Leiva · 21 días',21],
    ['P2026_044','T3','CE8','P15','F24','FTE','2026-03-31',2026,3,6649000,'CLP',TC_CLP,Math.round(6649000*TC_CLP),100,'Kevin Leiva · 21 días',21],
    ['P2026_045','T3','CE8','P15','F24','FTE','2026-04-30',2026,4,6649000,'CLP',TC_CLP,Math.round(6649000*TC_CLP),100,'Kevin Leiva · 21 días',21],
  ];
  pagos.forEach(p => insertPago.run(...p));

  // TIPOS DE CAMBIO
  insertTC.run('TC1','2026-04-22','UF',37.50,'API');
  insertTC.run('TC2','2026-04-22','CLP',0.00105,'API');
  insertTC.run('TC3','2025-10-20','UF',37.24,'API');
  insertTC.run('TC4','2025-10-20','CLP',0.001082,'API');

  // ALERTAS
  insertAP.run('AP1','mvilas@empresa.cl','Maria Jesus Vilas');
  insertAP.run('AP2','csilvestre@empresa.cl','Catalina Silvestre');
  insertAP.run('AP3','tmoura@empresa.cl','Thiago Moura');

  // SSO CONFIG
  const ssoDefaults = {
    enabled:'1',microsoft:'1',google:'1',okta:'0',credentials:'1',mfa:'0',alert_email:'1'
  };
  Object.entries(ssoDefaults).forEach(([k,v]) => insertSSO.run(k,v));

  console.log('✅ Seed completado');
};

seedIfEmpty();

module.exports = db;
