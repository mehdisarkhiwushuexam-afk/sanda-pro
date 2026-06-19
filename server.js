const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── STATIC FILES ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    // Cache agressif pour les assets statiques partagés
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// ── NAMED ROUTES ─────────────────────────────────────────────────────────────

// Hub
app.get(['/', '/hub'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Chef de table
app.get(['/chef', '/chef-de-table'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chef-de-table.html'));
});

// ── FIX CRITIQUE : routes juges avec query string transmise ──
// /juge/1 → juge-de-coin.html?j=1  (redirect propre, query string préservée)
app.get('/juge/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1 || id > 5) {
    return res.redirect('/');
  }
  // Redirect vers l'URL directe avec query string
  // Le fichier statique est déjà servi, on redirige avec le paramètre j
  res.redirect(`/juge-de-coin.html?j=${id}`);
});

// Aussi accepter /juge sans numéro → setup modal
app.get('/juge', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'juge-de-coin.html'));
});

// Tableau public
app.get(['/tableau', '/public', '/scoreboard'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tableau-public.html'));
});

// Médecin / Arbitre
app.get(['/medecin', '/arbitre', '/medical'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'arbitre-medecin.html'));
});

// Annonceur
app.get(['/annonceur', '/speaker'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'annonceur.html'));
});

// Recorder officiel
app.get(['/recorder', '/enregistreur'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recorder.html'));
});

// CRM Manager — FIX CRITIQUE : nom de fichier corrigé
app.get(['/manager', '/crm', '/sanda-manager'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sanda-manager.html'));
});

// ── 404 CUSTOM — renvoi vers le Hub ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ SANDA PRO — Démarré sur le port ${PORT}`);
  console.log(`\n📋 Interfaces disponibles :`);
  console.log(`   Hub         → http://localhost:${PORT}/`);
  console.log(`   Chef table  → http://localhost:${PORT}/chef`);
  console.log(`   Juge #1     → http://localhost:${PORT}/juge/1`);
  console.log(`   Juge #2     → http://localhost:${PORT}/juge/2`);
  console.log(`   Juge #3     → http://localhost:${PORT}/juge/3`);
  console.log(`   Juge #4     → http://localhost:${PORT}/juge/4`);
  console.log(`   Juge #5     → http://localhost:${PORT}/juge/5`);
  console.log(`   Tableau     → http://localhost:${PORT}/tableau`);
  console.log(`   Médecin     → http://localhost:${PORT}/medecin`);
  console.log(`   Annonceur   → http://localhost:${PORT}/annonceur`);
  console.log(`   Recorder    → http://localhost:${PORT}/recorder`);
  console.log(`   Manager CRM → http://localhost:${PORT}/manager\n`);
});
