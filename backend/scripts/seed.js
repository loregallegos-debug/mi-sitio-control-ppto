// scripts/seed.js
// Script de carga de datos iniciales
// Ejecutar: node scripts/seed.js
// Para reset completo: node scripts/seed.js --reset

const { getDB, createSchema } = require('../db/schema');

const RESET = process.argv.includes('--reset');
const TC_UF  = 37.50;
const TC_CLP = 0.00105;

const db = getDB();
createSchema(db);

if (RESET) {
  console.log('🗑️  Limpiando base de datos...');
  db.exec(`
    DELETE FROM pagos; DELETE FROM presupuestos; DELETE FROM forecast;
    DELETE FROM persona_teams; DELETE FROM personas; DELETE FROM codigos;
    DELETE FROM proveedores; DELETE FROM teams; DELETE FROM tipos_cambio;
    DELETE FROM configuracion;
  `);
}

// Verificar si ya hay datos
const existing = db.prepare('SELECT COUNT(*) as n FROM teams').get();
if (existing.n > 0 && !RESET) {
  console.log('ℹ️  Ya existen datos. Usa --reset para limpiar y recargar.');
  process.exit(0);
}

console.log('🌱 Cargando datos...');

// ─────────────────────────────────────────────────────
// TEAMS — datos reales de las imágenes
// ─────────────────────────────────────────────────────
const teams = [
  { id: 'T1', nombre: 'Dispatch Management',   pm: 'Maria Jesus Vilas',   color: '#1B3A6B' },
  { id: 'T2', nombre: 'FlightOps Engineering', pm: 'Catalina Silvestre',  color: '#00A8A8' },
  { id: 'T3', nombre: 'DispatchCore Systems',  pm: 'Thiago Moura',        color: '#FB8C00' },
];

const insTeam = db.prepare('INSERT OR REPLACE INTO teams (id,nombre,pm,color) VALUES (?,?,?,?)');
teams.forEach(t => insTeam.run(t.id, t.nombre, t.pm, t.color));
console.log(`  ✅ ${teams.length} teams`);

// ─────────────────────────────────────────────────────
// CODIGOS PEP y ÓRDENES — datos reales con descripciones
// ─────────────────────────────────────────────────────
const codigos = [
  // PEP CAPEX - Dispatch Management
  { id: 'C1',  codigo: 'VPA-GCI-26-011', descripcion: 'Funding Dev',              tipo: 'PEP',   naturaleza: 'CAPEX', team_id: 'T1', presupuesto:  43000 },
  { id: 'C2',  codigo: 'VPA-GCI-26-030', descripcion: 'Funding ADO',              tipo: 'PEP',   naturaleza: 'CAPEX', team_id: 'T1', presupuesto:  81000 },
  { id: 'C3',  codigo: 'VPA-GCI-26-045', descripcion: 'BCP OFP',                  tipo: 'PEP',   naturaleza: 'CAPEX', team_id: 'T1', presupuesto:  41000 },
  { id: 'C4',  codigo: 'VPT-GPZ-25-029', descripcion: 'Embraer E2',               tipo: 'PEP',   naturaleza: 'CAPEX', team_id: 'T1', presupuesto:  46000 },
  { id: 'C5',  codigo: 'VPA-GCI-26-046', descripcion: 'BCP Fligt Tracking',       tipo: 'PEP',   naturaleza: 'CAPEX', team_id: 'T1', presupuesto: 120000 },
  { id: 'C6',  codigo: 'VPA-GCI-26-048', descripcion: 'BCP Asignación de vuelos', tipo: 'PEP',   naturaleza: 'CAPEX', team_id: 'T1', presupuesto:   8000 },
  // Órdenes OPEX - Dispatch Management
  { id: 'C7',  codigo: 'GCLACLMNT531',   descripcion: '1 FTE',                    tipo: 'Orden', naturaleza: 'OPEX',  team_id: 'T1', presupuesto:  91000 },
  { id: 'C8',  codigo: 'GCLACLMNT080',   descripcion: '3 FTE',                    tipo: 'Orden', naturaleza: 'OPEX',  team_id: 'T1', presupuesto: 348000 },
  // Códigos externos referenciados en pagos 2026
  { id: 'CE1', codigo: 'VPA-GCI-25-010', descripcion: 'Funding Dev 2025',         tipo: 'PEP',   naturaleza: 'CAPEX', team_id: 'T1', presupuesto: 0 },
  { id: 'CE2', codigo: 'GCLACLMNT553',   descripcion: 'FTE FlightOps',            tipo: 'Orden', naturaleza: 'OPEX',  team_id: 'T2', presupuesto: 0 },
  { id: 'CE3', codigo: 'GCLACLMNT554',   descripcion: 'FTE DispatchCore',         tipo: 'Orden', naturaleza: 'OPEX',  team_id: 'T3', presupuesto: 0 },
  { id: 'CE4', codigo: 'VPA-GCI-24-042', descripcion: 'PEP 2024',                 tipo: 'PEP',   naturaleza: 'CAPEX', team_id: 'T2', presupuesto: 0 },
  { id: 'CE5', codigo: 'TAM-VTI-25-002', descripcion: 'TAM Brasil 2025',          tipo: 'PEP',   naturaleza: 'CAPEX', team_id: 'T3', presupuesto: 0 },
  { id: 'CE6', codigo: 'TAM-VTI-26-004', descripcion: 'TAM Brasil 2026',          tipo: 'PEP',   naturaleza: 'CAPEX', team_id: 'T3', presupuesto: 0 },
  { id: 'CE7', codigo: 'GCJJBRMNT106',   descripcion: 'FTE Brasil',               tipo: 'Orden', naturaleza: 'OPEX',  team_id: 'T3', presupuesto: 0 },
  { id: 'CE8', codigo: 'GCLACLMNT532',   descripcion: 'FTE Stefanini',            tipo: 'Orden', naturaleza: 'OPEX',  team_id: 'T3', presupuesto: 0 },
  { id: 'CE9', codigo: 'ADO',            descripcion: 'ADO - Tryolabs',           tipo: 'Orden', naturaleza: 'OPEX',  team_id: 'T1', presupuesto: 0 },
];

const insCod = db.prepare('INSERT OR REPLACE INTO codigos (id,codigo,descripcion,tipo,naturaleza,team_id,presupuesto) VALUES (?,?,?,?,?,?,?)');
codigos.forEach(c => insCod.run(c.id, c.codigo, c.descripcion, c.tipo, c.naturaleza, c.team_id, c.presupuesto));
console.log(`  ✅ ${codigos.length} códigos (PEP + Órdenes)`);

// ─────────────────────────────────────────────────────
// PROVEEDORES reales
// ─────────────────────────────────────────────────────
const proveedores = [
  { id: 'P10', nombre: 'Indra',           moneda: 'UF',  categoria: 'FTE' },
  { id: 'P11', nombre: 'NTTData',         moneda: 'CLP', categoria: 'FTE' },
  { id: 'P12', nombre: 'Acid Labs',       moneda: 'CLP', categoria: 'FTE' },
  { id: 'P13', nombre: 'Everis Brasil',   moneda: 'BRL', categoria: 'FTE' },
  { id: 'P14', nombre: 'Tryolabs',        moneda: 'USD', categoria: 'FTE' },
  { id: 'P15', nombre: 'Stefanini Chile', moneda: 'CLP', categoria: 'FTE' },
];

const insProv = db.prepare('INSERT OR REPLACE INTO proveedores (id,nombre,moneda,categoria) VALUES (?,?,?,?)');
proveedores.forEach(p => insProv.run(p.id, p.nombre, p.moneda, p.categoria));
console.log(`  ✅ ${proveedores.length} proveedores`);

// ─────────────────────────────────────────────────────
// PERSONAS / FTE reales
// ─────────────────────────────────────────────────────
const personas = [
  { id: 'F1',  nombre: 'Maria Jesus Vilas',          cargo: 'PM',  empresa: 'Dispatch Management',  tipo: 'Interna',   color: '#1B3A6B', email: 'mvilas@empresa.cl',      team_id: 'T1' },
  { id: 'F2',  nombre: 'Catalina Silvestre',         cargo: 'PM',  empresa: 'FlightOps Engineering', tipo: 'Interna',   color: '#00A8A8', email: 'csilvestre@empresa.cl',  team_id: 'T2' },
  { id: 'F3',  nombre: 'Thiago Moura',               cargo: 'PM',  empresa: 'DispatchCore Systems',  tipo: 'Interna',   color: '#FB8C00', email: 'tmoura@empresa.cl',       team_id: 'T3' },
  { id: 'F10', nombre: 'Rodrigo Ulloa',              cargo: 'FTE', empresa: 'Indra',                 tipo: 'Externa',   color: '#1B3A6B', email: '',                        team_id: 'T1' },
  { id: 'F11', nombre: 'Nicolas Monarde',            cargo: 'FTE', empresa: 'Indra',                 tipo: 'Externa',   color: '#1B3A6B', email: '',                        team_id: 'T1' },
  { id: 'F12', nombre: 'Ricardo Herrera',            cargo: 'FTE', empresa: 'Indra',                 tipo: 'Externa',   color: '#1B3A6B', email: '',                        team_id: 'T1' },
  { id: 'F13', nombre: 'Daniela Baeza',              cargo: 'FTE', empresa: 'NTTData',               tipo: 'Externa',   color: '#00A8A8', email: '',                        team_id: 'T1' },
  { id: 'F14', nombre: 'Luis Fuentes',               cargo: 'FTE', empresa: 'NTTData',               tipo: 'Externa',   color: '#00A8A8', email: '',                        team_id: 'T1' },
  { id: 'F15', nombre: 'Rodrigo Quinteros',          cargo: 'FTE', empresa: 'Acid Labs',             tipo: 'Externa',   color: '#FB8C00', email: '',                        team_id: 'T1' },
  { id: 'F16', nombre: 'Maria del Pilar Ureta',      cargo: 'FTE', empresa: 'Acid Labs',             tipo: 'Externa',   color: '#FB8C00', email: '',                        team_id: 'T1' },
  { id: 'F17', nombre: 'Cristian Flores',            cargo: 'FTE', empresa: 'Acid Labs',             tipo: 'Externa',   color: '#FB8C00', email: '',                        team_id: 'T2' },
  { id: 'F18', nombre: 'Ricardo Giovanni Lobos',     cargo: 'FTE', empresa: 'Acid Labs',             tipo: 'Externa',   color: '#FB8C00', email: '',                        team_id: 'T3' },
  { id: 'F19', nombre: 'Nicolas Gomez',              cargo: 'FTE', empresa: 'Acid Labs',             tipo: 'Externa',   color: '#FB8C00', email: '',                        team_id: 'T1' },
  { id: 'F20', nombre: 'Pablo',                      cargo: 'FTE', empresa: 'Acid Labs',             tipo: 'Externa',   color: '#FB8C00', email: '',                        team_id: 'T1' },
  { id: 'F21', nombre: 'Arthur Arantes',             cargo: 'FTE', empresa: 'Everis Brasil',         tipo: 'Externa',   color: '#2E7D32', email: '',                        team_id: 'T3' },
  { id: 'F22', nombre: 'Gabriel Cerdeira',           cargo: 'FTE', empresa: 'Everis Brasil',         tipo: 'Externa',   color: '#2E7D32', email: '',                        team_id: 'T2' },
  { id: 'F23', nombre: 'Nicolas Vasquez',            cargo: 'FTE', empresa: 'Tryolabs',              tipo: 'Externa',   color: '#6C3FC5', email: '',                        team_id: 'T1' },
  { id: 'F24', nombre: 'Kevin Leiva',                cargo: 'FTE', empresa: 'Stefanini Chile',       tipo: 'Externa',   color: '#E53935', email: '',                        team_id: 'T3' },
];

const insPers = db.prepare('INSERT OR REPLACE INTO personas (id,nombre,cargo,empresa,tipo,color,email) VALUES (?,?,?,?,?,?,?)');
const insPT   = db.prepare('INSERT OR REPLACE INTO persona_teams (id,persona_id,team_id,pct) VALUES (?,?,?,100)');
personas.forEach(p => {
  insPers.run(p.id, p.nombre, p.cargo, p.empresa, p.tipo, p.color, p.email);
  insPT.run('PT'+p.id, p.id, p.team_id);
});
console.log(`  ✅ ${personas.length} personas`);

// ─────────────────────────────────────────────────────
// PRESUPUESTOS 2025 — datos reales de imagen
// ─────────────────────────────────────────────────────
const insPpto = db.prepare('INSERT OR REPLACE INTO presupuestos (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?)');

function seedPpto(id, tid, cid, anio, mes, monto) {
  insPpto.run(id, tid, cid, anio, mes, monto);
}

// VPA-GCI-26-011: Feb $14K, Mar $14K, Abr $14K
seedPpto('B25_1_2','T1','C1',2025,2,14000); seedPpto('B25_1_3','T1','C1',2025,3,14000); seedPpto('B25_1_4','T1','C1',2025,4,14000);
// VPA-GCI-26-030: Feb $27K, Mar $27K, Abr $27K
seedPpto('B25_2_2','T1','C2',2025,2,27000); seedPpto('B25_2_3','T1','C2',2025,3,27000); seedPpto('B25_2_4','T1','C2',2025,4,27000);
// VPA-GCI-26-045: Feb-Dic $4K
for(let m=2;m<=12;m++) seedPpto(`B25_3_${m}`,'T1','C3',2025,m,4000);
// VPT-GPZ-25-029: Mar $8K, Abr $8K, May $16K, Jun $16K
seedPpto('B25_4_3','T1','C4',2025,3,8000); seedPpto('B25_4_4','T1','C4',2025,4,8000);
seedPpto('B25_4_5','T1','C4',2025,5,16000); seedPpto('B25_4_6','T1','C4',2025,6,16000);
// VPA-GCI-26-046: Jun-Oct $20K, Nov-Dic $10K
[6,7,8,9,10].forEach(m => seedPpto(`B25_5_${m}`,'T1','C5',2025,m,20000));
seedPpto('B25_5_11','T1','C5',2025,11,10000); seedPpto('B25_5_12','T1','C5',2025,12,10000);
// VPA-GCI-26-048: May $8K
seedPpto('B25_6_5','T1','C6',2025,5,8000);
// GCLACLMNT531: $8K x12
for(let m=1;m<=12;m++) seedPpto(`B25_7_${m}`,'T1','C7',2025,m,8000);
// GCLACLMNT080: $29K x12
for(let m=1;m<=12;m++) seedPpto(`B25_8_${m}`,'T1','C8',2025,m,29000);

// ─────────────────────────────────────────────────────
// PRESUPUESTOS 2026 — datos reales de imagen
// ─────────────────────────────────────────────────────
// VPA-GCI-26-011: Feb $14K, Mar $14K, Abr $14K
seedPpto('B26_1_2','T1','C1',2026,2,14000); seedPpto('B26_1_3','T1','C1',2026,3,14000); seedPpto('B26_1_4','T1','C1',2026,4,14000);
// VPA-GCI-26-030: Feb $27K, Mar $27K, Abr $27K
seedPpto('B26_2_2','T1','C2',2026,2,27000); seedPpto('B26_2_3','T1','C2',2026,3,27000); seedPpto('B26_2_4','T1','C2',2026,4,27000);
// VPA-GCI-26-045 (BCP OFP extendido): Feb-Ago $4K, Sep-Oct $54K, Nov $64K, Dic $4K
for(let m=2;m<=8;m++) seedPpto(`B26_3_${m}`,'T1','C3',2026,m,4000);
seedPpto('B26_3_9','T1','C3',2026,9,54000); seedPpto('B26_3_10','T1','C3',2026,10,54000);
seedPpto('B26_3_11','T1','C3',2026,11,64000); seedPpto('B26_3_12','T1','C3',2026,12,4000);
// VPT-GPZ-25-029 Embraer E2: Mar $8K, Abr $8K, May $16K, Jun $16K
seedPpto('B26_4_3','T1','C4',2026,3,8000); seedPpto('B26_4_4','T1','C4',2026,4,8000);
seedPpto('B26_4_5','T1','C4',2026,5,16000); seedPpto('B26_4_6','T1','C4',2026,6,16000);
// VPA-GCI-26-046: Jun-Oct $20K, Nov-Dic $10K
[6,7,8,9,10].forEach(m => seedPpto(`B26_5_${m}`,'T1','C5',2026,m,20000));
seedPpto('B26_5_11','T1','C5',2026,11,10000); seedPpto('B26_5_12','T1','C5',2026,12,10000);
// VPA-GCI-26-048: May $8K
seedPpto('B26_6_5','T1','C6',2026,5,8000);
// GCLACLMNT531: $8K x12
for(let m=1;m<=12;m++) seedPpto(`B26_7_${m}`,'T1','C7',2026,m,8000);
// GCLACLMNT080: $29K x12
for(let m=1;m<=12;m++) seedPpto(`B26_8_${m}`,'T1','C8',2026,m,29000);

const nPpto = db.prepare('SELECT COUNT(*) as n FROM presupuestos').get().n;
console.log(`  ✅ ${nPpto} registros de presupuesto (2025+2026)`);

// ─────────────────────────────────────────────────────
// PAGOS REALES 2026 — planilla MC Operaciones
// ─────────────────────────────────────────────────────
const insPago = db.prepare(`INSERT OR REPLACE INTO pagos 
  (id,team_id,codigo_id,proveedor_id,persona_id,categoria,fecha,anio,mes,monto_orig,moneda,tc,monto_usd,pct_codigo,descripcion,dias) 
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

function pago(id, tid, cid, pid, fteId, fec, mes, orig, mon, tc, desc, dias=21) {
  const usd = Math.round(orig * tc);
  const anio = parseInt(fec.slice(0,4));
  insPago.run(id,tid,cid,pid,fteId,'FTE',fec,anio,mes,orig,mon,tc,usd,100,desc,dias);
}

// Indra - Rodrigo Ulloa
pago('P001','T1','CE1','P10','F10','2026-01-31',1, 218.49,'UF', TC_UF, 'Rodrigo Ulloa · 21 días');
pago('P002','T1','C1', 'P10','F10','2026-02-28',2, 235,   'UF', TC_UF, 'Rodrigo Ulloa · 21 días');
pago('P003','T1','C7', 'P10','F10','2026-03-31',3, 235.2, 'UF', TC_UF, 'Rodrigo Ulloa · 21 días');
pago('P004','T1','C8', 'P10','F10','2026-04-30',4, 235.2, 'UF', TC_UF, 'Rodrigo Ulloa · 21 días');
// Indra - Nicolas Monarde
pago('P005','T1','CE1','P10','F11','2026-01-31',1, 43.2, 'UF', TC_UF, 'Nicolas Monarde · 6 días',6);
// Indra - Ricardo Herrera
pago('P006','T1','C1','P10','F12','2026-02-28',2, 1607,'USD',1,'Ricardo Herrera · 21 días');
pago('P007','T1','C1','P10','F12','2026-03-31',3, 1606,'USD',1,'Ricardo Herrera · 21 días');
pago('P008','T1','C1','P10','F12','2026-04-30',4, 1607,'USD',1,'Ricardo Herrera · 21 días');
// NTTData - Daniela Baeza
pago('P009','T1','C8','P11','F13','2026-01-31',1, 5616.07,'UF',TC_UF,'Daniela Baeza · 21 días');
// NTTData - Luis Fuentes
pago('P010','T1','C8','P11','F14','2026-02-28',2, 53486,'USD',1,'Luis Fuentes · 21 días');
pago('P011','T1','C1','P11','F14','2026-03-31',3, 5883.5,'UF',TC_UF,'Luis Fuentes · 22 días',22);
pago('P012','T1','C1','P11','F14','2026-04-30',4, 5616.07,'UF',TC_UF,'Luis Fuentes · 21 días');
// Acid Labs - Rodrigo Quinteros
pago('P013','T1','C8','P12','F15','2026-01-31',1, 5460000,'CLP',TC_CLP,'Rodrigo Quinteros · 21 días');
pago('P014','T1','C8','P12','F15','2026-02-28',2, 5200000,'CLP',TC_CLP,'Rodrigo Quinteros · 20 días',20);
pago('P015','T1','C8','P12','F15','2026-03-31',3, 5720000,'CLP',TC_CLP,'Rodrigo Quinteros · 22 días',22);
pago('P016','T1','C8','P12','F15','2026-04-30',4, 5460000,'CLP',TC_CLP,'Rodrigo Quinteros · 21 días');
// Acid Labs - Maria del Pilar Ureta
pago('P017','T1','C8','P12','F16','2026-01-31',1, 4200000,'CLP',TC_CLP,'Maria del Pilar Ureta · 21 días');
pago('P018','T1','C8','P12','F16','2026-02-28',2, 4000000,'CLP',TC_CLP,'Maria del Pilar Ureta · 20 días',20);
pago('P019','T1','C8','P12','F16','2026-03-31',3, 4400000,'CLP',TC_CLP,'Maria del Pilar Ureta · 22 días',22);
pago('P020','T1','C8','P12','F16','2026-04-30',4, 4200000,'CLP',TC_CLP,'Maria del Pilar Ureta · 21 días');
// Acid Labs - Cristian Flores (FlightOps)
pago('P021','T2','CE4','P12','F17','2026-01-31',1, 5754000,'CLP',TC_CLP,'Cristian Flores · 21 días');
pago('P022','T2','CE2','P12','F17','2026-02-28',2, 2740000,'CLP',TC_CLP,'Cristian Flores · 15 días',15);
pago('P023','T2','CE2','P12','F17','2026-03-31',3, 6028000,'CLP',TC_CLP,'Cristian Flores · 22 días',22);
pago('P024','T2','CE2','P12','F17','2026-04-30',4, 5754000,'CLP',TC_CLP,'Cristian Flores · 21 días');
// Acid Labs - Ricardo Giovanni Lobos (DispatchCore)
pago('P025','T3','C8', 'P12','F18','2026-01-31',1, 5754000,'CLP',TC_CLP,'R. Giovanni Lobos · 21 días');
pago('P026','T3','CE3','P12','F18','2026-02-28',2, 5480000,'CLP',TC_CLP,'R. Giovanni Lobos · 20 días',20);
pago('P027','T3','C1', 'P12','F18','2026-03-31',3, 4658000,'CLP',TC_CLP,'R. Giovanni Lobos · 17 días',17);
pago('P028','T3','C1', 'P12','F18','2026-04-30',4, 5754000,'CLP',TC_CLP,'R. Giovanni Lobos · 17 días',17);
// Acid Labs - Nicolas Gomez
pago('P029','T1','C8','P12','F19','2026-02-28',2, 3900000,'CLP',TC_CLP,'Nicolas Gomez · 15 días',15);
pago('P030','T1','C7','P12','F19','2026-03-31',3, 5720000,'CLP',TC_CLP,'Nicolas Gomez · 22 días',22);
pago('P031','T1','C7','P12','F19','2026-04-30',4, 5460000,'CLP',TC_CLP,'Nicolas Gomez · 21 días');
// Acid Labs - Pablo
pago('P032','T1','C4','P12','F20','2026-03-31',3, 390042,'CLP',TC_CLP,'Pablo · 3 días',3);
// Everis Brasil - Arthur Arantes (BRL real)
pago('P033','T3','CE5','P13','F21','2026-01-31',1, 233432,'BRL',0.19,'Arthur Arantes · 21 días');
pago('P034','T3','CE7','P13','F21','2026-02-28',2, 205642,'BRL',0.19,'Arthur Arantes · 19 días',19);
pago('P035','T3','CE7','P13','F21','2026-03-31',3, 244547,'BRL',0.19,'Arthur Arantes · 22 días',22);
pago('P036','T3','CE6','P13','F21','2026-04-30',4, 222315,'BRL',0.19,'Arthur Arantes · 21 días');
// Everis Brasil - Gabriel Cerdeira (BRL real)
pago('P037','T2','CE7','P13','F22','2026-01-31',1, 178610,'BRL',0.19,'Gabriel Cerdeira · 21 días');
pago('P038','T2','CE7','P13','F22','2026-02-28',2, 153094,'BRL',0.19,'Gabriel Cerdeira · 18 días',18);
pago('P040','T2','CE6','P13','F22','2026-04-30',4, 170031,'BRL',0.19,'Gabriel Cerdeira · 21 días');
// Stefanini - Kevin Leiva (DispatchCore)
pago('P042','T3','CE8','P15','F24','2026-01-31',1, 5065920,'CLP',TC_CLP,'Kevin Leiva · 21 días');
pago('P043','T3','CE8','P15','F24','2026-02-28',2, 3166200,'CLP',TC_CLP,'Kevin Leiva · 21 días');
pago('P044','T3','CE8','P15','F24','2026-03-31',3, 6649000,'CLP',TC_CLP,'Kevin Leiva · 21 días');
pago('P045','T3','CE8','P15','F24','2026-04-30',4, 6649000,'CLP',TC_CLP,'Kevin Leiva · 21 días');

const nPagos = db.prepare('SELECT COUNT(*) as n FROM pagos').get().n;
console.log(`  ✅ ${nPagos} pagos reales 2026`);

// ─────────────────────────────────────────────────────
// TIPOS DE CAMBIO
// ─────────────────────────────────────────────────────
const insTC = db.prepare('INSERT OR REPLACE INTO tipos_cambio (id,fecha,moneda,valor,fuente) VALUES (?,?,?,?,?)');
const tcs = [
  ['TC1','2026-04-22','USD',1.0,     'Base'],
  ['TC2','2026-04-22','UF', 37.50,   'CMF Chile'],
  ['TC3','2026-04-22','CLP',0.00105, 'CMF Chile'],
  ['TC4','2026-04-22','BRL',0.19,    'Banco Central BR'],
  ['TC5','2026-04-22','EUR',1.07,    'BCE'],
  ['TC6','2026-01-02','BRL',0.1872,  'Banco Central BR'],
  ['TC7','2025-10-20','UF', 37.24,   'CMF Chile'],
  ['TC8','2025-10-20','CLP',0.001082,'CMF Chile'],
];
tcs.forEach(t => insTC.run(...t));
console.log(`  ✅ ${tcs.length} tipos de cambio`);

// ─────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────
const insCfg = db.prepare('INSERT OR REPLACE INTO configuracion (clave,valor) VALUES (?,?)');
const configs = {
  sso_enabled: '1', sso_microsoft: '1', sso_google: '1',
  sso_okta: '0', sso_credentials: '1', sso_mfa: '0', alert_email: '1'
};
Object.entries(configs).forEach(([k,v]) => insCfg.run(k,v));

// ─────────────────────────────────────────────────────
// RESUMEN FINAL
// ─────────────────────────────────────────────────────
const summary = {
  teams:        db.prepare('SELECT COUNT(*) as n FROM teams').get().n,
  codigos:      db.prepare('SELECT COUNT(*) as n FROM codigos').get().n,
  proveedores:  db.prepare('SELECT COUNT(*) as n FROM proveedores').get().n,
  personas:     db.prepare('SELECT COUNT(*) as n FROM personas').get().n,
  presupuestos: db.prepare('SELECT COUNT(*) as n FROM presupuestos').get().n,
  pagos:        db.prepare('SELECT COUNT(*) as n FROM pagos').get().n,
  total_usd:    db.prepare('SELECT ROUND(SUM(monto_usd),0) as v FROM pagos').get().v,
};

console.log('\n📊 Resumen:');
Object.entries(summary).forEach(([k,v]) => console.log(`   ${k}: ${typeof v==='number'&&k==='total_usd'?'$'+v.toLocaleString():v}`));
console.log('\n✅ Seed completado exitosamente!');
db.close();
