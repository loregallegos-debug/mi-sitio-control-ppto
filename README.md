# FinTrack v3 — Gestión Financiera Interna

## Arquitectura

```
fintrack/
├── backend/
│   ├── server.js          ← Express API REST
│   ├── package.json
│   ├── db/
│   │   └── schema.js      ← SQLite schema
│   ├── routes/
│   │   └── api.js         ← Todos los endpoints /api/*
│   └── scripts/
│       └── seed.js        ← Script de carga de datos iniciales
└── frontend/
    └── index.html         ← App completa (HTML/CSS/JS vanilla)
```

## Instalación y primer uso

```bash
# 1. Instalar dependencias
cd backend
npm install

# 2. Cargar datos iniciales
node scripts/seed.js

# 3. Iniciar servidor
npm start
# → http://localhost:3000
```

## Comandos útiles

```bash
# Desarrollo (auto-restart)
npm run dev

# Recargar datos sin borrar nada
node scripts/seed.js

# Reset completo (borra todo y recarga)
node scripts/seed.js --reset
```

## API REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /api/teams | Listar equipos |
| POST | /api/teams | Crear equipo |
| PUT | /api/teams/:id | Editar equipo |
| DELETE | /api/teams/:id | Eliminar equipo |
| GET | /api/codigos | Listar PEP/Órdenes |
| POST | /api/codigos | Crear código |
| PUT | /api/codigos/:id | Editar código |
| GET | /api/personas | Listar FTE |
| GET | /api/personas/:id | Detalle FTE + pagos |
| POST | /api/personas | Crear persona |
| PUT | /api/personas/:id | Editar persona |
| GET | /api/fte/headcount | KPIs headcount por año/quarter |
| GET | /api/pagos | Listar pagos (filtros: team, cod, mes, quarter) |
| POST | /api/pagos | Registrar pago |
| PUT | /api/pagos/:id | Editar pago |
| DELETE | /api/pagos/:id | Eliminar pago |
| GET | /api/presupuestos | Listar presupuestos |
| POST | /api/presupuestos/bulk | Cargar 12 meses a la vez |
| PUT | /api/presupuestos/:tid/:cid/:anio/:mes | Editar celda |
| GET | /api/dashboard | KPIs + tendencia + by-team |
| GET | /api/forecast | Forecast mensual |
| PUT | /api/forecast/:tid/:cid/:anio/:mes | Guardar forecast |
| GET | /api/alertas | Alertas calculadas |
| GET | /api/tc | Tipos de cambio |
| POST | /api/tc | Actualizar tipo de cambio |
| GET | /api/export/pagos | Descargar CSV |

## Base de datos

SQLite en `backend/db/fintrack.db`
- Se crea automáticamente al iniciar
- Los datos persisten entre reinicios del servidor
- Para backup: copiar `fintrack.db`

## Datos incluidos (seed)

- **3 Teams**: Dispatch Management, FlightOps Engineering, DispatchCore Systems
- **17 Códigos**: 6 PEP CAPEX + 2 Órdenes OPEX + 9 códigos externos referenciados
- **6 Proveedores**: Indra, NTTData, Acid Labs, Everis Brasil, Tryolabs, Stefanini Chile
- **18 Personas**: 3 PM internos + 15 FTE externos
- **43 Pagos 2026**: Ene–Abr en CLP, UF, BRL y USD
- **Presupuestos 2025 + 2026**: completos mes a mes

## Monedas soportadas

| Moneda | TC a USD | Fuente |
|--------|----------|--------|
| USD | 1.0000 | Base |
| UF | 37.50 | CMF Chile |
| CLP | 0.00105 | CMF Chile |
| BRL | 0.1900 | Banco Central BR |
| EUR | 1.0700 | BCE |
