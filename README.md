# 🥋 Sanda Pro — IWUF 2024

Gestionnaire de compétition Wushu Sanda conforme au règlement IWUF 2024.

## Fonctionnalités

- 👥 Inscription et gestion des compétiteurs
- ⚖️ Pesée officielle avec validation IWUF
- 🏆 Génération automatique des brackets
- 🔴 Score en direct avec chronomètre
- 📊 Classements par catégorie
- 📋 Formulaires officiels IWUF (impression)

---

## Déploiement sur Render

### Méthode 1 — Via GitHub (recommandée)

1. **Crée un repo GitHub** et pousse ce projet :
   ```bash
   git init
   git add .
   git commit -m "Initial commit — Sanda Pro"
   git remote add origin https://github.com/TON_USER/sanda-pro.git
   git push -u origin main
   ```

2. **Sur [render.com](https://render.com)** :
   - Clique **New → Static Site**
   - Connecte ton repo GitHub
   - Render détecte automatiquement le `render.yaml`
   - Clique **Deploy**

3. Ton app sera disponible sur `https://sanda-pro.onrender.com` 🎉

### Méthode 2 — Build manuel

```bash
npm install
npm run build
# Le dossier build/ contient le site statique
# Upload-le sur n'importe quel hébergeur (Netlify, Vercel, Render...)
```

---

## Développement local

```bash
npm install
npm start
# Ouvre http://localhost:3000
```

---

## Structure du projet

```
sanda-pro/
├── public/
│   └── index.html
├── src/
│   ├── index.js       # Point d'entrée React
│   └── App.jsx        # Application complète
├── render.yaml        # Config déploiement Render
├── package.json
└── README.md
```
