// routes/api.js — Todos los endpoints REST
const express = require('express');
const router  = express.Router();
const { getDB } = require('../db/schema');

const db = getDB();
const newId = (p) => p + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,4).toUpperCase();
const ok  = (res, data) => res.json({ ok: true, data });
const err = (res, msg, code=400) => res.status(code).json({ ok: false, error: msg });

// ════════════════════════════════════════════════
// TEAMS
// ════════════════════════════════════════════════
router.get('/teams', (req, res) => {
  ok(res, db.prepare('SELECT * FROM teams WHERE activo=1 ORDER BY nombre').all());
});
router.post('/teams', (req, res) => {
  const { nombre, pm='', color='#1B3A6B' } = req.body;
  if (!nombre) return err(res, 'nombre requerido');
  const id = newId('T');
  db.prepare('INSERT INTO teams (id,nombre,pm,color) VALUES (?,?,?,?)').run(id, nombre, pm, color);
  ok(res, db.prepare('SELECT * FROM teams WHERE id=?').get(id));
});
router.put('/teams/:id', (req, res) => {
  const { nombre, pm, color, activo } = req.body;
  db.prepare('UPDATE teams SET nombre=COALESCE(?,nombre),pm=COALESCE(?,pm),color=COALESCE(?,color),activo=COALESCE(?,activo) WHERE id=?')
    .run(nombre||null, pm||null, color||null, activo!=null?activo:null, req.params.id);
  ok(res, db.prepare('SELECT * FROM teams WHERE id=?').get(req.params.id));
});
router.delete('/teams/:id', (req, res) => {
  db.prepare('UPDATE teams SET activo=0 WHERE id=?').run(req.params.id);
  ok(res, { id: req.params.id });
});

// ════════════════════════════════════════════════
// CODIGOS
// ════════════════════════════════════════════════
router.get('/codigos', (req, res) => {
  const { team_id, tipo } = req.query;
  let q = 'SELECT c.*,t.nombre as team_nombre,t.color as team_color FROM codigos c LEFT JOIN teams t ON t.id=c.team_id WHERE c.activo=1';
  const p = [];
  if (team_id) { q += ' AND c.team_id=?'; p.push(team_id); }
  if (tipo)    { q += ' AND c.tipo=?';    p.push(tipo); }
  q += ' ORDER BY c.codigo';
  ok(res, db.prepare(q).all(...p));
});
router.post('/codigos', (req, res) => {
  const { codigo, descripcion='', tipo, team_id, presupuesto=0 } = req.body;
  if (!codigo || !tipo) return err(res, 'codigo y tipo requeridos');
  const nat = tipo === 'PEP' ? 'CAPEX' : 'OPEX';
  const id = newId('C');
  db.prepare('INSERT INTO codigos (id,codigo,descripcion,tipo,naturaleza,team_id,presupuesto) VALUES (?,?,?,?,?,?,?)')
    .run(id, codigo, descripcion, tipo, nat, team_id||null, presupuesto);
  ok(res, db.prepare('SELECT * FROM codigos WHERE id=?').get(id));
});
router.put('/codigos/:id', (req, res) => {
  const { codigo, descripcion, tipo, team_id, presupuesto, activo } = req.body;
  const nat = tipo ? (tipo==='PEP'?'CAPEX':'OPEX') : null;
  db.prepare('UPDATE codigos SET codigo=COALESCE(?,codigo),descripcion=COALESCE(?,descripcion),tipo=COALESCE(?,tipo),naturaleza=COALESCE(?,naturaleza),team_id=COALESCE(?,team_id),presupuesto=COALESCE(?,presupuesto),activo=COALESCE(?,activo) WHERE id=?')
    .run(codigo||null,descripcion||null,tipo||null,nat,team_id||null,presupuesto!=null?presupuesto:null,activo!=null?activo:null,req.params.id);
  ok(res, db.prepare('SELECT * FROM codigos WHERE id=?').get(req.params.id));
});
router.delete('/codigos/:id', (req, res) => {
  db.prepare('UPDATE codigos SET activo=0 WHERE id=?').run(req.params.id);
  ok(res, { id: req.params.id });
});

// ════════════════════════════════════════════════
// PROVEEDORES
// ════════════════════════════════════════════════
router.get('/proveedores', (req, res) => {
  ok(res, db.prepare(`SELECT p.*,COALESCE(SUM(g.monto_usd),0) as gasto_ytd
    FROM proveedores p LEFT JOIN pagos g ON g.proveedor_id=p.id AND g.anio=strftime('%Y','now')
    WHERE p.activo=1 GROUP BY p.id ORDER BY p.nombre`).all());
});
router.post('/proveedores', (req, res) => {
  const { nombre, moneda='USD', categoria='FTE' } = req.body;
  if (!nombre) return err(res, 'nombre requerido');
  const id = newId('P');
  db.prepare('INSERT INTO proveedores (id,nombre,moneda,categoria) VALUES (?,?,?,?)').run(id, nombre, moneda, categoria);
  ok(res, db.prepare('SELECT * FROM proveedores WHERE id=?').get(id));
});
router.put('/proveedores/:id', (req, res) => {
  const { nombre, moneda, categoria } = req.body;
  db.prepare('UPDATE proveedores SET nombre=COALESCE(?,nombre),moneda=COALESCE(?,moneda),categoria=COALESCE(?,categoria) WHERE id=?')
    .run(nombre||null, moneda||null, categoria||null, req.params.id);
  ok(res, db.prepare('SELECT * FROM proveedores WHERE id=?').get(req.params.id));
});
router.delete('/proveedores/:id', (req, res) => {
  db.prepare('UPDATE proveedores SET activo=0 WHERE id=?').run(req.params.id);
  ok(res, { id: req.params.id });
});

// ════════════════════════════════════════════════
// PERSONAS / FTE
// ════════════════════════════════════════════════
router.get('/personas', (req, res) => {
  const { team_id, tipo } = req.query;
  let q = `SELECT p.*,
    GROUP_CONCAT(DISTINCT pt.team_id) as team_ids,
    GROUP_CONCAT(DISTINCT t.nombre) as team_nombres,
    GROUP_CONCAT(DISTINCT t.color) as team_colores,
    COALESCE(SUM(g.monto_usd),0) as gasto_total
    FROM personas p
    LEFT JOIN persona_teams pt ON pt.persona_id=p.id
    LEFT JOIN teams t ON t.id=pt.team_id
    LEFT JOIN pagos g ON g.persona_id=p.id
    WHERE p.estado='Activo'`;
  const params = [];
  if (team_id) { q += ' AND pt.team_id=?'; params.push(team_id); }
  if (tipo)    { q += ' AND p.tipo=?';     params.push(tipo); }
  q += ' GROUP BY p.id ORDER BY p.nombre';
  ok(res, db.prepare(q).all(...params));
});
router.get('/personas/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM personas WHERE id=?').get(req.params.id);
  if (!p) return err(res, 'Persona no encontrada', 404);
  const teams = db.prepare('SELECT pt.*,t.nombre,t.color FROM persona_teams pt JOIN teams t ON t.id=pt.team_id WHERE pt.persona_id=?').all(req.params.id);
  const pagos = db.prepare(`SELECT g.*,c.codigo,c.tipo as cod_tipo,c.naturaleza,t.nombre as team_nombre,pv.nombre as prov_nombre
    FROM pagos g LEFT JOIN codigos c ON c.id=g.codigo_id LEFT JOIN teams t ON t.id=g.team_id LEFT JOIN proveedores pv ON pv.id=g.proveedor_id
    WHERE g.persona_id=? ORDER BY g.anio DESC,g.mes DESC`).all(req.params.id);
  ok(res, { ...p, teams, pagos });
});
router.post('/personas', (req, res) => {
  const { nombre, cargo='', empresa='', tipo='Externa', email='', color='#1B3A6B', team_id } = req.body;
  if (!nombre) return err(res, 'nombre requerido');
  const id = newId('F');
  db.prepare('INSERT INTO personas (id,nombre,cargo,empresa,tipo,email,color) VALUES (?,?,?,?,?,?,?)').run(id,nombre,cargo,empresa,tipo,email,color);
  if (team_id) db.prepare('INSERT OR IGNORE INTO persona_teams (id,persona_id,team_id,pct) VALUES (?,?,?,100)').run(newId('PT'),id,team_id);
  ok(res, db.prepare('SELECT * FROM personas WHERE id=?').get(id));
});
router.put('/personas/:id', (req, res) => {
  const { nombre, cargo, empresa, tipo, email, color, estado } = req.body;
  db.prepare('UPDATE personas SET nombre=COALESCE(?,nombre),cargo=COALESCE(?,cargo),empresa=COALESCE(?,empresa),tipo=COALESCE(?,tipo),email=COALESCE(?,email),color=COALESCE(?,color),estado=COALESCE(?,estado) WHERE id=?')
    .run(nombre||null,cargo||null,empresa||null,tipo||null,email||null,color||null,estado||null,req.params.id);
  ok(res, db.prepare('SELECT * FROM personas WHERE id=?').get(req.params.id));
});
router.delete('/personas/:id', (req, res) => {
  db.prepare("UPDATE personas SET estado='Inactivo' WHERE id=?").run(req.params.id);
  ok(res, { id: req.params.id });
});
router.post('/personas/:id/teams', (req, res) => {
  const { team_id, pct=100 } = req.body;
  if (!team_id) return err(res, 'team_id requerido');
  db.prepare('INSERT OR REPLACE INTO persona_teams (id,persona_id,team_id,pct) VALUES (?,?,?,?)').run(newId('PT'),req.params.id,team_id,pct);
  ok(res, { persona_id: req.params.id, team_id, pct });
});
router.delete('/personas/:id/teams/:team_id', (req, res) => {
  db.prepare('DELETE FROM persona_teams WHERE persona_id=? AND team_id=?').run(req.params.id,req.params.team_id);
  ok(res, { removed: true });
});

// ════════════════════════════════════════════════
// HEADCOUNT KPIs
// ════════════════════════════════════════════════
router.get('/fte/headcount', (req, res) => {
  const a = parseInt(req.query.anio||2026);
  const byTeam = db.prepare(`SELECT t.id,t.nombre,t.color,COUNT(DISTINCT g.persona_id) as n,COALESCE(SUM(g.monto_usd),0) as costo
    FROM teams t LEFT JOIN pagos g ON g.team_id=t.id AND g.anio=? WHERE t.activo=1 GROUP BY t.id`).all(a);
  const byQ = [1,2,3,4].map(q => {
    const m = [[1,2,3],[4,5,6],[7,8,9],[10,11,12]][q-1];
    return { q:`Q${q}`, n: db.prepare(`SELECT COUNT(DISTINCT persona_id) as n FROM pagos WHERE anio=? AND mes IN (${m})`).get(a)?.n||0 };
  });
  const byMes = Array.from({length:12},(_,i)=>({
    mes: i+1,
    n: db.prepare('SELECT COUNT(DISTINCT persona_id) as n FROM pagos WHERE anio=? AND mes=?').get(a,i+1)?.n||0
  }));
  const byProv = db.prepare(`SELECT pv.nombre,COALESCE(SUM(g.monto_usd),0) as total,COUNT(DISTINCT g.persona_id) as fte
    FROM pagos g JOIN proveedores pv ON pv.id=g.proveedor_id WHERE g.anio=? GROUP BY pv.id ORDER BY total DESC`).all(a);
  ok(res, { byTeam, byQ, byMes, byProv });
});

// ════════════════════════════════════════════════
// PRESUPUESTOS
// ════════════════════════════════════════════════
router.get('/presupuestos', (req, res) => {
  const { team_id, codigo_id, anio } = req.query;
  let q = 'SELECT b.*,c.codigo,c.tipo,c.naturaleza,c.descripcion FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id WHERE 1=1';
  const p = [];
  if (team_id)   { q+=' AND b.team_id=?';   p.push(team_id); }
  if (codigo_id) { q+=' AND b.codigo_id=?';  p.push(codigo_id); }
  if (anio)      { q+=' AND b.anio=?';       p.push(parseInt(anio)); }
  q += ' ORDER BY b.anio,b.mes';
  ok(res, db.prepare(q).all(...p));
});
router.post('/presupuestos/bulk', (req, res) => {
  const { team_id, codigo_id, anio, meses } = req.body;
  if (!team_id||!codigo_id||!anio||!meses) return err(res,'Datos incompletos');
  const upsert = db.prepare('INSERT INTO presupuestos (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?) ON CONFLICT(team_id,codigo_id,anio,mes) DO UPDATE SET monto=excluded.monto');
  db.transaction(()=> meses.forEach(m => upsert.run(newId('B'),team_id,codigo_id,parseInt(anio),m.mes,m.monto)))();
  ok(res, { updated: meses.length });
});
router.put('/presupuestos/:tid/:cid/:anio/:mes', (req, res) => {
  const { monto } = req.body;
  const { tid, cid, anio, mes } = req.params;
  db.prepare('INSERT INTO presupuestos (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?) ON CONFLICT(team_id,codigo_id,anio,mes) DO UPDATE SET monto=?')
    .run(newId('B'),tid,cid,parseInt(anio),parseInt(mes),monto,monto);
  ok(res, { updated: true });
});

// ════════════════════════════════════════════════
// PAGOS
// ════════════════════════════════════════════════
router.get('/pagos', (req, res) => {
  const { team_id, codigo_id, persona_id, anio, mes, q: quarter } = req.query;
  let q = `SELECT g.*,t.nombre as team_nombre,t.color as team_color,c.codigo as cod_nombre,c.tipo as cod_tipo,c.naturaleza,
    pv.nombre as prov_nombre,pe.nombre as pers_nombre,pe.empresa as pers_empresa
    FROM pagos g LEFT JOIN teams t ON t.id=g.team_id LEFT JOIN codigos c ON c.id=g.codigo_id
    LEFT JOIN proveedores pv ON pv.id=g.proveedor_id LEFT JOIN personas pe ON pe.id=g.persona_id WHERE 1=1`;
  const p = [];
  if (team_id)   { q+=' AND g.team_id=?';   p.push(team_id); }
  if (codigo_id) { q+=' AND g.codigo_id=?';  p.push(codigo_id); }
  if (persona_id){ q+=' AND g.persona_id=?'; p.push(persona_id); }
  if (anio)      { q+=' AND g.anio=?';       p.push(parseInt(anio)); }
  if (mes)       { q+=' AND g.mes=?';        p.push(parseInt(mes)); }
  if (quarter)   {
    const mMap = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};
    const ms = mMap[parseInt(quarter)];
    if (ms) q += ` AND g.mes IN (${ms.join(',')})`;
  }
  q += ' ORDER BY g.anio DESC,g.mes DESC,g.fecha DESC';
  ok(res, db.prepare(q).all(...p));
});
router.post('/pagos', (req, res) => {
  const { team_id,codigo_id,proveedor_id,persona_id,categoria='FTE',fecha,monto_orig,moneda='USD',tc=1,pct_codigo=100,descripcion='',dias=21 } = req.body;
  if (!team_id||!codigo_id||!fecha||!monto_orig) return err(res,'team_id, codigo_id, fecha y monto_orig requeridos');
  const id = newId('G');
  const monto_usd = Math.round(monto_orig * tc * (pct_codigo/100));
  const anio = parseInt(fecha.slice(0,4)), mes = parseInt(fecha.slice(5,7));
  db.prepare('INSERT INTO pagos (id,team_id,codigo_id,proveedor_id,persona_id,categoria,fecha,anio,mes,monto_orig,moneda,tc,monto_usd,pct_codigo,descripcion,dias) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,team_id,codigo_id,proveedor_id||null,persona_id||null,categoria,fecha,anio,mes,monto_orig,moneda,tc,monto_usd,pct_codigo,descripcion,dias);
  ok(res, db.prepare('SELECT * FROM pagos WHERE id=?').get(id));
});
router.put('/pagos/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM pagos WHERE id=?').get(req.params.id);
  if (!cur) return err(res,'Pago no encontrado',404);
  const b = {...cur,...req.body};
  const monto_usd = Math.round(b.monto_orig * b.tc * (b.pct_codigo/100));
  db.prepare('UPDATE pagos SET team_id=?,codigo_id=?,proveedor_id=?,persona_id=?,categoria=?,fecha=?,monto_orig=?,moneda=?,tc=?,monto_usd=?,pct_codigo=?,descripcion=?,dias=? WHERE id=?')
    .run(b.team_id,b.codigo_id,b.proveedor_id||null,b.persona_id||null,b.categoria,b.fecha,b.monto_orig,b.moneda,b.tc,monto_usd,b.pct_codigo,b.descripcion||'',b.dias||21,req.params.id);
  ok(res, db.prepare('SELECT * FROM pagos WHERE id=?').get(req.params.id));
});
router.delete('/pagos/:id', (req, res) => {
  db.prepare('DELETE FROM pagos WHERE id=?').run(req.params.id);
  ok(res, { id: req.params.id });
});

// ════════════════════════════════════════════════
// DASHBOARD KPIs
// ════════════════════════════════════════════════
router.get('/dashboard', (req, res) => {
  const { anio=2026, team_id, periodo='anual', tipo='all', cod_id='' } = req.query;
  const a = parseInt(anio);
  
  let mesFilter = '';
  if (periodo==='q1') mesFilter=' AND g.mes IN (1,2,3)';
  else if (periodo==='q2') mesFilter=' AND g.mes IN (4,5,6)';
  else if (periodo==='q3') mesFilter=' AND g.mes IN (7,8,9)';
  else if (periodo==='q4') mesFilter=' AND g.mes IN (10,11,12)';
  else if (/^\d+$/.test(periodo)) mesFilter=` AND g.mes=${parseInt(periodo)}`;

  let natFilter = tipo==='CAPEX'?" AND c.naturaleza='CAPEX'" : tipo==='OPEX'?" AND c.naturaleza='OPEX'" : '';
  let codFilter = cod_id ? ` AND g.codigo_id='${cod_id}'` : '';
  let teamFilter = team_id ? ` AND g.team_id='${team_id}'` : '';
  let filter = `WHERE g.anio=${a}${mesFilter}${natFilter}${codFilter}${teamFilter}`;

  // Mismo filtro para presupuestos
  let bMesFilter = mesFilter.replace(/g\.mes/g,'b.mes');
  let bNatFilter = natFilter.replace(/c\./g,'c.');
  let bCodFilter = cod_id ? ` AND b.codigo_id='${cod_id}'` : '';
  let bTeamFilter = team_id ? ` AND b.team_id='${team_id}'` : '';
  let bFilter = `WHERE b.anio=${a}${bMesFilter}${bCodFilter}${bTeamFilter}`;

  const real = db.prepare(`SELECT COALESCE(SUM(g.monto_usd),0) as v FROM pagos g JOIN codigos c ON c.id=g.codigo_id ${filter}`).get()?.v || 0;
  const ppto = db.prepare(`SELECT COALESCE(SUM(b.monto),0) as v FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id ${bFilter}${bNatFilter}`).get()?.v || 0;

  const byTeam = db.prepare(`SELECT t.id,t.nombre,t.color,t.pm,
    COALESCE(SUM(g.monto_usd),0) as real_usd,
    (SELECT COALESCE(SUM(b.monto),0) FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id WHERE b.team_id=t.id AND b.anio=${a}${bMesFilter}${bNatFilter}${bCodFilter}) as ppto_usd
    FROM teams t LEFT JOIN pagos g ON g.team_id=t.id JOIN codigos c ON c.id=g.codigo_id ${filter.replace('WHERE','AND t.activo=1 AND')} 
    GROUP BY t.id`).all();

  // Asegurar todos los teams activos aparezcan
  const allTeams = db.prepare('SELECT * FROM teams WHERE activo=1').all();
  const teamMap = {};
  byTeam.forEach(t => teamMap[t.id]=t);
  const byTeamFull = allTeams.map(t => teamMap[t.id] || {...t, real_usd:0, ppto_usd: db.prepare(`SELECT COALESCE(SUM(b.monto),0) as v FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id WHERE b.team_id=? AND b.anio=?${bMesFilter}${bNatFilter}${bCodFilter}`).get(t.id,a)?.v||0});

  const byProv = db.prepare(`SELECT pv.nombre,COALESCE(SUM(g.monto_usd),0) as total FROM pagos g JOIN codigos c ON c.id=g.codigo_id JOIN proveedores pv ON pv.id=g.proveedor_id ${filter} GROUP BY pv.id ORDER BY total DESC LIMIT 8`).all();

  const tendencia = Array.from({length:12},(_,i)=>{
    const m=i+1;
    const tf = `WHERE g.anio=${a} AND g.mes=${m}${natFilter}${codFilter}${teamFilter}`;
    const bf = `WHERE b.anio=${a} AND b.mes=${m}${bNatFilter}${bCodFilter}${bTeamFilter}`;
    return {
      mes: m,
      label: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i],
      real: db.prepare(`SELECT COALESCE(SUM(g.monto_usd),0) as v FROM pagos g JOIN codigos c ON c.id=g.codigo_id ${tf}`).get()?.v||0,
      ppto: db.prepare(`SELECT COALESCE(SUM(b.monto),0) as v FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id ${bf}`).get()?.v||0,
    };
  });

  ok(res, { real, ppto, desv:real-ppto, ejec:ppto?(real/ppto*100):0, byTeam:byTeamFull, byProv, tendencia });
});

// ════════════════════════════════════════════════
// FORECAST
// ════════════════════════════════════════════════
router.get('/forecast', (req, res) => {
  const { team_id, codigo_id, anio=2026 } = req.query;
  let q = 'SELECT * FROM forecast WHERE anio=?';
  const p = [parseInt(anio)];
  if (team_id)   { q+=' AND team_id=?';   p.push(team_id); }
  if (codigo_id) { q+=' AND codigo_id=?'; p.push(codigo_id); }
  ok(res, db.prepare(q).all(...p));
});
router.put('/forecast/:tid/:cid/:anio/:mes', (req, res) => {
  const { monto } = req.body;
  const { tid,cid,anio,mes } = req.params;
  db.prepare('INSERT INTO forecast (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?) ON CONFLICT(team_id,codigo_id,anio,mes) DO UPDATE SET monto=?')
    .run(newId('FC'),tid,cid,parseInt(anio),parseInt(mes),monto,monto);
  ok(res, { updated: true });
});

// ════════════════════════════════════════════════
// TIPOS DE CAMBIO
// ════════════════════════════════════════════════
router.get('/tc', (req, res) => {
  ok(res, db.prepare('SELECT * FROM tipos_cambio ORDER BY fecha DESC').all());
});
router.post('/tc', (req, res) => {
  const { fecha, moneda, valor, fuente='Manual' } = req.body;
  if (!fecha||!moneda||!valor) return err(res,'fecha,moneda,valor requeridos');
  const id = newId('TC');
  db.prepare('INSERT OR REPLACE INTO tipos_cambio (id,fecha,moneda,valor,fuente) VALUES (?,?,?,?,?)').run(id,fecha,moneda,valor,fuente);
  ok(res, { id, fecha, moneda, valor, fuente });
});

// ════════════════════════════════════════════════
// ALERTAS
// ════════════════════════════════════════════════
router.get('/alertas', (req, res) => {
  const a = parseInt(req.query.anio||2026);
  const teams = db.prepare('SELECT * FROM teams WHERE activo=1').all();
  const alertas = [];
  teams.forEach(t => {
    const real = db.prepare('SELECT COALESCE(SUM(monto_usd),0) as v FROM pagos WHERE team_id=? AND anio=?').get(t.id,a)?.v||0;
    const ppto = db.prepare('SELECT COALESCE(SUM(monto),0) as v FROM presupuestos WHERE team_id=? AND anio=?').get(t.id,a)?.v||0;
    if (!ppto) return;
    const pct = real/ppto*100;
    if (pct>110) alertas.push({tipo:'critica',   team:t.nombre,real,ppto,pct:pct.toFixed(1),msg:`Sobre-ejecución +${(pct-100).toFixed(1)}%`});
    else if (pct<65&&real>0) alertas.push({tipo:'advertencia',team:t.nombre,real,ppto,pct:pct.toFixed(1),msg:`Sub-ejecución ${pct.toFixed(1)}%`});
  });
  ok(res, alertas);
});

// ════════════════════════════════════════════════
// CONFIGURACION
// ════════════════════════════════════════════════
router.get('/config', (req, res) => {
  const rows = db.prepare('SELECT * FROM configuracion').all();
  const cfg = {};
  rows.forEach(r => cfg[r.clave]=r.valor);
  ok(res, cfg);
});
router.put('/config', (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO configuracion (clave,valor) VALUES (?,?)');
  db.transaction(()=> Object.entries(req.body).forEach(([k,v])=>upsert.run(k,String(v))))();
  ok(res, { updated: true });
});

// ════════════════════════════════════════════════
// EXPORT CSV
// ════════════════════════════════════════════════
router.get('/export/pagos', (req, res) => {
  const a = parseInt(req.query.anio||2026);
  const pagos = db.prepare(`SELECT g.fecha,t.nombre as team,pe.nombre as persona,pv.nombre as proveedor,g.categoria,c.codigo,c.tipo,g.pct_codigo,g.monto_orig,g.moneda,g.tc,g.monto_usd,g.descripcion,g.dias
    FROM pagos g LEFT JOIN teams t ON t.id=g.team_id LEFT JOIN codigos c ON c.id=g.codigo_id
    LEFT JOIN proveedores pv ON pv.id=g.proveedor_id LEFT JOIN personas pe ON pe.id=g.persona_id
    WHERE g.anio=? ORDER BY g.mes,g.fecha`).all(a);
  const cols = ['Fecha','Team','Persona','Proveedor','Categoría','Código','Tipo','%Cod','Monto Orig','Moneda','TC','USD','Descripción','Días'];
  const csv = [cols,...pagos.map(p=>[p.fecha,p.team,p.persona||'',p.proveedor||'',p.categoria,p.codigo,p.tipo,p.pct_codigo,p.monto_orig,p.moneda,p.tc,p.monto_usd,p.descripcion||'',p.dias])]
    .map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type','text/csv;charset=utf-8');
  res.setHeader('Content-Disposition',`attachment;filename=fintrack_${a}.csv`);
  res.send('\uFEFF'+csv);
});

module.exports = router;
