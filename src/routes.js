// src/routes.js — API REST completa
const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ── HELPERS ──────────────────────────────────────────────────────────
const newId = (prefix) => prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
const ok    = (res, data) => res.json({ ok: true, data });
const err   = (res, msg, code=400) => res.status(code).json({ ok: false, error: msg });

// Mes → Q
const mesQ = m => m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4;
const qMeses = q => q===1?[1,2,3]:q===2?[4,5,6]:q===3?[7,8,9]:[10,11,12];

// ══════════════════════════════════════════════════════════════════════
// TEAMS
// ══════════════════════════════════════════════════════════════════════
router.get('/teams', (req, res) => {
  const teams = db.prepare('SELECT * FROM teams WHERE activo=1 ORDER BY nombre').all();
  ok(res, teams);
});

router.post('/teams', (req, res) => {
  const { nombre, pm, color = '#1B3A6B' } = req.body;
  if (!nombre || !pm) return err(res, 'nombre y pm son requeridos');
  const id = newId('T');
  db.prepare('INSERT INTO teams (id,nombre,pm,color) VALUES (?,?,?,?)').run(id, nombre, pm, color);
  ok(res, db.prepare('SELECT * FROM teams WHERE id=?').get(id));
});

router.put('/teams/:id', (req, res) => {
  const { nombre, pm, color, activo } = req.body;
  db.prepare('UPDATE teams SET nombre=COALESCE(?,nombre), pm=COALESCE(?,pm), color=COALESCE(?,color), activo=COALESCE(?,activo) WHERE id=?')
    .run(nombre||null, pm||null, color||null, activo!=null?activo:null, req.params.id);
  ok(res, db.prepare('SELECT * FROM teams WHERE id=?').get(req.params.id));
});

router.delete('/teams/:id', (req, res) => {
  db.prepare('UPDATE teams SET activo=0 WHERE id=?').run(req.params.id);
  ok(res, { id: req.params.id });
});

// ══════════════════════════════════════════════════════════════════════
// CODIGOS (PEP / Órdenes)
// ══════════════════════════════════════════════════════════════════════
router.get('/codigos', (req, res) => {
  const { team_id, tipo, nat } = req.query;
  let q = 'SELECT c.*, t.nombre as team_nombre, t.color as team_color FROM codigos c LEFT JOIN teams t ON c.team_id=t.id WHERE c.activo=1';
  const params = [];
  if (team_id) { q += ' AND c.team_id=?'; params.push(team_id); }
  if (tipo)    { q += ' AND c.tipo=?';    params.push(tipo); }
  if (nat)     { q += ' AND c.naturaleza=?'; params.push(nat); }
  q += ' ORDER BY c.codigo';
  ok(res, db.prepare(q).all(...params));
});

router.post('/codigos', (req, res) => {
  const { codigo, descripcion='', tipo, naturaleza, team_id, presupuesto=0 } = req.body;
  if (!codigo || !tipo || !naturaleza) return err(res, 'codigo, tipo y naturaleza son requeridos');
  const nat = tipo === 'PEP' ? 'CAPEX' : 'OPEX';
  const id = newId('C');
  db.prepare('INSERT INTO codigos (id,codigo,descripcion,tipo,naturaleza,team_id,presupuesto) VALUES (?,?,?,?,?,?,?)')
    .run(id, codigo, descripcion, tipo, nat, team_id||null, presupuesto);
  ok(res, db.prepare('SELECT * FROM codigos WHERE id=?').get(id));
});

router.put('/codigos/:id', (req, res) => {
  const { codigo, descripcion, tipo, team_id, presupuesto, activo } = req.body;
  const nat = tipo === 'PEP' ? 'CAPEX' : tipo === 'Orden' ? 'OPEX' : null;
  db.prepare('UPDATE codigos SET codigo=COALESCE(?,codigo), descripcion=COALESCE(?,descripcion), tipo=COALESCE(?,tipo), naturaleza=COALESCE(?,naturaleza), team_id=COALESCE(?,team_id), presupuesto=COALESCE(?,presupuesto), activo=COALESCE(?,activo) WHERE id=?')
    .run(codigo||null, descripcion||null, tipo||null, nat, team_id||null, presupuesto!=null?presupuesto:null, activo!=null?activo:null, req.params.id);
  ok(res, db.prepare('SELECT * FROM codigos WHERE id=?').get(req.params.id));
});

router.delete('/codigos/:id', (req, res) => {
  db.prepare('UPDATE codigos SET activo=0 WHERE id=?').run(req.params.id);
  ok(res, { id: req.params.id });
});

// ══════════════════════════════════════════════════════════════════════
// PROVEEDORES
// ══════════════════════════════════════════════════════════════════════
router.get('/proveedores', (req, res) => {
  const provs = db.prepare('SELECT p.*, COALESCE(SUM(g.monto_usd),0) as gasto_ytd FROM proveedores p LEFT JOIN pagos g ON g.proveedor_id=p.id AND g.anio=strftime(\'%Y\',\'now\') WHERE p.activo=1 GROUP BY p.id ORDER BY p.nombre').all();
  ok(res, provs);
});

router.post('/proveedores', (req, res) => {
  const { nombre, moneda='USD', categoria='FTE' } = req.body;
  if (!nombre) return err(res, 'nombre es requerido');
  const id = newId('P');
  db.prepare('INSERT INTO proveedores (id,nombre,moneda,categoria) VALUES (?,?,?,?)').run(id, nombre, moneda, categoria);
  ok(res, db.prepare('SELECT * FROM proveedores WHERE id=?').get(id));
});

router.put('/proveedores/:id', (req, res) => {
  const { nombre, moneda, categoria, activo } = req.body;
  db.prepare('UPDATE proveedores SET nombre=COALESCE(?,nombre), moneda=COALESCE(?,moneda), categoria=COALESCE(?,categoria), activo=COALESCE(?,activo) WHERE id=?')
    .run(nombre||null, moneda||null, categoria||null, activo!=null?activo:null, req.params.id);
  ok(res, db.prepare('SELECT * FROM proveedores WHERE id=?').get(req.params.id));
});

router.delete('/proveedores/:id', (req, res) => {
  db.prepare('UPDATE proveedores SET activo=0 WHERE id=?').run(req.params.id);
  ok(res, { id: req.params.id });
});

// ══════════════════════════════════════════════════════════════════════
// PERSONAS (FTE)
// ══════════════════════════════════════════════════════════════════════
router.get('/personas', (req, res) => {
  const { team_id, anio, q: quarter } = req.query;

  let query = `
    SELECT p.*,
      GROUP_CONCAT(DISTINCT pt.team_id) as team_ids,
      GROUP_CONCAT(DISTINCT t.nombre) as team_nombres,
      GROUP_CONCAT(DISTINCT t.color) as team_colores,
      COALESCE(SUM(pg.monto_usd),0) as gasto_total,
      COUNT(DISTINCT pg.id) as n_pagos
    FROM personas p
    LEFT JOIN persona_teams pt ON pt.persona_id=p.id
    LEFT JOIN teams t ON t.id=pt.team_id
    LEFT JOIN pagos pg ON pg.persona_id=p.id
  `;
  const params = [];
  const where = ['p.estado=\'Activo\''];

  if (team_id) {
    where.push('pt.team_id=?');
    params.push(team_id);
  }
  if (anio) {
    where.push('(pg.anio=? OR pg.id IS NULL)');
    params.push(parseInt(anio));
  }
  if (quarter) {
    const meses = qMeses(parseInt(quarter));
    where.push(`(pg.mes IN (${meses.join(',')}) OR pg.id IS NULL)`);
  }

  query += ' WHERE ' + where.join(' AND ') + ' GROUP BY p.id ORDER BY p.nombre';
  ok(res, db.prepare(query).all(...params));
});

router.get('/personas/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM personas WHERE id=?').get(req.params.id);
  if (!p) return err(res, 'Persona no encontrada', 404);
  const teams = db.prepare('SELECT pt.*, t.nombre, t.color FROM persona_teams pt JOIN teams t ON t.id=pt.team_id WHERE pt.persona_id=?').all(req.params.id);
  const pagos = db.prepare(`SELECT pg.*, c.codigo, c.descripcion, t.nombre as team_nombre, pv.nombre as proveedor_nombre
    FROM pagos pg
    LEFT JOIN codigos c ON c.id=pg.codigo_id
    LEFT JOIN teams t ON t.id=pg.team_id
    LEFT JOIN proveedores pv ON pv.id=pg.proveedor_id
    WHERE pg.persona_id=? ORDER BY pg.anio DESC, pg.mes DESC`).all(req.params.id);
  ok(res, { ...p, teams, pagos });
});

router.post('/personas', (req, res) => {
  const { nombre, cargo='', empresa='', tipo='Externa', email='', color='#1B3A6B', team_id } = req.body;
  if (!nombre) return err(res, 'nombre es requerido');
  const id = newId('F');
  db.prepare('INSERT INTO personas (id,nombre,cargo,empresa,tipo,email,color) VALUES (?,?,?,?,?,?,?)').run(id, nombre, cargo, empresa, tipo, email, color);
  // Asignar al team si viene
  if (team_id) {
    db.prepare('INSERT OR IGNORE INTO persona_teams (id,persona_id,team_id,pct) VALUES (?,?,?,100)').run(newId('PT'), id, team_id);
  }
  ok(res, db.prepare('SELECT * FROM personas WHERE id=?').get(id));
});

router.put('/personas/:id', (req, res) => {
  const { nombre, cargo, empresa, tipo, email, color, estado } = req.body;
  db.prepare('UPDATE personas SET nombre=COALESCE(?,nombre), cargo=COALESCE(?,cargo), empresa=COALESCE(?,empresa), tipo=COALESCE(?,tipo), email=COALESCE(?,email), color=COALESCE(?,color), estado=COALESCE(?,estado) WHERE id=?')
    .run(nombre||null, cargo||null, empresa||null, tipo||null, email||null, color||null, estado||null, req.params.id);
  ok(res, db.prepare('SELECT * FROM personas WHERE id=?').get(req.params.id));
});

router.delete('/personas/:id', (req, res) => {
  db.prepare('UPDATE personas SET estado=\'Inactivo\' WHERE id=?').run(req.params.id);
  ok(res, { id: req.params.id });
});

// Asignar persona a team
router.post('/personas/:id/teams', (req, res) => {
  const { team_id, pct=100, fecha_ini, fecha_fin } = req.body;
  if (!team_id) return err(res, 'team_id es requerido');
  const ptId = newId('PT');
  db.prepare('INSERT OR REPLACE INTO persona_teams (id,persona_id,team_id,pct,fecha_ini,fecha_fin) VALUES (?,?,?,?,?,?)')
    .run(ptId, req.params.id, team_id, pct, fecha_ini||null, fecha_fin||null);
  ok(res, { id: ptId, persona_id: req.params.id, team_id, pct });
});

router.delete('/personas/:id/teams/:team_id', (req, res) => {
  db.prepare('DELETE FROM persona_teams WHERE persona_id=? AND team_id=?').run(req.params.id, req.params.team_id);
  ok(res, { removed: true });
});

// ══════════════════════════════════════════════════════════════════════
// PERSONAS — ESTADÍSTICAS FTE
// ══════════════════════════════════════════════════════════════════════
router.get('/fte/headcount', (req, res) => {
  const { anio = 2026 } = req.query;
  const a = parseInt(anio);

  // Headcount por team (personas que tienen pagos ese año)
  const byTeam = db.prepare(`
    SELECT t.id, t.nombre, t.color, COUNT(DISTINCT pg.persona_id) as n
    FROM teams t
    LEFT JOIN pagos pg ON pg.team_id=t.id AND pg.anio=?
    WHERE t.activo=1
    GROUP BY t.id ORDER BY t.nombre
  `).all(a);

  // Headcount por quarter
  const byQ = [1,2,3,4].map(q => {
    const meses = qMeses(q);
    const n = db.prepare(`
      SELECT COUNT(DISTINCT pg.persona_id) as n FROM pagos pg WHERE pg.anio=? AND pg.mes IN (${meses.join(',')})
    `).get(a);
    return { q: `Q${q}`, meses: meses.join(','), n: n?.n || 0 };
  });

  // Headcount por mes
  const byMes = Array.from({length:12},(_,i) => {
    const mes = i+1;
    const n = db.prepare('SELECT COUNT(DISTINCT persona_id) as n FROM pagos WHERE anio=? AND mes=?').get(a, mes);
    return { mes, n: n?.n || 0 };
  });

  // Costo por proveedor
  const byProv = db.prepare(`
    SELECT pv.nombre, SUM(pg.monto_usd) as total, COUNT(DISTINCT pg.persona_id) as fte
    FROM pagos pg JOIN proveedores pv ON pv.id=pg.proveedor_id
    WHERE pg.anio=? GROUP BY pv.id ORDER BY total DESC
  `).all(a);

  ok(res, { byTeam, byQ, byMes, byProv, anio: a });
});

// ══════════════════════════════════════════════════════════════════════
// PRESUPUESTOS
// ══════════════════════════════════════════════════════════════════════
router.get('/presupuestos', (req, res) => {
  const { team_id, codigo_id, anio } = req.query;
  let q = 'SELECT b.*, c.codigo, c.tipo, c.naturaleza, c.descripcion FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id WHERE 1=1';
  const params = [];
  if (team_id)   { q += ' AND b.team_id=?';   params.push(team_id); }
  if (codigo_id) { q += ' AND b.codigo_id=?';  params.push(codigo_id); }
  if (anio)      { q += ' AND b.anio=?';       params.push(parseInt(anio)); }
  q += ' ORDER BY b.anio, b.mes';
  ok(res, db.prepare(q).all(...params));
});

router.post('/presupuestos/bulk', (req, res) => {
  // {team_id, codigo_id, anio, meses: [{mes, monto}]}
  const { team_id, codigo_id, anio, meses } = req.body;
  if (!team_id || !codigo_id || !anio || !meses) return err(res, 'Datos incompletos');
  const upsert = db.prepare('INSERT INTO presupuestos (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?) ON CONFLICT(team_id,codigo_id,anio,mes) DO UPDATE SET monto=excluded.monto');
  const t = db.transaction(() => meses.forEach(m => upsert.run(newId('B'), team_id, codigo_id, parseInt(anio), m.mes, m.monto)));
  t();
  ok(res, { updated: meses.length });
});

router.put('/presupuestos/:team_id/:codigo_id/:anio/:mes', (req, res) => {
  const { monto } = req.body;
  const { team_id, codigo_id, anio, mes } = req.params;
  db.prepare('INSERT INTO presupuestos (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?) ON CONFLICT(team_id,codigo_id,anio,mes) DO UPDATE SET monto=?')
    .run(newId('B'), team_id, codigo_id, parseInt(anio), parseInt(mes), monto, monto);
  ok(res, { updated: true });
});

// ══════════════════════════════════════════════════════════════════════
// PAGOS
// ══════════════════════════════════════════════════════════════════════
router.get('/pagos', (req, res) => {
  const { team_id, codigo_id, proveedor_id, persona_id, anio, mes, q: quarter, categoria } = req.query;
  let query = `
    SELECT pg.*,
      t.nombre as team_nombre, t.color as team_color,
      c.codigo as codigo_nombre, c.tipo as codigo_tipo, c.naturaleza,
      pv.nombre as proveedor_nombre,
      pe.nombre as persona_nombre, pe.empresa as persona_empresa
    FROM pagos pg
    LEFT JOIN teams t ON t.id=pg.team_id
    LEFT JOIN codigos c ON c.id=pg.codigo_id
    LEFT JOIN proveedores pv ON pv.id=pg.proveedor_id
    LEFT JOIN personas pe ON pe.id=pg.persona_id
    WHERE 1=1
  `;
  const params = [];
  if (team_id)     { query += ' AND pg.team_id=?';     params.push(team_id); }
  if (codigo_id)   { query += ' AND pg.codigo_id=?';   params.push(codigo_id); }
  if (proveedor_id){ query += ' AND pg.proveedor_id=?';params.push(proveedor_id); }
  if (persona_id)  { query += ' AND pg.persona_id=?';  params.push(persona_id); }
  if (anio)        { query += ' AND pg.anio=?';        params.push(parseInt(anio)); }
  if (mes)         { query += ' AND pg.mes=?';         params.push(parseInt(mes)); }
  if (categoria)   { query += ' AND pg.categoria=?';   params.push(categoria); }
  if (quarter) {
    const meses = qMeses(parseInt(quarter));
    query += ` AND pg.mes IN (${meses.join(',')})`;
  }
  query += ' ORDER BY pg.anio DESC, pg.mes DESC, pg.fecha DESC';
  ok(res, db.prepare(query).all(...params));
});

router.post('/pagos', (req, res) => {
  const { team_id, codigo_id, proveedor_id, persona_id, categoria='FTE', fecha, anio, mes, monto_orig, moneda='USD', tc=1, pct_codigo=100, descripcion='', dias=21 } = req.body;
  if (!team_id || !codigo_id || !fecha || !monto_orig) return err(res, 'team_id, codigo_id, fecha, monto_orig son requeridos');
  const id = newId('G');
  const monto_usd = Math.round(monto_orig * tc * (pct_codigo/100));
  const a = anio || parseInt(fecha.slice(0,4));
  const m = mes || parseInt(fecha.slice(5,7));
  db.prepare('INSERT INTO pagos (id,team_id,codigo_id,proveedor_id,persona_id,categoria,fecha,anio,mes,monto_orig,moneda,tc,monto_usd,pct_codigo,descripcion,dias) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, team_id, codigo_id, proveedor_id||null, persona_id||null, categoria, fecha, a, m, monto_orig, moneda, tc, monto_usd, pct_codigo, descripcion, dias);
  ok(res, db.prepare('SELECT * FROM pagos WHERE id=?').get(id));
});

router.put('/pagos/:id', (req, res) => {
  const { team_id, codigo_id, proveedor_id, persona_id, categoria, fecha, anio, mes, monto_orig, moneda, tc, pct_codigo, descripcion, dias } = req.body;
  const cur = db.prepare('SELECT * FROM pagos WHERE id=?').get(req.params.id);
  if (!cur) return err(res, 'Pago no encontrado', 404);
  const nMonto = monto_orig ?? cur.monto_orig;
  const nTc    = tc ?? cur.tc;
  const nPct   = pct_codigo ?? cur.pct_codigo;
  const monto_usd = Math.round(nMonto * nTc * (nPct/100));
  db.prepare('UPDATE pagos SET team_id=COALESCE(?,team_id), codigo_id=COALESCE(?,codigo_id), proveedor_id=COALESCE(?,proveedor_id), persona_id=COALESCE(?,persona_id), categoria=COALESCE(?,categoria), fecha=COALESCE(?,fecha), anio=COALESCE(?,anio), mes=COALESCE(?,mes), monto_orig=?, moneda=COALESCE(?,moneda), tc=?, monto_usd=?, pct_codigo=?, descripcion=COALESCE(?,descripcion), dias=COALESCE(?,dias) WHERE id=?')
    .run(team_id||null, codigo_id||null, proveedor_id||null, persona_id||null, categoria||null, fecha||null, anio||null, mes||null, nMonto, moneda||null, nTc, monto_usd, nPct, descripcion||null, dias||null, req.params.id);
  ok(res, db.prepare('SELECT * FROM pagos WHERE id=?').get(req.params.id));
});

router.delete('/pagos/:id', (req, res) => {
  db.prepare('DELETE FROM pagos WHERE id=?').run(req.params.id);
  ok(res, { id: req.params.id });
});

// ══════════════════════════════════════════════════════════════════════
// DASHBOARD / KPIs
// ══════════════════════════════════════════════════════════════════════
router.get('/dashboard', (req, res) => {
  const { anio=2026, team_id, periodo='anual', tipo='all' } = req.query;
  const a = parseInt(anio);

  let mesFilter = '';
  const params = [a];
  if (periodo === 'q1') mesFilter = ' AND mes IN (1,2,3)';
  else if (periodo === 'q2') mesFilter = ' AND mes IN (4,5,6)';
  else if (periodo === 'q3') mesFilter = ' AND mes IN (7,8,9)';
  else if (periodo === 'q4') mesFilter = ' AND mes IN (10,11,12)';
  else if (/^\d+$/.test(periodo)) { mesFilter = ' AND mes=?'; params.push(parseInt(periodo)); }

  let natFilter = '';
  if (tipo === 'CAPEX') natFilter = ' AND c.naturaleza=\'CAPEX\'';
  else if (tipo === 'OPEX') natFilter = ' AND c.naturaleza=\'OPEX\'';

  let teamFilter = '';
  if (team_id) { teamFilter = ` AND pg.team_id='${team_id}'`; }

  const real = db.prepare(`SELECT COALESCE(SUM(pg.monto_usd),0) as v FROM pagos pg JOIN codigos c ON c.id=pg.codigo_id WHERE pg.anio=?${mesFilter}${natFilter}${teamFilter}`).get(...params)?.v || 0;

  const pparams = team_id ? [a, team_id] : [a];
  let pq = `SELECT COALESCE(SUM(b.monto),0) as v FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id WHERE b.anio=?`;
  if (team_id) pq += ' AND b.team_id=?';
  pq += mesFilter.replace(/pg\./g,'b.') + natFilter.replace(/c\./g,'c.');
  const ppto = db.prepare(pq).get(...pparams.slice(0, mesFilter ? pparams.length : (team_id ? 2 : 1)))?.v || 0;

  // Por team
  const byTeam = db.prepare(`
    SELECT t.id, t.nombre, t.color, t.pm,
      COALESCE(SUM(pg.monto_usd),0) as real_usd,
      (SELECT COALESCE(SUM(b.monto),0) FROM presupuestos b WHERE b.team_id=t.id AND b.anio=?) as ppto_usd
    FROM teams t
    LEFT JOIN pagos pg ON pg.team_id=t.id AND pg.anio=?${mesFilter}${natFilter}
    WHERE t.activo=1
    GROUP BY t.id ORDER BY t.nombre
  `).all(a, a, ...(mesFilter && /mes=\?/.test(mesFilter) ? [parseInt(periodo)] : []));

  // Por proveedor
  const byProv = db.prepare(`
    SELECT pv.nombre, COALESCE(SUM(pg.monto_usd),0) as total
    FROM pagos pg JOIN proveedores pv ON pv.id=pg.proveedor_id
    WHERE pg.anio=?${mesFilter}${teamFilter}
    GROUP BY pv.id ORDER BY total DESC LIMIT 8
  `).all(a, ...(mesFilter && /mes=\?/.test(mesFilter) ? [parseInt(periodo)] : []));

  // Tendencia mensual
  const tendencia = Array.from({length:12},(_,i) => {
    const mes = i+1;
    const tparams = team_id ? [a, mes, team_id] : [a, mes];
    let tq = `SELECT COALESCE(SUM(pg.monto_usd),0) as real_v FROM pagos pg JOIN codigos c ON c.id=pg.codigo_id WHERE pg.anio=? AND pg.mes=?${natFilter}${teamFilter}`;
    let bq = `SELECT COALESCE(SUM(b.monto),0) as ppto_v FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id WHERE b.anio=? AND b.mes=?${natFilter}${team_id?' AND b.team_id=?':''}`;
    return {
      mes, label: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i],
      real: db.prepare(tq).get(...(team_id?[a,mes,team_id]:[a,mes]))?.real_v || 0,
      ppto: db.prepare(bq).get(...(team_id?[a,mes,team_id]:[a,mes]))?.ppto_v || 0,
    };
  });

  ok(res, { real, ppto, desv: real-ppto, ejec: ppto?(real/ppto*100):0, byTeam, byProv, tendencia, anio: a });
});

// ══════════════════════════════════════════════════════════════════════
// FORECAST
// ══════════════════════════════════════════════════════════════════════
router.get('/forecast', (req, res) => {
  const { team_id, codigo_id, anio=2026 } = req.query;
  let q = 'SELECT * FROM forecast WHERE anio=?';
  const params = [parseInt(anio)];
  if (team_id)   { q += ' AND team_id=?';   params.push(team_id); }
  if (codigo_id) { q += ' AND codigo_id=?'; params.push(codigo_id); }
  ok(res, db.prepare(q).all(...params));
});

router.put('/forecast/:team_id/:codigo_id/:anio/:mes', (req, res) => {
  const { monto } = req.body;
  const { team_id, codigo_id, anio, mes } = req.params;
  db.prepare('INSERT INTO forecast (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?) ON CONFLICT(team_id,codigo_id,anio,mes) DO UPDATE SET monto=?')
    .run(newId('FC'), team_id, codigo_id, parseInt(anio), parseInt(mes), monto, monto);
  ok(res, { updated: true });
});

// ══════════════════════════════════════════════════════════════════════
// TIPOS DE CAMBIO
// ══════════════════════════════════════════════════════════════════════
router.get('/tc', (req, res) => {
  ok(res, db.prepare('SELECT * FROM tipos_cambio ORDER BY fecha DESC LIMIT 30').all());
});

router.post('/tc', (req, res) => {
  const { fecha, moneda, valor, fuente='Manual' } = req.body;
  if (!fecha || !moneda || !valor) return err(res, 'fecha, moneda y valor son requeridos');
  const id = newId('TC');
  db.prepare('INSERT INTO tipos_cambio (id,fecha,moneda,valor,fuente) VALUES (?,?,?,?,?)').run(id, fecha, moneda, valor, fuente);
  ok(res, { id, fecha, moneda, valor, fuente });
});

// ══════════════════════════════════════════════════════════════════════
// ALERTAS / SSO CONFIG
// ══════════════════════════════════════════════════════════════════════
router.get('/alertas/prefs', (req, res) => {
  ok(res, db.prepare('SELECT * FROM alert_prefs ORDER BY nombre').all());
});

router.put('/alertas/prefs/:id', (req, res) => {
  const { activo } = req.body;
  db.prepare('UPDATE alert_prefs SET activo=? WHERE id=?').run(activo, req.params.id);
  ok(res, { updated: true });
});

router.post('/alertas/prefs', (req, res) => {
  const { email, nombre } = req.body;
  if (!email || !nombre) return err(res, 'email y nombre son requeridos');
  const id = newId('AP');
  db.prepare('INSERT OR IGNORE INTO alert_prefs (id,email,nombre) VALUES (?,?,?)').run(id, email, nombre);
  ok(res, { id, email, nombre, activo: 1 });
});

router.get('/sso', (req, res) => {
  const rows = db.prepare('SELECT * FROM sso_config').all();
  const cfg = {};
  rows.forEach(r => cfg[r.clave] = r.valor);
  ok(res, cfg);
});

router.put('/sso', (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO sso_config (clave,valor) VALUES (?,?)');
  const t = db.transaction(() => Object.entries(req.body).forEach(([k,v]) => upsert.run(k, String(v))));
  t();
  ok(res, { updated: true });
});

// ══════════════════════════════════════════════════════════════════════
// ALERTAS CALCULADAS
// ══════════════════════════════════════════════════════════════════════
router.get('/alertas', (req, res) => {
  const { anio=2026 } = req.query;
  const a = parseInt(anio);
  const teams = db.prepare('SELECT * FROM teams WHERE activo=1').all();
  const alertas = [];

  teams.forEach(t => {
    const real = db.prepare('SELECT COALESCE(SUM(monto_usd),0) as v FROM pagos WHERE team_id=? AND anio=?').get(t.id, a)?.v || 0;
    const ppto = db.prepare('SELECT COALESCE(SUM(monto),0) as v FROM presupuestos WHERE team_id=? AND anio=?').get(t.id, a)?.v || 0;
    if (!ppto) return;
    const pct = real / ppto * 100;
    if (pct > 110) alertas.push({ tipo:'critica', team: t.nombre, real, ppto, pct: pct.toFixed(1), msg: `Sobre-ejecución +${(pct-100).toFixed(1)}%` });
    else if (pct < 65 && real > 0) alertas.push({ tipo:'advertencia', team: t.nombre, real, ppto, pct: pct.toFixed(1), msg: `Sub-ejecución ${pct.toFixed(1)}%` });
  });

  ok(res, alertas);
});

// EXPORT CSV
router.get('/export/pagos', (req, res) => {
  const { anio=2026 } = req.query;
  const pagos = db.prepare(`
    SELECT pg.fecha, t.nombre as team, pe.nombre as persona, pv.nombre as proveedor,
      pg.categoria, c.codigo, c.tipo, pg.pct_codigo, pg.monto_orig, pg.moneda, pg.tc, pg.monto_usd, pg.descripcion, pg.dias
    FROM pagos pg
    LEFT JOIN teams t ON t.id=pg.team_id LEFT JOIN codigos c ON c.id=pg.codigo_id
    LEFT JOIN proveedores pv ON pv.id=pg.proveedor_id LEFT JOIN personas pe ON pe.id=pg.persona_id
    WHERE pg.anio=? ORDER BY pg.mes, pg.fecha
  `).all(parseInt(anio));

  const cols = ['Fecha','Team','Persona','Proveedor','Categoría','Código','Tipo','%Cod','Monto Orig','Moneda','TC','USD','Descripción','Días'];
  const csv  = [cols, ...pagos.map(p => [p.fecha,p.team,p.persona||'',p.proveedor,p.categoria,p.codigo,p.tipo,p.pct_codigo,p.monto_orig,p.moneda,p.tc,p.monto_usd,p.descripcion,p.dias])].map(r => r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');

  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename=fintrack_${anio}.csv`);
  res.send('\uFEFF' + csv);
});

module.exports = router;
