
#PRUEBAAAAAAAA
# FinTrack v3 — Gestión Financiera Interna

## Arquitectura
```
fintrack-app/
├── server.js          ← Backend Express (API REST)
├── src/routes.js      ← Todos los endpoints /api/*
├── db/
│   ├── database.js    ← SQLite schema + seed con datos reales
│   └── fintrack.db    ← Base de datos (se crea automáticamente)
├── public/
│   └── index.html     ← Frontend (HTML/CSS/JS vanilla, ~50KB)
└── package.json
```

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor
npm start

# 3. Abrir en el browser
# → http://localhost:3000
```

## Desarrollo (auto-restart al guardar)
```bash
npm run dev
```

## API REST
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /api/teams | Listar teams |
| POST | /api/teams | Crear team |
| PUT | /api/teams/:id | Editar team |
| DELETE | /api/teams/:id | Eliminar team |
| GET | /api/codigos | Listar PEP/Órdenes |
| POST | /api/codigos | Crear código |
| GET | /api/personas | Listar FTE (con filtros) |
| GET | /api/personas/:id | Detalle FTE + pagos |
| POST | /api/personas | Crear persona |
| PUT | /api/personas/:id | Editar persona |
| GET | /api/fte/headcount | KPIs FTE por quarter/año |
| GET | /api/pagos | Listar pagos (filtros: team, cod, mes, quarter) |
| POST | /api/pagos | Registrar pago |
| PUT | /api/pagos/:id | Editar pago |
| DELETE | /api/pagos/:id | Eliminar pago |
| GET | /api/presupuestos | Listar presupuestos |
| POST | /api/presupuestos/bulk | Cargar 12 meses de una vez |
| GET | /api/dashboard | KPIs + tendencia + by-team |
| GET | /api/forecast | Forecast mensual |
| GET | /api/alertas | Alertas calculadas |
| GET | /api/export/pagos | Descargar CSV |

## Base de datos
SQLite en `db/fintrack.db`. Se crea automáticamente al iniciar.
Los datos de prueba (teams, personas, pagos 2026) se insertan solo una vez.

## Tecnologías
- **Backend**: Node.js + Express + better-sqlite3
- **Frontend**: HTML/CSS/JS vanilla (sin frameworks, ~50KB)
- **DB**: SQLite (un solo archivo, cero configuración)
