// server.js — FinTrack Backend
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { createSchema, getDB } = require('./db/schema');

// Inicializar DB
const db = getDB();
createSchema(db);
db.close();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Sirve el frontend estático
app.use(express.static(path.join(__dirname, '../frontend')));

// API
app.use('/api', require('./routes/api'));

// Todas las rutas no-API → index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 FinTrack corriendo en → http://localhost:${PORT}`);
  console.log(`   API disponible en      → http://localhost:${PORT}/api`);
  console.log(`   Para cargar datos:       node backend/scripts/seed.js`);
  console.log(`   Para reset completo:     node backend/scripts/seed.js --reset\n`);
});
