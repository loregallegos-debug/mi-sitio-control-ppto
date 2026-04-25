# FinTrack · MC Operaciones 2026

Sistema de gestión financiera para LATAM MC Operaciones.

## Stack
- **Backend:** Python 3 + Flask
- **Base de datos:** SQLite (incluida en el zip)
- **Frontend:** HTML/CSS/JS vanilla
- **Puerto:** 3000

## Instalación rápida

### 1. Requisitos
```
Python 3.8+
pip install flask flask-cors
```

### 2. Levantar el servidor
```bash
cd backend
python3 server.py
```

### 3. Abrir la app
Ir a: http://localhost:3000

## Reset de base de datos (datos demo 2026)
```bash
cd backend
python3 scripts/seed.py --reset
```

## Datos incluidos
- 3 Teams: Dispatch Management, FlightOps Engineering, DispatchCore Systems
- 16 códigos PEP/Órdenes
- 6 proveedores (Indra, NTTData, Acid Labs, Everis Brasil, Tryolabs, Stefanini)
- 18 FTE externos + 3 PM internos
- 43 pagos reales Ene–Abr 2026 → $910,667 USD
- 144 registros de presupuesto 2026
