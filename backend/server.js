require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/animal-types', require('./routes/animalTypes'));
app.use('/api/posts',        require('./routes/posts').router);
app.use('/api/donations',    require('./routes/donations'));
app.use('/api/admin',        require('./routes/admin'));

// ── SPA fallback — serve index.html for any non-API route ────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🐾 Animal Adoption Platform running on http://localhost:${PORT}\n`);
});
