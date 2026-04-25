#!/usr/bin/env python3
"""
FinTrack v3 — Backend Flask + SQLite
Ejecutar: python3 server.py
API en:   http://localhost:3000/api
App en:   http://localhost:3000
"""

import sqlite3
import json
import os
import math
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, Response

# ─── CONFIG ──────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DB_PATH     = os.path.join(BASE_DIR, 'db', 'fintrack.db')
FRONTEND    = os.path.join(BASE_DIR, '..', 'frontend')
PORT        = int(os.environ.get('PORT', 3000))

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

app = Flask(__name__, static_folder=FRONTEND, static_url_path='')

# ─── DB HELPERS ──────────────────────────────────────────────────
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA foreign_keys=ON')
    return db

def rows(cursor):
    return [dict(r) for r in cursor.fetchall()]

def row(cursor):
    r = cursor.fetchone()
    return dict(r) if r else None

def new_id(prefix):
    import random, time
    return prefix + format(int(time.time()*1000), 'x').upper() + ''.join(random.choices('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k=3))

def ok(data):
    return jsonify({'ok': True, 'data': data})

def err(msg, code=400):
    return jsonify({'ok': False, 'error': msg}), code

# ─── SCHEMA ──────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, pm TEXT DEFAULT '',
  color TEXT DEFAULT '#1B3A6B', activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS codigos (
  id TEXT PRIMARY KEY, codigo TEXT NOT NULL, descripcion TEXT DEFAULT '',
  tipo TEXT NOT NULL, naturaleza TEXT NOT NULL, team_id TEXT,
  presupuesto REAL DEFAULT 0, activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS proveedores (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, moneda TEXT DEFAULT 'USD',
  categoria TEXT DEFAULT 'FTE', activo INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, cargo TEXT DEFAULT '',
  empresa TEXT DEFAULT '', tipo TEXT DEFAULT 'Externa', email TEXT DEFAULT '',
  color TEXT DEFAULT '#1B3A6B', estado TEXT DEFAULT 'Activo',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS persona_teams (
  id TEXT PRIMARY KEY, persona_id TEXT NOT NULL, team_id TEXT NOT NULL,
  pct INTEGER DEFAULT 100, UNIQUE(persona_id, team_id)
);
CREATE TABLE IF NOT EXISTS presupuestos (
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, codigo_id TEXT NOT NULL,
  anio INTEGER NOT NULL, mes INTEGER NOT NULL, monto REAL DEFAULT 0,
  UNIQUE(team_id, codigo_id, anio, mes)
);
CREATE TABLE IF NOT EXISTS pagos (
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, codigo_id TEXT NOT NULL,
  proveedor_id TEXT, persona_id TEXT, categoria TEXT DEFAULT 'FTE',
  fecha TEXT NOT NULL, anio INTEGER NOT NULL, mes INTEGER NOT NULL,
  monto_orig REAL NOT NULL, moneda TEXT DEFAULT 'USD', tc REAL DEFAULT 1,
  monto_usd REAL NOT NULL, pct_codigo INTEGER DEFAULT 100,
  descripcion TEXT DEFAULT '', dias INTEGER DEFAULT 21,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS forecast (
  id TEXT PRIMARY KEY, team_id TEXT NOT NULL, codigo_id TEXT NOT NULL,
  anio INTEGER NOT NULL, mes INTEGER NOT NULL, monto REAL DEFAULT 0,
  UNIQUE(team_id, codigo_id, anio, mes)
);
CREATE TABLE IF NOT EXISTS tipos_cambio (
  id TEXT PRIMARY KEY, fecha TEXT NOT NULL, moneda TEXT NOT NULL,
  valor REAL NOT NULL, fuente TEXT DEFAULT 'Manual', UNIQUE(fecha, moneda)
);
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY, valor TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pagos_anio ON pagos(anio, mes);
CREATE INDEX IF NOT EXISTS idx_pagos_team ON pagos(team_id);
CREATE INDEX IF NOT EXISTS idx_ppto_anio ON presupuestos(anio);
"""

def init_db():
    db = get_db()
    db.executescript(SCHEMA)
    db.commit()
    db.close()
    print(f'✅ Base de datos lista: {DB_PATH}')

# ─── FRONTEND ────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory(FRONTEND, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    full = os.path.join(FRONTEND, path)
    if os.path.exists(full):
        return send_from_directory(FRONTEND, path)
    return send_from_directory(FRONTEND, 'index.html')

# ════════════════════════════════════════════════════════════════
# API — TEAMS
# ════════════════════════════════════════════════════════════════
@app.route('/api/teams', methods=['GET'])
def get_teams():
    db = get_db()
    data = rows(db.execute('SELECT * FROM teams WHERE activo=1 ORDER BY nombre'))
    db.close(); return ok(data)

@app.route('/api/teams', methods=['POST'])
def create_team():
    b = request.json or {}
    if not b.get('nombre'): return err('nombre requerido')
    db = get_db()
    tid = new_id('T')
    db.execute('INSERT INTO teams (id,nombre,pm,color) VALUES (?,?,?,?)',
               (tid, b['nombre'], b.get('pm',''), b.get('color','#1B3A6B')))
    db.commit()
    data = row(db.execute('SELECT * FROM teams WHERE id=?', (tid,)))
    db.close(); return ok(data)

@app.route('/api/teams/<tid>', methods=['PUT'])
def update_team(tid):
    b = request.json or {}
    db = get_db()
    db.execute('UPDATE teams SET nombre=COALESCE(?,nombre), pm=COALESCE(?,pm), color=COALESCE(?,color), activo=COALESCE(?,activo) WHERE id=?',
               (b.get('nombre'), b.get('pm'), b.get('color'), b.get('activo'), tid))
    db.commit()
    data = row(db.execute('SELECT * FROM teams WHERE id=?', (tid,)))
    db.close(); return ok(data)

@app.route('/api/teams/<tid>', methods=['DELETE'])
def delete_team(tid):
    db = get_db()
    db.execute('UPDATE teams SET activo=0 WHERE id=?', (tid,))
    db.commit(); db.close(); return ok({'id': tid})

# ════════════════════════════════════════════════════════════════
# API — CODIGOS
# ════════════════════════════════════════════════════════════════
@app.route('/api/codigos', methods=['GET'])
def get_codigos():
    team_id = request.args.get('team_id')
    tipo    = request.args.get('tipo')
    q = 'SELECT c.*,t.nombre as team_nombre,t.color as team_color FROM codigos c LEFT JOIN teams t ON t.id=c.team_id WHERE c.activo=1'
    params = []
    if team_id: q += ' AND c.team_id=?'; params.append(team_id)
    if tipo:    q += ' AND c.tipo=?';    params.append(tipo)
    q += ' ORDER BY c.codigo'
    db = get_db(); data = rows(db.execute(q, params)); db.close(); return ok(data)

@app.route('/api/codigos', methods=['POST'])
def create_codigo():
    b = request.json or {}
    if not b.get('codigo') or not b.get('tipo'): return err('codigo y tipo requeridos')
    nat = 'CAPEX' if b['tipo'] == 'PEP' else 'OPEX'
    db = get_db(); cid = new_id('C')
    db.execute('INSERT INTO codigos (id,codigo,descripcion,tipo,naturaleza,team_id,presupuesto) VALUES (?,?,?,?,?,?,?)',
               (cid, b['codigo'], b.get('descripcion',''), b['tipo'], nat, b.get('team_id'), b.get('presupuesto',0)))
    db.commit()
    data = row(db.execute('SELECT * FROM codigos WHERE id=?', (cid,)))
    db.close(); return ok(data)

@app.route('/api/codigos/<cid>', methods=['PUT'])
def update_codigo(cid):
    b = request.json or {}
    nat = ('CAPEX' if b['tipo']=='PEP' else 'OPEX') if b.get('tipo') else None
    db = get_db()
    db.execute('UPDATE codigos SET codigo=COALESCE(?,codigo),descripcion=COALESCE(?,descripcion),tipo=COALESCE(?,tipo),naturaleza=COALESCE(?,naturaleza),team_id=COALESCE(?,team_id),presupuesto=COALESCE(?,presupuesto),activo=COALESCE(?,activo) WHERE id=?',
               (b.get('codigo'),b.get('descripcion'),b.get('tipo'),nat,b.get('team_id'),b.get('presupuesto'),b.get('activo'),cid))
    db.commit()
    data = row(db.execute('SELECT * FROM codigos WHERE id=?', (cid,)))
    db.close(); return ok(data)

@app.route('/api/codigos/<cid>', methods=['DELETE'])
def delete_codigo(cid):
    db = get_db(); db.execute('UPDATE codigos SET activo=0 WHERE id=?',(cid,)); db.commit(); db.close(); return ok({'id':cid})

# ════════════════════════════════════════════════════════════════
# API — PROVEEDORES
# ════════════════════════════════════════════════════════════════
@app.route('/api/proveedores', methods=['GET'])
def get_proveedores():
    db = get_db()
    data = rows(db.execute("""
        SELECT p.*,COALESCE(SUM(g.monto_usd),0) as gasto_ytd
        FROM proveedores p LEFT JOIN pagos g ON g.proveedor_id=p.id AND g.anio=strftime('%Y','now')
        WHERE p.activo=1 GROUP BY p.id ORDER BY p.nombre"""))
    db.close(); return ok(data)

@app.route('/api/proveedores', methods=['POST'])
def create_proveedor():
    b = request.json or {}
    if not b.get('nombre'): return err('nombre requerido')
    db = get_db(); pid = new_id('P')
    db.execute('INSERT INTO proveedores (id,nombre,moneda,categoria) VALUES (?,?,?,?)',
               (pid, b['nombre'], b.get('moneda','USD'), b.get('categoria','FTE')))
    db.commit()
    data = row(db.execute('SELECT * FROM proveedores WHERE id=?',(pid,)))
    db.close(); return ok(data)

@app.route('/api/proveedores/<pid>', methods=['PUT'])
def update_proveedor(pid):
    b = request.json or {}
    db = get_db()
    db.execute('UPDATE proveedores SET nombre=COALESCE(?,nombre),moneda=COALESCE(?,moneda),categoria=COALESCE(?,categoria) WHERE id=?',
               (b.get('nombre'),b.get('moneda'),b.get('categoria'),pid))
    db.commit()
    data = row(db.execute('SELECT * FROM proveedores WHERE id=?',(pid,)))
    db.close(); return ok(data)

@app.route('/api/proveedores/<pid>', methods=['DELETE'])
def delete_proveedor(pid):
    db = get_db(); db.execute('UPDATE proveedores SET activo=0 WHERE id=?',(pid,)); db.commit(); db.close(); return ok({'id':pid})

# ════════════════════════════════════════════════════════════════
# API — PERSONAS
# ════════════════════════════════════════════════════════════════
@app.route('/api/personas', methods=['GET'])
def get_personas():
    team_id = request.args.get('team_id')
    tipo    = request.args.get('tipo')
    q = """SELECT p.*,
        GROUP_CONCAT(DISTINCT pt.team_id) as team_ids,
        GROUP_CONCAT(DISTINCT t.nombre) as team_nombres,
        GROUP_CONCAT(DISTINCT t.color) as team_colores,
        COALESCE(SUM(g.monto_usd),0) as gasto_total
        FROM personas p
        LEFT JOIN persona_teams pt ON pt.persona_id=p.id
        LEFT JOIN teams t ON t.id=pt.team_id
        LEFT JOIN pagos g ON g.persona_id=p.id
        WHERE p.estado='Activo'"""
    params = []
    if team_id: q += ' AND pt.team_id=?'; params.append(team_id)
    if tipo:    q += ' AND p.tipo=?';     params.append(tipo)
    q += ' GROUP BY p.id ORDER BY p.nombre'
    db = get_db(); data = rows(db.execute(q, params)); db.close(); return ok(data)

@app.route('/api/personas/<pid>', methods=['GET'])
def get_persona(pid):
    db = get_db()
    p = row(db.execute('SELECT * FROM personas WHERE id=?',(pid,)))
    if not p: db.close(); return err('Persona no encontrada', 404)
    teams = rows(db.execute('SELECT pt.*,t.nombre,t.color FROM persona_teams pt JOIN teams t ON t.id=pt.team_id WHERE pt.persona_id=?',(pid,)))
    pagos = rows(db.execute("""SELECT g.*,c.codigo,c.tipo as cod_tipo,c.naturaleza,
        t.nombre as team_nombre,pv.nombre as prov_nombre
        FROM pagos g LEFT JOIN codigos c ON c.id=g.codigo_id
        LEFT JOIN teams t ON t.id=g.team_id LEFT JOIN proveedores pv ON pv.id=g.proveedor_id
        WHERE g.persona_id=? ORDER BY g.anio DESC,g.mes DESC""",(pid,)))
    p['teams'] = teams; p['pagos'] = pagos
    db.close(); return ok(p)

@app.route('/api/personas', methods=['POST'])
def create_persona():
    b = request.json or {}
    if not b.get('nombre'): return err('nombre requerido')
    db = get_db(); fid = new_id('F')
    db.execute('INSERT INTO personas (id,nombre,cargo,empresa,tipo,email,color) VALUES (?,?,?,?,?,?,?)',
               (fid,b['nombre'],b.get('cargo',''),b.get('empresa',''),b.get('tipo','Externa'),b.get('email',''),b.get('color','#1B3A6B')))
    if b.get('team_id'):
        db.execute('INSERT OR IGNORE INTO persona_teams (id,persona_id,team_id,pct) VALUES (?,?,?,100)',
                   (new_id('PT'),fid,b['team_id']))
    db.commit()
    data = row(db.execute('SELECT * FROM personas WHERE id=?',(fid,)))
    db.close(); return ok(data)

@app.route('/api/personas/<fid>', methods=['PUT'])
def update_persona(fid):
    b = request.json or {}
    db = get_db()
    db.execute('UPDATE personas SET nombre=COALESCE(?,nombre),cargo=COALESCE(?,cargo),empresa=COALESCE(?,empresa),tipo=COALESCE(?,tipo),email=COALESCE(?,email),color=COALESCE(?,color),estado=COALESCE(?,estado) WHERE id=?',
               (b.get('nombre'),b.get('cargo'),b.get('empresa'),b.get('tipo'),b.get('email'),b.get('color'),b.get('estado'),fid))
    db.commit()
    data = row(db.execute('SELECT * FROM personas WHERE id=?',(fid,)))
    db.close(); return ok(data)

@app.route('/api/personas/<fid>', methods=['DELETE'])
def delete_persona(fid):
    db = get_db(); db.execute("UPDATE personas SET estado='Inactivo' WHERE id=?",(fid,)); db.commit(); db.close(); return ok({'id':fid})

@app.route('/api/personas/<fid>/teams', methods=['POST'])
def add_persona_team(fid):
    b = request.json or {}
    if not b.get('team_id'): return err('team_id requerido')
    db = get_db()
    db.execute('INSERT OR REPLACE INTO persona_teams (id,persona_id,team_id,pct) VALUES (?,?,?,?)',
               (new_id('PT'),fid,b['team_id'],b.get('pct',100)))
    db.commit(); db.close(); return ok({'persona_id':fid,'team_id':b['team_id']})

# ════════════════════════════════════════════════════════════════
# API — HEADCOUNT KPIs
# ════════════════════════════════════════════════════════════════
@app.route('/api/fte/headcount', methods=['GET'])
def fte_headcount():
    a = int(request.args.get('anio', 2026))
    db = get_db()
    by_team = rows(db.execute("""
        SELECT t.id,t.nombre,t.color,COUNT(DISTINCT g.persona_id) as n,COALESCE(SUM(g.monto_usd),0) as costo
        FROM teams t LEFT JOIN pagos g ON g.team_id=t.id AND g.anio=?
        WHERE t.activo=1 GROUP BY t.id""", (a,)))
    q_map = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
    by_q = []
    for q,ms in q_map.items():
        ph = ','.join('?'*len(ms))
        n = db.execute(f'SELECT COUNT(DISTINCT persona_id) as n FROM pagos WHERE anio=? AND mes IN ({ph})', [a]+ms).fetchone()['n']
        by_q.append({'q':f'Q{q}','n':n or 0})
    by_mes = []
    for m in range(1,13):
        n = db.execute('SELECT COUNT(DISTINCT persona_id) as n FROM pagos WHERE anio=? AND mes=?',(a,m)).fetchone()['n']
        by_mes.append({'mes':m,'n':n or 0})
    by_prov = rows(db.execute("""
        SELECT pv.nombre,COALESCE(SUM(g.monto_usd),0) as total,COUNT(DISTINCT g.persona_id) as fte
        FROM pagos g JOIN proveedores pv ON pv.id=g.proveedor_id WHERE g.anio=?
        GROUP BY pv.id ORDER BY total DESC""", (a,)))
    db.close()
    return ok({'byTeam':by_team,'byQ':by_q,'byMes':by_mes,'byProv':by_prov})

# ════════════════════════════════════════════════════════════════
# API — PRESUPUESTOS
# ════════════════════════════════════════════════════════════════
@app.route('/api/presupuestos', methods=['GET'])
def get_presupuestos():
    team_id   = request.args.get('team_id')
    codigo_id = request.args.get('codigo_id')
    anio      = request.args.get('anio')
    q = 'SELECT b.*,c.codigo,c.tipo,c.naturaleza,c.descripcion FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id WHERE 1=1'
    params = []
    if team_id:   q+=' AND b.team_id=?';   params.append(team_id)
    if codigo_id: q+=' AND b.codigo_id=?';  params.append(codigo_id)
    if anio:      q+=' AND b.anio=?';       params.append(int(anio))
    q += ' ORDER BY b.anio,b.mes'
    db = get_db(); data = rows(db.execute(q, params)); db.close(); return ok(data)

@app.route('/api/presupuestos/bulk', methods=['POST'])
def bulk_presupuesto():
    b = request.json or {}
    if not all([b.get('team_id'),b.get('codigo_id'),b.get('anio'),b.get('meses')]): return err('Datos incompletos')
    db = get_db()
    for m in b['meses']:
        db.execute('INSERT INTO presupuestos (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?) ON CONFLICT(team_id,codigo_id,anio,mes) DO UPDATE SET monto=excluded.monto',
                   (new_id('B'),b['team_id'],b['codigo_id'],int(b['anio']),m['mes'],m['monto']))
    db.commit(); db.close(); return ok({'updated':len(b['meses'])})

@app.route('/api/presupuestos/<tid>/<cid>/<anio>/<mes>', methods=['PUT'])
def update_presupuesto(tid,cid,anio,mes):
    b = request.json or {}
    db = get_db()
    db.execute('INSERT INTO presupuestos (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?) ON CONFLICT(team_id,codigo_id,anio,mes) DO UPDATE SET monto=?',
               (new_id('B'),tid,cid,int(anio),int(mes),b.get('monto',0),b.get('monto',0)))
    db.commit(); db.close(); return ok({'updated':True})

# ════════════════════════════════════════════════════════════════
# API — PAGOS
# ════════════════════════════════════════════════════════════════
@app.route('/api/pagos', methods=['GET'])
def get_pagos():
    team_id   = request.args.get('team_id')
    codigo_id = request.args.get('codigo_id')
    persona_id= request.args.get('persona_id')
    anio      = request.args.get('anio')
    mes       = request.args.get('mes')
    quarter   = request.args.get('q')
    q = """SELECT g.*,t.nombre as team_nombre,t.color as team_color,
        c.codigo as cod_nombre,c.tipo as cod_tipo,c.naturaleza,
        pv.nombre as prov_nombre,pe.nombre as pers_nombre,pe.empresa as pers_empresa
        FROM pagos g LEFT JOIN teams t ON t.id=g.team_id
        LEFT JOIN codigos c ON c.id=g.codigo_id
        LEFT JOIN proveedores pv ON pv.id=g.proveedor_id
        LEFT JOIN personas pe ON pe.id=g.persona_id WHERE 1=1"""
    params = []
    if team_id:    q+=' AND g.team_id=?';    params.append(team_id)
    if codigo_id:  q+=' AND g.codigo_id=?';  params.append(codigo_id)
    if persona_id: q+=' AND g.persona_id=?'; params.append(persona_id)
    if anio:       q+=' AND g.anio=?';       params.append(int(anio))
    if mes:        q+=' AND g.mes=?';        params.append(int(mes))
    if quarter:
        q_map = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]}
        ms = q_map.get(int(quarter),[])
        if ms: q+=f' AND g.mes IN ({",".join(str(m) for m in ms)})'
    q += ' ORDER BY g.anio DESC,g.mes DESC,g.fecha DESC'
    db = get_db(); data = rows(db.execute(q, params)); db.close(); return ok(data)

@app.route('/api/pagos', methods=['POST'])
def create_pago():
    b = request.json or {}
    if not all([b.get('team_id'),b.get('codigo_id'),b.get('fecha'),b.get('monto_orig')]):
        return err('team_id, codigo_id, fecha y monto_orig requeridos')
    gid = new_id('G')
    tc  = float(b.get('tc',1))
    pct = float(b.get('pct_codigo',100))
    usd = round(float(b['monto_orig']) * tc * (pct/100))
    anio= int(b['fecha'][:4])
    mes = int(b['fecha'][5:7])
    db = get_db()
    db.execute('INSERT INTO pagos (id,team_id,codigo_id,proveedor_id,persona_id,categoria,fecha,anio,mes,monto_orig,moneda,tc,monto_usd,pct_codigo,descripcion,dias) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
               (gid,b['team_id'],b['codigo_id'],b.get('proveedor_id'),b.get('persona_id'),b.get('categoria','FTE'),b['fecha'],anio,mes,b['monto_orig'],b.get('moneda','USD'),tc,usd,pct,b.get('descripcion',''),b.get('dias',21)))
    db.commit()
    data = row(db.execute('SELECT * FROM pagos WHERE id=?',(gid,)))
    db.close(); return ok(data)

@app.route('/api/pagos/<gid>', methods=['PUT'])
def update_pago(gid):
    b = request.json or {}
    db = get_db()
    cur = row(db.execute('SELECT * FROM pagos WHERE id=?',(gid,)))
    if not cur: db.close(); return err('Pago no encontrado',404)
    merged = {**cur, **{k:v for k,v in b.items() if v is not None}}
    usd = round(float(merged['monto_orig']) * float(merged['tc']) * (float(merged['pct_codigo'])/100))
    db.execute('UPDATE pagos SET team_id=?,codigo_id=?,proveedor_id=?,persona_id=?,categoria=?,fecha=?,monto_orig=?,moneda=?,tc=?,monto_usd=?,pct_codigo=?,descripcion=?,dias=? WHERE id=?',
               (merged['team_id'],merged['codigo_id'],merged.get('proveedor_id'),merged.get('persona_id'),merged['categoria'],merged['fecha'],merged['monto_orig'],merged['moneda'],merged['tc'],usd,merged['pct_codigo'],merged.get('descripcion',''),merged.get('dias',21),gid))
    db.commit()
    data = row(db.execute('SELECT * FROM pagos WHERE id=?',(gid,)))
    db.close(); return ok(data)

@app.route('/api/pagos/<gid>', methods=['DELETE'])
def delete_pago(gid):
    db = get_db(); db.execute('DELETE FROM pagos WHERE id=?',(gid,)); db.commit(); db.close(); return ok({'id':gid})

# ════════════════════════════════════════════════════════════════
# API — DASHBOARD
# ════════════════════════════════════════════════════════════════
@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    anio    = int(request.args.get('anio', 2026))
    team_id = request.args.get('team_id','')
    periodo = request.args.get('periodo','anual')
    tipo    = request.args.get('tipo','all')
    cod_id  = request.args.get('cod_id','')
    db = get_db()

    # Filtros de mes
    mes_filter = ''
    if periodo == 'q1': mes_filter = ' AND g.mes IN (1,2,3)'
    elif periodo == 'q2': mes_filter = ' AND g.mes IN (4,5,6)'
    elif periodo == 'q3': mes_filter = ' AND g.mes IN (7,8,9)'
    elif periodo == 'q4': mes_filter = ' AND g.mes IN (10,11,12)'
    elif periodo.isdigit(): mes_filter = f' AND g.mes={int(periodo)}'

    nat_filter  = f" AND c.naturaleza='{tipo}'" if tipo in ('CAPEX','OPEX') else ''
    cod_filter  = f" AND g.codigo_id='{cod_id}'" if cod_id else ''
    team_filter = f" AND g.team_id='{team_id}'" if team_id else ''
    b_mes = mes_filter.replace('g.mes','b.mes')
    b_nat = nat_filter.replace('c.','c.')
    b_cod = f" AND b.codigo_id='{cod_id}'" if cod_id else ''
    b_team= f" AND b.team_id='{team_id}'" if team_id else ''

    real = db.execute(f'SELECT COALESCE(SUM(g.monto_usd),0) as v FROM pagos g JOIN codigos c ON c.id=g.codigo_id WHERE g.anio=?{mes_filter}{nat_filter}{cod_filter}{team_filter}', (anio,)).fetchone()['v'] or 0
    ppto = db.execute(f'SELECT COALESCE(SUM(b.monto),0) as v FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id WHERE b.anio=?{b_mes}{b_nat}{b_cod}{b_team}', (anio,)).fetchone()['v'] or 0

    # Por team
    all_teams = rows(db.execute('SELECT * FROM teams WHERE activo=1'))
    by_team = []
    for t in all_teams:
        if team_id and t['id'] != team_id: continue
        r = db.execute(f'SELECT COALESCE(SUM(g.monto_usd),0) as v FROM pagos g JOIN codigos c ON c.id=g.codigo_id WHERE g.anio=? AND g.team_id=?{mes_filter}{nat_filter}{cod_filter}', (anio,t['id'])).fetchone()['v'] or 0
        p = db.execute(f'SELECT COALESCE(SUM(b.monto),0) as v FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id WHERE b.anio=? AND b.team_id=?{b_mes}{b_nat}{b_cod}', (anio,t['id'])).fetchone()['v'] or 0
        by_team.append({**t, 'real_usd':r, 'ppto_usd':p})

    by_prov = rows(db.execute(f'SELECT pv.nombre,COALESCE(SUM(g.monto_usd),0) as total FROM pagos g JOIN codigos c ON c.id=g.codigo_id JOIN proveedores pv ON pv.id=g.proveedor_id WHERE g.anio=?{mes_filter}{nat_filter}{cod_filter}{team_filter} GROUP BY pv.id ORDER BY total DESC LIMIT 8', (anio,)))

    MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    tendencia = []
    for m in range(1,13):
        r = db.execute(f'SELECT COALESCE(SUM(g.monto_usd),0) as v FROM pagos g JOIN codigos c ON c.id=g.codigo_id WHERE g.anio=? AND g.mes=?{nat_filter}{cod_filter}{team_filter}', (anio,m)).fetchone()['v'] or 0
        p = db.execute(f'SELECT COALESCE(SUM(b.monto),0) as v FROM presupuestos b JOIN codigos c ON c.id=b.codigo_id WHERE b.anio=? AND b.mes=?{b_nat}{b_cod}{b_team}', (anio,m)).fetchone()['v'] or 0
        tendencia.append({'mes':m,'label':MES_LABELS[m-1],'real':r,'ppto':p})

    ejec = (real/ppto*100) if ppto else 0
    db.close()
    return ok({'real':real,'ppto':ppto,'desv':real-ppto,'ejec':ejec,'byTeam':by_team,'byProv':by_prov,'tendencia':tendencia})

# ════════════════════════════════════════════════════════════════
# API — FORECAST
# ════════════════════════════════════════════════════════════════
@app.route('/api/forecast', methods=['GET'])
def get_forecast():
    team_id   = request.args.get('team_id')
    codigo_id = request.args.get('codigo_id')
    anio      = int(request.args.get('anio', 2026))
    q = 'SELECT * FROM forecast WHERE anio=?'; params = [anio]
    if team_id:   q+=' AND team_id=?';   params.append(team_id)
    if codigo_id: q+=' AND codigo_id=?'; params.append(codigo_id)
    db = get_db(); data = rows(db.execute(q, params)); db.close(); return ok(data)

@app.route('/api/forecast/<tid>/<cid>/<anio>/<mes>', methods=['PUT'])
def update_forecast(tid,cid,anio,mes):
    b = request.json or {}
    db = get_db()
    db.execute('INSERT INTO forecast (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?) ON CONFLICT(team_id,codigo_id,anio,mes) DO UPDATE SET monto=?',
               (new_id('FC'),tid,cid,int(anio),int(mes),b.get('monto',0),b.get('monto',0)))
    db.commit(); db.close(); return ok({'updated':True})

# ════════════════════════════════════════════════════════════════
# API — ALERTAS
# ════════════════════════════════════════════════════════════════
@app.route('/api/alertas', methods=['GET'])
def get_alertas():
    a = int(request.args.get('anio', 2026))
    db = get_db()
    teams = rows(db.execute('SELECT * FROM teams WHERE activo=1'))
    alertas = []
    for t in teams:
        real = db.execute('SELECT COALESCE(SUM(monto_usd),0) as v FROM pagos WHERE team_id=? AND anio=?',(t['id'],a)).fetchone()['v'] or 0
        ppto = db.execute('SELECT COALESCE(SUM(monto),0) as v FROM presupuestos WHERE team_id=? AND anio=?',(t['id'],a)).fetchone()['v'] or 0
        if not ppto: continue
        pct = real/ppto*100
        if pct > 110:
            alertas.append({'tipo':'critica','team':t['nombre'],'real':real,'ppto':ppto,'pct':f'{pct:.1f}','msg':f'Sobre-ejecución +{pct-100:.1f}%'})
        elif pct < 65 and real > 0:
            alertas.append({'tipo':'advertencia','team':t['nombre'],'real':real,'ppto':ppto,'pct':f'{pct:.1f}','msg':f'Sub-ejecución {pct:.1f}%'})
    db.close(); return ok(alertas)

# ════════════════════════════════════════════════════════════════
# API — TIPOS DE CAMBIO
# ════════════════════════════════════════════════════════════════
@app.route('/api/tc', methods=['GET'])
def get_tc():
    db = get_db(); data = rows(db.execute('SELECT * FROM tipos_cambio ORDER BY fecha DESC')); db.close(); return ok(data)

@app.route('/api/tc', methods=['POST'])
def create_tc():
    b = request.json or {}
    if not all([b.get('fecha'),b.get('moneda'),b.get('valor')]): return err('fecha,moneda,valor requeridos')
    db = get_db()
    tcid = new_id('TC')
    db.execute('INSERT OR REPLACE INTO tipos_cambio (id,fecha,moneda,valor,fuente) VALUES (?,?,?,?,?)',
               (tcid,b['fecha'],b['moneda'],b['valor'],b.get('fuente','Manual')))
    db.commit(); db.close()
    return ok({'id':tcid,'fecha':b['fecha'],'moneda':b['moneda'],'valor':b['valor']})

# ════════════════════════════════════════════════════════════════
# API — CONFIGURACION
# ════════════════════════════════════════════════════════════════
@app.route('/api/config', methods=['GET'])
def get_config():
    db = get_db()
    cfg = {r['clave']:r['valor'] for r in db.execute('SELECT * FROM configuracion').fetchall()}
    db.close(); return ok(cfg)

@app.route('/api/config', methods=['PUT'])
def update_config():
    b = request.json or {}
    db = get_db()
    for k,v in b.items():
        db.execute('INSERT OR REPLACE INTO configuracion (clave,valor) VALUES (?,?)',(k,str(v)))
    db.commit(); db.close(); return ok({'updated':True})

# ════════════════════════════════════════════════════════════════
# API — EXPORT CSV
# ════════════════════════════════════════════════════════════════
@app.route('/api/export/pagos', methods=['GET'])
def export_pagos():
    a = int(request.args.get('anio', 2026))
    db = get_db()
    pagos = rows(db.execute("""
        SELECT g.fecha,t.nombre as team,pe.nombre as persona,pv.nombre as proveedor,
        g.categoria,c.codigo,c.tipo,g.pct_codigo,g.monto_orig,g.moneda,g.tc,g.monto_usd,g.descripcion,g.dias
        FROM pagos g LEFT JOIN teams t ON t.id=g.team_id LEFT JOIN codigos c ON c.id=g.codigo_id
        LEFT JOIN proveedores pv ON pv.id=g.proveedor_id LEFT JOIN personas pe ON pe.id=g.persona_id
        WHERE g.anio=? ORDER BY g.mes,g.fecha""", (a,)))
    db.close()
    cols = ['Fecha','Team','Persona','Proveedor','Categoría','Código','Tipo','%Cod','Monto Orig','Moneda','TC','USD','Descripción','Días']
    def esc(v): return f'"{str(v or "").replace(chr(34), chr(34)+chr(34))}"'
    lines = [','.join(cols)]
    for p in pagos:
        lines.append(','.join(esc(v) for v in [p['fecha'],p['team'],p.get('persona',''),p.get('proveedor',''),p['categoria'],p['codigo'],p['tipo'],p['pct_codigo'],p['monto_orig'],p['moneda'],p['tc'],p['monto_usd'],p.get('descripcion',''),p['dias']]))
    csv = '\uFEFF' + '\n'.join(lines)
    return Response(csv, mimetype='text/csv; charset=utf-8',
                    headers={'Content-Disposition':f'attachment;filename=fintrack_{a}.csv'})

# ─── MAIN ────────────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    print(f'\n🚀 FinTrack corriendo en → http://localhost:{PORT}')
    print(f'   API disponible en      → http://localhost:{PORT}/api')
    print(f'   Para cargar datos:       python3 scripts/seed.py\n')
    app.run(host='0.0.0.0', port=PORT, debug=False)
