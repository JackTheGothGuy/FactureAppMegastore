'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const documentsRouter = require('./src/routes/documents');
const { servePage } = require('./src/lib/renderPage');
const buildStructuredData = require('./src/lib/structuredData');
const { buildRobotsTxt, buildSitemapXml, buildLlmsTxt } = require('./src/lib/seoFiles');
const company = require('./src/config/company');

const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(compression());
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

// Sécurité HTTP de base. La Content-Security-Policy fine (avec le hash du
// JSON-LD) est appliquée page par page dans servePage() ; on la désactive
// donc ici pour éviter que Helmet n'écrive un second en-tête concurrent.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// --- Pages HTML avec données structurées injectées côté serveur ---
const PUBLIC_DIR = path.join(__dirname, 'public');
const { home, about } = buildStructuredData(SITE_URL);

const templateVars = {
  SITE_URL,
  COMPANY_NAME: company.name,
  COMPANY_TAGLINE: company.taglineLines.join(' · '),
  COMPANY_PHONE: company.phoneDisplay,
  COMPANY_TAXID: company.taxId,
  COMPANY_CITY: company.city,
};

app.get('/', servePage(path.join(PUBLIC_DIR, 'index.html'), { jsonLd: home, vars: templateVars }));
app.get('/a-propos', servePage(path.join(PUBLIC_DIR, 'a-propos.html'), { jsonLd: about, vars: templateVars }));

const render404 = servePage(path.join(PUBLIC_DIR, '404.html'), { vars: templateVars }, { status: 404 });

// --- Fichiers SEO générés dynamiquement à partir de SITE_URL ---
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(buildRobotsTxt(SITE_URL));
});
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(buildSitemapXml(SITE_URL));
});
app.get('/llms.txt', (req, res) => {
  res.type('text/plain').send(buildLlmsTxt(SITE_URL));
});
app.get('/a-propos.html', (req, res) => res.redirect(301, '/a-propos'));
app.get('/index.html', (req, res) => res.redirect(301, '/'));

// --- API ---
app.use('/api', documentsRouter);

// --- Fichiers statiques (CSS/JS/assets/robots/sitemap/favicon...) ---
app.use(
  express.static(PUBLIC_DIR, {
    index: false, // la route "/" ci-dessus gère déjà index.html
    extensions: false,
    setHeaders(res, filePath) {
      if (/\.(?:css|js)$/.test(filePath)) {
        // "no-cache" ne veut pas dire "jamais mis en cache" : le navigateur
        // garde le fichier mais revalide systématiquement auprès du serveur
        // (requête conditionnelle + ETag). Ça évite qu'un ancien app.js/
        // style.css reste servi depuis le cache après une mise à jour du
        // code — ce qui casse silencieusement le formulaire (JS obsolète
        // référençant des éléments qui n'existent plus).
        res.setHeader('Cache-Control', 'no-cache');
      } else if (/\.(?:svg|png|ico|webmanifest)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      } else if (/\.(?:txt|xml)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    },
  }),
);

// --- 404 personnalisée ---
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route introuvable.' });
  }
  return render404(req, res);
});

// --- Gestionnaire d'erreurs générique (ne jamais divulguer la stack) ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Erreur non gérée :', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
  return res.status(500).type('html').send('<h1>Erreur interne</h1><p><a href="/">Retour à l\'accueil</a></p>');
});

app.listen(PORT, () => {
  console.log(`Serveur démarré : http://localhost:${PORT} (SITE_URL=${SITE_URL})`);
});

module.exports = app;
