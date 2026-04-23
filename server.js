// server.js — FinTrack Backend
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const routes  = require('./src/routes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', routes);

// Todas las rutas no-API sirven el frontend
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 FinTrack corriendo en http://localhost:${PORT}`);
  console.log('   API disponible en http://localhost:' + PORT + '/api');
  console.log('   Presiona Ctrl+C para detener\n');
});
