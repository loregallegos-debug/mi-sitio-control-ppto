#!/usr/bin/env python3
"""
FinTrack v3 — Script de carga de datos
Ejecutar: python3 scripts/seed.py
Reset:    python3 scripts/seed.py --reset
"""

import sys
import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH  = os.path.join(BASE_DIR, 'db', 'fintrack.db')
RESET    = '--reset' in sys.argv

TC_UF  = 37.50
TC_CLP = 0.00105
TC_BRL = 0.19

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db

SCHEMA = """
CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, pm TEXT DEFAULT '', color TEXT DEFAULT '#1B3A6B', activo INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS codigos (id TEXT PRIMARY KEY, codigo TEXT NOT NULL, descripcion TEXT DEFAULT '', tipo TEXT NOT NULL, naturaleza TEXT NOT NULL, team_id TEXT, presupuesto REAL DEFAULT 0, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS proveedores (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, moneda TEXT DEFAULT 'USD', categoria TEXT DEFAULT 'FTE', activo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS personas (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, cargo TEXT DEFAULT '', empresa TEXT DEFAULT '', tipo TEXT DEFAULT 'Externa', email TEXT DEFAULT '', color TEXT DEFAULT '#1B3A6B', estado TEXT DEFAULT 'Activo', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS persona_teams (id TEXT PRIMARY KEY, persona_id TEXT NOT NULL, team_id TEXT NOT NULL, pct INTEGER DEFAULT 100, UNIQUE(persona_id, team_id));
CREATE TABLE IF NOT EXISTS presupuestos (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, codigo_id TEXT NOT NULL, anio INTEGER NOT NULL, mes INTEGER NOT NULL, monto REAL DEFAULT 0, UNIQUE(team_id, codigo_id, anio, mes));
CREATE TABLE IF NOT EXISTS pagos (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, codigo_id TEXT NOT NULL, proveedor_id TEXT, persona_id TEXT, categoria TEXT DEFAULT 'FTE', fecha TEXT NOT NULL, anio INTEGER NOT NULL, mes INTEGER NOT NULL, monto_orig REAL NOT NULL, moneda TEXT DEFAULT 'USD', tc REAL DEFAULT 1, monto_usd REAL NOT NULL, pct_codigo INTEGER DEFAULT 100, descripcion TEXT DEFAULT '', dias INTEGER DEFAULT 21, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS forecast (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, codigo_id TEXT NOT NULL, anio INTEGER NOT NULL, mes INTEGER NOT NULL, monto REAL DEFAULT 0, UNIQUE(team_id, codigo_id, anio, mes));
CREATE TABLE IF NOT EXISTS tipos_cambio (id TEXT PRIMARY KEY, fecha TEXT NOT NULL, moneda TEXT NOT NULL, valor REAL NOT NULL, fuente TEXT DEFAULT 'Manual', UNIQUE(fecha, moneda));
CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
"""

def run():
    db = get_db()
    db.executescript(SCHEMA)
    db.commit()

    if RESET:
        print('🗑️  Limpiando base de datos...')
        db.executescript("""
            DELETE FROM pagos; DELETE FROM presupuestos; DELETE FROM forecast;
            DELETE FROM persona_teams; DELETE FROM personas; DELETE FROM codigos;
            DELETE FROM proveedores; DELETE FROM teams; DELETE FROM tipos_cambio;
            DELETE FROM configuracion;
        """)
        db.commit()

    # Verificar si ya hay datos
    n = db.execute('SELECT COUNT(*) FROM teams').fetchone()[0]
    if n > 0 and not RESET:
        print(f'ℹ️  Ya hay {n} teams. Usa --reset para recargar.')
        db.close()
        return

    print('🌱 Cargando datos reales...\n')

    # ── TEAMS ──────────────────────────────────────────────────────
    teams = [
        ('T1','Dispatch Management',   'Maria Jesus Vilas',  '#1B3A6B'),
        ('T2','FlightOps Engineering', 'Catalina Silvestre', '#00A8A8'),
        ('T3','DispatchCore Systems',  'Thiago Moura',       '#FB8C00'),
    ]
    db.executemany('INSERT OR REPLACE INTO teams (id,nombre,pm,color) VALUES (?,?,?,?)', teams)
    print(f'  ✅ {len(teams)} teams')

    # ── CODIGOS ────────────────────────────────────────────────────
    codigos = [
        ('C1', 'VPA-GCI-26-011','Funding Dev',              'PEP',  'CAPEX','T1', 43000),
        ('C2', 'VPA-GCI-26-030','Funding ADO',              'PEP',  'CAPEX','T1', 81000),
        ('C3', 'VPA-GCI-26-045','BCP OFP',                  'PEP',  'CAPEX','T1', 41000),
        ('C4', 'VPT-GPZ-25-029','Embraer E2',               'PEP',  'CAPEX','T1', 46000),
        ('C5', 'VPA-GCI-26-046','BCP Fligt Tracking',       'PEP',  'CAPEX','T1',120000),
        ('C6', 'VPA-GCI-26-048','BCP Asignación de vuelos', 'PEP',  'CAPEX','T1',  8000),
        ('C7', 'GCLACLMNT531',  '1 FTE',                    'Orden','OPEX', 'T1', 91000),
        ('C8', 'GCLACLMNT080',  '3 FTE',                    'Orden','OPEX', 'T1',348000),
        ('CE1','VPA-GCI-25-010','Funding Dev 2025',          'PEP',  'CAPEX','T1',     0),
        ('CE2','GCLACLMNT553',  'FTE FlightOps',             'Orden','OPEX', 'T2',     0),
        ('CE3','GCLACLMNT554',  'FTE DispatchCore',          'Orden','OPEX', 'T3',     0),
        ('CE4','VPA-GCI-24-042','PEP 2024',                  'PEP',  'CAPEX','T2',     0),
        ('CE5','TAM-VTI-25-002','TAM Brasil 2025',           'PEP',  'CAPEX','T3',     0),
        ('CE6','TAM-VTI-26-004','TAM Brasil 2026',           'PEP',  'CAPEX','T3',     0),
        ('CE7','GCJJBRMNT106',  'FTE Brasil',                'Orden','OPEX', 'T3',     0),
        ('CE8','GCLACLMNT532',  'FTE Stefanini',             'Orden','OPEX', 'T3',     0),
        ('CE9','ADO',           'ADO - Tryolabs',            'Orden','OPEX', 'T1',     0),
    ]
    db.executemany('INSERT OR REPLACE INTO codigos (id,codigo,descripcion,tipo,naturaleza,team_id,presupuesto) VALUES (?,?,?,?,?,?,?)', codigos)
    print(f'  ✅ {len(codigos)} códigos (PEP + Órdenes)')

    # ── PROVEEDORES ────────────────────────────────────────────────
    provs = [
        ('P10','Indra',          'UF', 'FTE'),
        ('P11','NTTData',        'CLP','FTE'),
        ('P12','Acid Labs',      'CLP','FTE'),
        ('P13','Everis Brasil',  'BRL','FTE'),
        ('P14','Tryolabs',       'USD','FTE'),
        ('P15','Stefanini Chile','CLP','FTE'),
    ]
    db.executemany('INSERT OR REPLACE INTO proveedores (id,nombre,moneda,categoria) VALUES (?,?,?,?)', provs)
    print(f'  ✅ {len(provs)} proveedores')

    # ── PERSONAS ───────────────────────────────────────────────────
    personas = [
        ('F1', 'Maria Jesus Vilas',      'PM', 'Dispatch Management',  'Interna', 'mvilas@empresa.cl',    '#1B3A6B','T1'),
        ('F2', 'Catalina Silvestre',     'PM', 'FlightOps Engineering','Interna', 'csilvestre@empresa.cl','#00A8A8','T2'),
        ('F3', 'Thiago Moura',           'PM', 'DispatchCore Systems', 'Interna', 'tmoura@empresa.cl',    '#FB8C00','T3'),
        ('F10','Rodrigo Ulloa',          'FTE','Indra',                'Externa', '',                     '#1B3A6B','T1'),
        ('F11','Nicolas Monarde',        'FTE','Indra',                'Externa', '',                     '#1B3A6B','T1'),
        ('F12','Ricardo Herrera',        'FTE','Indra',                'Externa', '',                     '#1B3A6B','T1'),
        ('F13','Daniela Baeza',          'FTE','NTTData',              'Externa', '',                     '#00A8A8','T1'),
        ('F14','Luis Fuentes',           'FTE','NTTData',              'Externa', '',                     '#00A8A8','T1'),
        ('F15','Rodrigo Quinteros',      'FTE','Acid Labs',            'Externa', '',                     '#FB8C00','T1'),
        ('F16','Maria del Pilar Ureta',  'FTE','Acid Labs',            'Externa', '',                     '#FB8C00','T1'),
        ('F17','Cristian Flores',        'FTE','Acid Labs',            'Externa', '',                     '#FB8C00','T2'),
        ('F18','Ricardo Giovanni Lobos', 'FTE','Acid Labs',            'Externa', '',                     '#FB8C00','T3'),
        ('F19','Nicolas Gomez',          'FTE','Acid Labs',            'Externa', '',                     '#FB8C00','T1'),
        ('F20','Pablo',                  'FTE','Acid Labs',            'Externa', '',                     '#FB8C00','T1'),
        ('F21','Arthur Arantes',         'FTE','Everis Brasil',        'Externa', '',                     '#2E7D32','T3'),
        ('F22','Gabriel Cerdeira',       'FTE','Everis Brasil',        'Externa', '',                     '#2E7D32','T2'),
        ('F23','Nicolas Vasquez',        'FTE','Tryolabs',             'Externa', '',                     '#6C3FC5','T1'),
        ('F24','Kevin Leiva',            'FTE','Stefanini Chile',      'Externa', '',                     '#E53935','T3'),
    ]
    for p in personas:
        db.execute('INSERT OR REPLACE INTO personas (id,nombre,cargo,empresa,tipo,email,color) VALUES (?,?,?,?,?,?,?)',
                   (p[0],p[1],p[2],p[3],p[4],p[5],p[6]))
        db.execute('INSERT OR REPLACE INTO persona_teams (id,persona_id,team_id,pct) VALUES (?,?,?,100)',
                   ('PT'+p[0], p[0], p[7]))
    print(f'  ✅ {len(personas)} personas')

    # ── PRESUPUESTOS 2025 ──────────────────────────────────────────
    ppto = []
    # VPA-GCI-26-011: Feb-Abr $14K
    for m in [2,3,4]: ppto.append((f'B25_1_{m}','T1','C1',2025,m,14000))
    # VPA-GCI-26-030: Feb-Abr $27K
    for m in [2,3,4]: ppto.append((f'B25_2_{m}','T1','C2',2025,m,27000))
    # VPA-GCI-26-045: Feb-Dic $4K
    for m in range(2,13): ppto.append((f'B25_3_{m}','T1','C3',2025,m,4000))
    # VPT-GPZ-25-029: Mar-Abr $8K, May-Jun $16K
    for m in [3,4]: ppto.append((f'B25_4_{m}','T1','C4',2025,m,8000))
    for m in [5,6]: ppto.append((f'B25_4_{m}','T1','C4',2025,m,16000))
    # VPA-GCI-26-046: Jun-Oct $20K, Nov-Dic $10K
    for m in range(6,11): ppto.append((f'B25_5_{m}','T1','C5',2025,m,20000))
    for m in [11,12]: ppto.append((f'B25_5_{m}','T1','C5',2025,m,10000))
    # VPA-GCI-26-048: May $8K
    ppto.append(('B25_6_5','T1','C6',2025,5,8000))
    # GCLACLMNT531: $8K x12
    for m in range(1,13): ppto.append((f'B25_7_{m}','T1','C7',2025,m,8000))
    # GCLACLMNT080: $29K x12
    for m in range(1,13): ppto.append((f'B25_8_{m}','T1','C8',2025,m,29000))

    # ── PRESUPUESTOS 2026 ──────────────────────────────────────────
    for m in [2,3,4]: ppto.append((f'B26_1_{m}','T1','C1',2026,m,14000))
    for m in [2,3,4]: ppto.append((f'B26_2_{m}','T1','C2',2026,m,27000))
    # VPA-GCI-26-045 extendido: Feb-Ago $4K, Sep-Oct $54K, Nov $64K, Dic $4K
    for m in range(2,9): ppto.append((f'B26_3_{m}','T1','C3',2026,m,4000))
    for m in [9,10]: ppto.append((f'B26_3_{m}','T1','C3',2026,m,54000))
    ppto.append(('B26_3_11','T1','C3',2026,11,64000))
    ppto.append(('B26_3_12','T1','C3',2026,12,4000))
    for m in [3,4]: ppto.append((f'B26_4_{m}','T1','C4',2026,m,8000))
    for m in [5,6]: ppto.append((f'B26_4_{m}','T1','C4',2026,m,16000))
    for m in range(6,11): ppto.append((f'B26_5_{m}','T1','C5',2026,m,20000))
    for m in [11,12]: ppto.append((f'B26_5_{m}','T1','C5',2026,m,10000))
    ppto.append(('B26_6_5','T1','C6',2026,5,8000))
    for m in range(1,13): ppto.append((f'B26_7_{m}','T1','C7',2026,m,8000))
    for m in range(1,13): ppto.append((f'B26_8_{m}','T1','C8',2026,m,29000))

    db.executemany('INSERT OR REPLACE INTO presupuestos (id,team_id,codigo_id,anio,mes,monto) VALUES (?,?,?,?,?,?)', ppto)
    print(f'  ✅ {len(ppto)} registros de presupuesto (2025+2026)')

    # ── PAGOS REALES 2026 ──────────────────────────────────────────
    def pago(pid, tid, cid, prov, pers, fec, mes, orig, mon, tc, desc, dias=21):
        usd = round(orig * tc)
        anio = int(fec[:4])
        return (pid,tid,cid,prov,pers,'FTE',fec,anio,mes,orig,mon,tc,usd,100,desc,dias)

    pagos = [
        # ── Indra ──
        pago('P001','T1','CE1','P10','F10','2026-01-31',1, 218.49,'UF', TC_UF, 'Rodrigo Ulloa · 21 días'),
        pago('P002','T1','C1', 'P10','F10','2026-02-28',2, 235,   'UF', TC_UF, 'Rodrigo Ulloa · 21 días'),
        pago('P003','T1','C7', 'P10','F10','2026-03-31',3, 235.2, 'UF', TC_UF, 'Rodrigo Ulloa · 21 días'),
        pago('P004','T1','C8', 'P10','F10','2026-04-30',4, 235.2, 'UF', TC_UF, 'Rodrigo Ulloa · 21 días'),
        pago('P005','T1','CE1','P10','F11','2026-01-31',1, 43.2,  'UF', TC_UF, 'Nicolas Monarde · 6 días', 6),
        pago('P006','T1','C1', 'P10','F12','2026-02-28',2, 1607,  'USD',1,     'Ricardo Herrera · 21 días'),
        pago('P007','T1','C1', 'P10','F12','2026-03-31',3, 1606,  'USD',1,     'Ricardo Herrera · 21 días'),
        pago('P008','T1','C1', 'P10','F12','2026-04-30',4, 1607,  'USD',1,     'Ricardo Herrera · 21 días'),
        # ── NTTData ──
        pago('P009','T1','C8', 'P11','F13','2026-01-31',1, 5616.07,'UF',TC_UF,'Daniela Baeza · 21 días'),
        pago('P010','T1','C8', 'P11','F14','2026-02-28',2, 53486,  'USD',1,   'Luis Fuentes · 21 días'),
        pago('P011','T1','C1', 'P11','F14','2026-03-31',3, 5883.5, 'UF',TC_UF,'Luis Fuentes · 22 días', 22),
        pago('P012','T1','C1', 'P11','F14','2026-04-30',4, 5616.07,'UF',TC_UF,'Luis Fuentes · 21 días'),
        # ── Acid Labs — Rodrigo Quinteros ──
        pago('P013','T1','C8','P12','F15','2026-01-31',1, 5460000,'CLP',TC_CLP,'Rodrigo Quinteros · 21 días'),
        pago('P014','T1','C8','P12','F15','2026-02-28',2, 5200000,'CLP',TC_CLP,'Rodrigo Quinteros · 20 días',20),
        pago('P015','T1','C8','P12','F15','2026-03-31',3, 5720000,'CLP',TC_CLP,'Rodrigo Quinteros · 22 días',22),
        pago('P016','T1','C8','P12','F15','2026-04-30',4, 5460000,'CLP',TC_CLP,'Rodrigo Quinteros · 21 días'),
        # ── Acid Labs — Maria del Pilar Ureta ──
        pago('P017','T1','C8','P12','F16','2026-01-31',1, 4200000,'CLP',TC_CLP,'Maria del Pilar Ureta · 21 días'),
        pago('P018','T1','C8','P12','F16','2026-02-28',2, 4000000,'CLP',TC_CLP,'Maria del Pilar Ureta · 20 días',20),
        pago('P019','T1','C8','P12','F16','2026-03-31',3, 4400000,'CLP',TC_CLP,'Maria del Pilar Ureta · 22 días',22),
        pago('P020','T1','C8','P12','F16','2026-04-30',4, 4200000,'CLP',TC_CLP,'Maria del Pilar Ureta · 21 días'),
        # ── Acid Labs — Cristian Flores (FlightOps) ──
        pago('P021','T2','CE4','P12','F17','2026-01-31',1, 5754000,'CLP',TC_CLP,'Cristian Flores · 21 días'),
        pago('P022','T2','CE2','P12','F17','2026-02-28',2, 2740000,'CLP',TC_CLP,'Cristian Flores · 15 días',15),
        pago('P023','T2','CE2','P12','F17','2026-03-31',3, 6028000,'CLP',TC_CLP,'Cristian Flores · 22 días',22),
        pago('P024','T2','CE2','P12','F17','2026-04-30',4, 5754000,'CLP',TC_CLP,'Cristian Flores · 21 días'),
        # ── Acid Labs — Ricardo Giovanni Lobos (DispatchCore) ──
        pago('P025','T3','C8', 'P12','F18','2026-01-31',1, 5754000,'CLP',TC_CLP,'R. Giovanni Lobos · 21 días'),
        pago('P026','T3','CE3','P12','F18','2026-02-28',2, 5480000,'CLP',TC_CLP,'R. Giovanni Lobos · 20 días',20),
        pago('P027','T3','C1', 'P12','F18','2026-03-31',3, 4658000,'CLP',TC_CLP,'R. Giovanni Lobos · 17 días',17),
        pago('P028','T3','C1', 'P12','F18','2026-04-30',4, 5754000,'CLP',TC_CLP,'R. Giovanni Lobos · 21 días'),
        # ── Acid Labs — Nicolas Gomez ──
        pago('P029','T1','C8','P12','F19','2026-02-28',2, 3900000,'CLP',TC_CLP,'Nicolas Gomez · 15 días',15),
        pago('P030','T1','C7','P12','F19','2026-03-31',3, 5720000,'CLP',TC_CLP,'Nicolas Gomez · 22 días',22),
        pago('P031','T1','C7','P12','F19','2026-04-30',4, 5460000,'CLP',TC_CLP,'Nicolas Gomez · 21 días'),
        # ── Acid Labs — Pablo ──
        pago('P032','T1','C4','P12','F20','2026-03-31',3, 390042,'CLP',TC_CLP,'Pablo · 3 días',3),
        # ── Everis Brasil — Arthur Arantes (BRL real) ──
        pago('P033','T3','CE5','P13','F21','2026-01-31',1, 233432,'BRL',TC_BRL,'Arthur Arantes · 21 días'),
        pago('P034','T3','CE7','P13','F21','2026-02-28',2, 205642,'BRL',TC_BRL,'Arthur Arantes · 19 días',19),
        pago('P035','T3','CE7','P13','F21','2026-03-31',3, 244547,'BRL',TC_BRL,'Arthur Arantes · 22 días',22),
        pago('P036','T3','CE6','P13','F21','2026-04-30',4, 222315,'BRL',TC_BRL,'Arthur Arantes · 21 días'),
        # ── Everis Brasil — Gabriel Cerdeira (BRL real) ──
        pago('P037','T2','CE7','P13','F22','2026-01-31',1, 178610,'BRL',TC_BRL,'Gabriel Cerdeira · 21 días'),
        pago('P038','T2','CE7','P13','F22','2026-02-28',2, 153094,'BRL',TC_BRL,'Gabriel Cerdeira · 18 días',18),
        pago('P040','T2','CE6','P13','F22','2026-04-30',4, 170031,'BRL',TC_BRL,'Gabriel Cerdeira · 21 días'),
        # ── Stefanini — Kevin Leiva ──
        pago('P042','T3','CE8','P15','F24','2026-01-31',1, 5065920,'CLP',TC_CLP,'Kevin Leiva · 21 días'),
        pago('P043','T3','CE8','P15','F24','2026-02-28',2, 3166200,'CLP',TC_CLP,'Kevin Leiva · 21 días'),
        pago('P044','T3','CE8','P15','F24','2026-03-31',3, 6649000,'CLP',TC_CLP,'Kevin Leiva · 21 días'),
        pago('P045','T3','CE8','P15','F24','2026-04-30',4, 6649000,'CLP',TC_CLP,'Kevin Leiva · 21 días'),
    ]
    db.executemany('INSERT OR REPLACE INTO pagos (id,team_id,codigo_id,proveedor_id,persona_id,categoria,fecha,anio,mes,monto_orig,moneda,tc,monto_usd,pct_codigo,descripcion,dias) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', pagos)
    print(f'  ✅ {len(pagos)} pagos reales 2026')

    # ── TIPOS DE CAMBIO ────────────────────────────────────────────
    tcs = [
        ('TC1','2026-04-22','USD',1.0,     'Base'),
        ('TC2','2026-04-22','UF', 37.50,   'CMF Chile'),
        ('TC3','2026-04-22','CLP',0.00105, 'CMF Chile'),
        ('TC4','2026-04-22','BRL',0.19,    'Banco Central BR'),
        ('TC5','2026-04-22','EUR',1.07,    'BCE'),
        ('TC6','2026-01-02','BRL',0.1872,  'Banco Central BR'),
        ('TC7','2025-10-20','UF', 37.24,   'CMF Chile'),
        ('TC8','2025-10-20','CLP',0.001082,'CMF Chile'),
    ]
    db.executemany('INSERT OR REPLACE INTO tipos_cambio (id,fecha,moneda,valor,fuente) VALUES (?,?,?,?,?)', tcs)

    # ── CONFIGURACIÓN ──────────────────────────────────────────────
    cfgs = [
        ('sso_enabled','1'),('sso_microsoft','1'),('sso_google','1'),
        ('sso_okta','0'),('sso_credentials','1'),('alert_email','1'),
    ]
    db.executemany('INSERT OR REPLACE INTO configuracion (clave,valor) VALUES (?,?)', cfgs)

    db.commit()

    # ── RESUMEN ────────────────────────────────────────────────────
    total_usd = db.execute('SELECT ROUND(SUM(monto_usd),0) FROM pagos').fetchone()[0]
    n_ppto    = db.execute('SELECT COUNT(*) FROM presupuestos').fetchone()[0]
    print(f'\n📊 Resumen final:')
    print(f'   Teams:        {len(teams)}')
    print(f'   Códigos:      {len(codigos)}')
    print(f'   Proveedores:  {len(provs)}')
    print(f'   Personas:     {len(personas)}')
    print(f'   Presupuestos: {n_ppto} registros')
    print(f'   Pagos 2026:   {len(pagos)} registros')
    print(f'   Total USD:    ${int(total_usd or 0):,}')
    print(f'\n✅ Seed completado. Inicia el servidor con: python3 server.py')
    db.close()

if __name__ == '__main__':
    run()
