#!/usr/bin/env python3
"""FinTrack v3 — Seed completo con TODOS los datos reales del mensaje"""
import sys, os, sqlite3
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH  = os.path.join(BASE_DIR, 'db', 'fintrack.db')
RESET    = '--reset' in sys.argv

TC_UF=37.50; TC_CLP=0.00105; TC_BRL=0.19

SCHEMA="""
CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY,nombre TEXT NOT NULL,pm TEXT DEFAULT '',color TEXT DEFAULT '#1B3A6B',activo INTEGER DEFAULT 1,created_at TEXT DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS codigos(id TEXT PRIMARY KEY,codigo TEXT NOT NULL,descripcion TEXT DEFAULT '',tipo TEXT NOT NULL,naturaleza TEXT NOT NULL,team_id TEXT,presupuesto REAL DEFAULT 0,activo INTEGER DEFAULT 1,created_at TEXT DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS proveedores(id TEXT PRIMARY KEY,nombre TEXT NOT NULL,moneda TEXT DEFAULT 'USD',categoria TEXT DEFAULT 'FTE',activo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS personas(id TEXT PRIMARY KEY,nombre TEXT NOT NULL,cargo TEXT DEFAULT 'FTE',empresa TEXT DEFAULT '',tipo TEXT DEFAULT 'Externa',email TEXT DEFAULT '',color TEXT DEFAULT '#1B3A6B',estado TEXT DEFAULT 'Activo',created_at TEXT DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS persona_teams(id TEXT PRIMARY KEY,persona_id TEXT NOT NULL,team_id TEXT NOT NULL,pct INTEGER DEFAULT 100,UNIQUE(persona_id,team_id));
CREATE TABLE IF NOT EXISTS presupuestos(id TEXT PRIMARY KEY,team_id TEXT NOT NULL,codigo_id TEXT NOT NULL,anio INTEGER NOT NULL,mes INTEGER NOT NULL,monto REAL DEFAULT 0,UNIQUE(team_id,codigo_id,anio,mes));
CREATE TABLE IF NOT EXISTS pagos(id TEXT PRIMARY KEY,team_id TEXT NOT NULL,codigo_id TEXT NOT NULL,proveedor_id TEXT,persona_id TEXT,categoria TEXT DEFAULT 'FTE',fecha TEXT NOT NULL,anio INTEGER NOT NULL,mes INTEGER NOT NULL,monto_orig REAL NOT NULL,moneda TEXT DEFAULT 'USD',tc REAL DEFAULT 1,monto_usd REAL NOT NULL,pct_codigo INTEGER DEFAULT 100,descripcion TEXT DEFAULT '',dias INTEGER DEFAULT 21,created_at TEXT DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS forecast(id TEXT PRIMARY KEY,team_id TEXT NOT NULL,codigo_id TEXT NOT NULL,anio INTEGER NOT NULL,mes INTEGER NOT NULL,monto REAL DEFAULT 0,UNIQUE(team_id,codigo_id,anio,mes));
CREATE TABLE IF NOT EXISTS tipos_cambio(id TEXT PRIMARY KEY,fecha TEXT NOT NULL,moneda TEXT NOT NULL,valor REAL NOT NULL,fuente TEXT DEFAULT 'Manual',UNIQUE(fecha,moneda));
CREATE TABLE IF NOT EXISTS configuracion(clave TEXT PRIMARY KEY,valor TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pagos_anio ON pagos(anio,mes);
CREATE INDEX IF NOT EXISTS idx_pagos_team ON pagos(team_id);
"""

def get_db():
    os.makedirs(os.path.dirname(DB_PATH),exist_ok=True)
    db=sqlite3.connect(DB_PATH); db.row_factory=sqlite3.Row; db.execute('PRAGMA foreign_keys=ON'); return db

def tc_rate(mon): return TC_UF if mon=='UF' else TC_CLP if mon=='CLP' else TC_BRL if mon=='BRL' else 1.0

def pg(pid,tid,cid,prov,pers,fec,mes,orig,mon,dias=21,desc=''):
    tc=tc_rate(mon); usd_v=round(float(orig)*tc); anio=int(fec[:4])
    return(pid,tid,cid,prov,pers,'FTE',fec,anio,mes,float(orig),mon,tc,usd_v,100,desc,int(dias))

def run():
    db=get_db(); db.executescript(SCHEMA); db.commit()
    if RESET:
        print('Limpiando DB...')
        db.executescript("DELETE FROM pagos;DELETE FROM presupuestos;DELETE FROM forecast;DELETE FROM persona_teams;DELETE FROM personas;DELETE FROM codigos;DELETE FROM proveedores;DELETE FROM teams;DELETE FROM tipos_cambio;DELETE FROM configuracion;")
        db.commit()
    n=db.execute('SELECT COUNT(*) FROM teams').fetchone()[0]
    if n>0 and not RESET: print(f'Ya hay {n} teams. Usa --reset'); db.close(); return
    print('Cargando datos...\n')

    # TEAMS
    teams=[('T1','Dispatch Management','Maria Jesus Vilas','#1B3A6B'),('T2','FlightOps Engineering','Catalina Silvestre','#00A8A8'),('T3','DispatchCore Systems','Thiago Moura','#FB8C00')]
    db.executemany('INSERT OR REPLACE INTO teams(id,nombre,pm,color)VALUES(?,?,?,?)',teams)
    print(f'  ✅ {len(teams)} teams')

    # CODIGOS con presupuestos reales del mensaje
    codigos=[
        ('C_531','GCLACLMNT531','FTE Nicolas Gomez / Pablo - Dispatch Mgmt','Orden','OPEX','T1',22670.25*4),
        ('C_080','GCLACLMNT080','FTE múltiples - Dispatch Management','Orden','OPEX','T1',86995.75*4),
        ('C_553','GCLACLMNT553','FTE FlightOps - Cristian Flores','Orden','OPEX','T2',16483.50*4),
        ('C_532','GCLACLMNT532','FTE DispatchCore - Kevin Leiva','Orden','OPEX','T3',20365.50*4),
        ('C_554','GCLACLMNT554','FTE DispatchCore - Ricardo G. Lobos','Orden','OPEX','T3',16483.50*4),
        ('C_106','GCJJBRMNT106','FTE Brasil - Arthur Arantes / Gabriel Cerdeira','Orden','OPEX','T3',24927.00*4),
        ('C_011','VPA-GCI-26-011','Funding Dev - Dispatch Management','PEP','CAPEX','T1',84150.0),
        ('C_030','VPA-GCI-26-030','Funding ADO - Dispatch Management','PEP','CAPEX','T1',81000.0+72000.0),
        ('C_045','VPA-GCI-26-045','BCP OFP - Dispatch Management','PEP','CAPEX','T1',11250.0*4),
        ('C_029','VPT-GPZ-25-029','Embraer E2 - Pablo Acid Labs','PEP','CAPEX','T1',(22500.0+16000.0)*4/3),
        ('C_010','VPA-GCI-25-010','Funding Dev 2025 - Rodrigo Ulloa / Nicolas Monarde','PEP','CAPEX','T1',0),
        ('C_TAM4','TAM-VTI-26-004','TAM Brasil 2026 - Everis Brasil','PEP','CAPEX','T3',(22500.0+24000.0)*4/3),
        ('C_TAM5','TAM-VTI-25-002','TAM Brasil 2025 - Arthur Arantes','PEP','CAPEX','T3',0),
        ('C_ADO','ADO','ADO - Nicolas Vasquez Tryolabs','Orden','OPEX','T1',0),
        ('C_041','VPA-GCI-25-041','PEP adicional 2025','PEP','CAPEX','T1',10400.0*4/3),
        ('C_042','VPA-GCI-24-042','PEP 2024 - FlightOps','PEP','CAPEX','T2',0),
    ]
    db.executemany('INSERT OR REPLACE INTO codigos(id,codigo,descripcion,tipo,naturaleza,team_id,presupuesto)VALUES(?,?,?,?,?,?,?)',codigos)
    print(f'  ✅ {len(codigos)} códigos')

    # PROVEEDORES
    provs=[('P10','Indra','UF','FTE'),('P11','NTTData','CLP','FTE'),('P12','Acid Labs','CLP','FTE'),('P13','Everis Brasil','BRL','FTE'),('P14','Tryolabs','USD','FTE'),('P15','Stefanini Chile','CLP','FTE')]
    db.executemany('INSERT OR REPLACE INTO proveedores(id,nombre,moneda,categoria)VALUES(?,?,?,?)',provs)
    print(f'  ✅ {len(provs)} proveedores')

    # PERSONAS
    personas=[
        ('F1','Maria Jesus Vilas','PM','Dispatch Management','Interna','mvilas@latam.com','#1B3A6B','T1'),
        ('F2','Catalina Silvestre','PM','FlightOps Engineering','Interna','csilvestre@latam.com','#00A8A8','T2'),
        ('F3','Thiago Moura','PM','DispatchCore Systems','Interna','tmoura@latam.com','#FB8C00','T3'),
        ('F10','Rodrigo Ulloa','FTE','Indra','Externa','','#1B3A6B','T1'),
        ('F11','Nicolas Monarde','FTE','Indra','Externa','','#1B3A6B','T1'),
        ('F12','Ricardo Herrera','FTE','Indra','Externa','','#1B3A6B','T1'),
        ('F13','Daniela Baeza','FTE','NTTData','Externa','','#00A8A8','T1'),
        ('F14','Luis Fuentes','FTE','NTTData','Externa','','#00A8A8','T1'),
        ('F15','Rodrigo Quinteros','FTE','Acid Labs','Externa','','#FB8C00','T1'),
        ('F16','Maria del Pilar Ureta','FTE','Acid Labs','Externa','','#FB8C00','T1'),
        ('F17','Cristian Flores','FTE','Acid Labs','Externa','','#FB8C00','T2'),
        ('F18','Ricardo Giovanni Lobos Sepulveda','FTE','Acid Labs','Externa','','#FB8C00','T3'),
        ('F19','Nicolas Gomez','FTE','Acid Labs','Externa','','#FB8C00','T1'),
        ('F20','Pablo','FTE','Acid Labs','Externa','','#FB8C00','T1'),
        ('F21','Arthur Arantes','FTE','Everis Brasil','Externa','','#2E7D32','T3'),
        ('F22','Gabriel Cerdeira','FTE','Everis Brasil','Externa','','#2E7D32','T2'),
        ('F23','Nicolas Vasquez','FTE','Tryolabs','Externa','','#6C3FC5','T1'),
        ('F24','Kevin Leiva','FTE','Stefanini Chile','Externa','','#E53935','T3'),
    ]
    for p in personas:
        db.execute('INSERT OR REPLACE INTO personas(id,nombre,cargo,empresa,tipo,email,color)VALUES(?,?,?,?,?,?,?)',(p[0],p[1],p[2],p[3],p[4],p[5],p[6]))
        db.execute('INSERT OR REPLACE INTO persona_teams(id,persona_id,team_id,pct)VALUES(?,?,?,100)',('PT'+p[0],p[0],p[7]))
    print(f'  ✅ {len(personas)} personas')

    # PRESUPUESTOS 2026 — mensual = total/12
    ppto_total={
        'C_531':{'T1':22670.25*4},'C_080':{'T1':86995.75*4},'C_553':{'T2':16483.50*4},
        'C_532':{'T3':20365.50*4},'C_554':{'T3':16483.50*4},'C_106':{'T3':24927.00*4},
        'C_011':{'T1':84150.0},'C_030':{'T1':153000.0},'C_045':{'T1':45000.0},
        'C_029':{'T1':38500.0},'C_TAM4':{'T3':46500.0},'C_041':{'T1':10400.0},
    }
    ppto_rows=[]
    for cid,teams_m in ppto_total.items():
        for tid,total in teams_m.items():
            mensual=round(total/12,2)
            for mes in range(1,13):
                ppto_rows.append((f'B26_{cid}_{mes}',tid,cid,2026,mes,mensual))
    db.executemany('INSERT OR REPLACE INTO presupuestos(id,team_id,codigo_id,anio,mes,monto)VALUES(?,?,?,?,?,?)',ppto_rows)
    print(f'  ✅ {len(ppto_rows)} registros presupuesto 2026')

    # PAGOS REALES 2026
    pagos=[
        pg('P001','T1','C_010','P10','F10','2026-01-31',1,218.49,'UF',21,'Rodrigo Ulloa Ene'),
        pg('P002','T1','C_011','P10','F10','2026-02-28',2,235,'UF',21,'Rodrigo Ulloa Feb'),
        pg('P003','T1','C_531','P10','F10','2026-03-31',3,235.2,'UF',21,'Rodrigo Ulloa Mar'),
        pg('P004','T1','C_080','P10','F10','2026-04-30',4,235.2,'UF',21,'Rodrigo Ulloa Abr'),
        pg('P005','T1','C_010','P10','F11','2026-01-31',1,43.2,'UF',6,'Nicolas Monarde Ene (6 días)'),
        pg('P006','T1','C_011','P10','F12','2026-02-28',2,1607,'USD',21,'Ricardo Herrera Feb'),
        pg('P007','T1','C_011','P10','F12','2026-03-31',3,1606,'USD',21,'Ricardo Herrera Mar'),
        pg('P008','T1','C_011','P10','F12','2026-04-30',4,1607,'USD',21,'Ricardo Herrera Abr'),
        pg('P009','T1','C_080','P11','F13','2026-01-31',1,5616.07,'UF',21,'Daniela Baeza Ene'),
        pg('P010','T1','C_080','P11','F14','2026-02-28',2,53486,'USD',21,'Luis Fuentes Feb (USD)'),
        pg('P011','T1','C_011','P11','F14','2026-03-31',3,5883.50,'UF',22,'Luis Fuentes Mar (22 días)'),
        pg('P012','T1','C_011','P11','F14','2026-04-30',4,5616.07,'UF',21,'Luis Fuentes Abr'),
        pg('P013','T1','C_080','P12','F15','2026-01-31',1,5460000,'CLP',21,'Rodrigo Quinteros Ene'),
        pg('P014','T1','C_080','P12','F15','2026-02-28',2,5200000,'CLP',20,'Rodrigo Quinteros Feb'),
        pg('P015','T1','C_080','P12','F15','2026-03-31',3,5720000,'CLP',22,'Rodrigo Quinteros Mar'),
        pg('P016','T1','C_080','P12','F15','2026-04-30',4,5460000,'CLP',21,'Rodrigo Quinteros Abr'),
        pg('P017','T1','C_080','P12','F16','2026-01-31',1,4200000,'CLP',21,'Ma. del Pilar Ureta Ene'),
        pg('P018','T1','C_080','P12','F16','2026-02-28',2,4000000,'CLP',20,'Ma. del Pilar Ureta Feb'),
        pg('P019','T1','C_080','P12','F16','2026-03-31',3,4400000,'CLP',22,'Ma. del Pilar Ureta Mar'),
        pg('P020','T1','C_080','P12','F16','2026-04-30',4,4200000,'CLP',21,'Ma. del Pilar Ureta Abr'),
        pg('P021','T2','C_042','P12','F17','2026-01-31',1,5754000,'CLP',21,'Cristian Flores Ene'),
        pg('P022','T2','C_553','P12','F17','2026-02-28',2,2740000,'CLP',15,'Cristian Flores Feb (15 días)'),
        pg('P023','T2','C_553','P12','F17','2026-03-31',3,6028000,'CLP',22,'Cristian Flores Mar'),
        pg('P024','T2','C_553','P12','F17','2026-04-30',4,5754000,'CLP',21,'Cristian Flores Abr'),
        pg('P025','T3','C_080','P12','F18','2026-01-31',1,5754000,'CLP',21,'R. Giovanni Lobos Ene'),
        pg('P026','T3','C_554','P12','F18','2026-02-28',2,5480000,'CLP',20,'R. Giovanni Lobos Feb'),
        pg('P027','T3','C_011','P12','F18','2026-03-31',3,4658000,'CLP',17,'R. Giovanni Lobos Mar'),
        pg('P028','T3','C_011','P12','F18','2026-04-30',4,5754000,'CLP',17,'R. Giovanni Lobos Abr'),
        pg('P029','T1','C_080','P12','F19','2026-02-28',2,3900000,'CLP',15,'Nicolas Gomez Feb'),
        pg('P030','T1','C_531','P12','F19','2026-03-31',3,5720000,'CLP',22,'Nicolas Gomez Mar'),
        pg('P031','T1','C_531','P12','F19','2026-04-30',4,5460000,'CLP',21,'Nicolas Gomez Abr'),
        pg('P032','T1','C_029','P12','F20','2026-03-31',3,390042,'CLP',3,'Pablo Mar (3 días)'),
        pg('P033','T3','C_TAM5','P13','F21','2026-01-31',1,44352,'BRL',21,'Arthur Arantes Ene'),
        pg('P034','T3','C_106','P13','F21','2026-02-28',2,39072,'BRL',19,'Arthur Arantes Feb (19 días)'),
        pg('P035','T3','C_106','P13','F21','2026-03-31',3,46464,'BRL',22,'Arthur Arantes Mar'),
        pg('P036','T3','C_TAM4','P13','F21','2026-04-30',4,42240,'BRL',21,'Arthur Arantes Abr'),
        pg('P037','T2','C_106','P13','F22','2026-01-31',1,33936,'BRL',21,'Gabriel Cerdeira Ene'),
        pg('P038','T2','C_106','P13','F22','2026-02-28',2,29088,'BRL',18,'Gabriel Cerdeira Feb (18 días)'),
        pg('P040','T2','C_TAM4','P13','F22','2026-04-30',4,32306,'BRL',21,'Gabriel Cerdeira Abr'),
        pg('P042','T3','C_532','P15','F24','2026-01-31',1,5065920,'CLP',21,'Kevin Leiva Ene'),
        pg('P043','T3','C_532','P15','F24','2026-02-28',2,3166200,'CLP',21,'Kevin Leiva Feb'),
        pg('P044','T3','C_532','P15','F24','2026-03-31',3,6649000,'CLP',21,'Kevin Leiva Mar'),
        pg('P045','T3','C_532','P15','F24','2026-04-30',4,6649000,'CLP',21,'Kevin Leiva Abr'),
    ]
    db.executemany('INSERT OR REPLACE INTO pagos(id,team_id,codigo_id,proveedor_id,persona_id,categoria,fecha,anio,mes,monto_orig,moneda,tc,monto_usd,pct_codigo,descripcion,dias)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',pagos)
    print(f'  ✅ {len(pagos)} pagos reales 2026')

    tcs=[('TC1','2026-04-22','USD',1.0,'Base'),('TC2','2026-04-22','UF',37.50,'CMF Chile'),('TC3','2026-04-22','CLP',0.00105,'CMF Chile'),('TC4','2026-04-22','BRL',0.19,'Banco Central BR'),('TC5','2026-04-22','EUR',1.07,'BCE')]
    db.executemany('INSERT OR REPLACE INTO tipos_cambio(id,fecha,moneda,valor,fuente)VALUES(?,?,?,?,?)',tcs)
    cfgs=[('alert_email','1'),('sso_enabled','1'),('alert_sobre_pct','110'),('alert_sub_pct','65')]
    db.executemany('INSERT OR REPLACE INTO configuracion(clave,valor)VALUES(?,?)',cfgs)
    db.commit()
    total=db.execute('SELECT ROUND(SUM(monto_usd),0) FROM pagos').fetchone()[0] or 0
    print(f'\n📊 Total USD pagado: ${int(total):,}')
    print('✅ Seed completado.\n')
    db.close()

if __name__=='__main__': run()
