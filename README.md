# Générateur de factures, devis et bons de commande — Méga store

Application Node.js (Express) qui génère des factures, devis et bons de
commande au format **Word (.docx)** ou **PDF**, dans une mise en page fixe
et identique aux 3 types de documents. Calcule automatiquement la TVA
(19 %), le timbre fiscal (1,000 DT) et le montant total en toutes lettres.

Aucun framework front-end (pas de React/Vite) : le site est du HTML/CSS/JS
simple servi directement par Express, ce qui garde le projet léger et
rapide.

## Démarrage rapide

```bash
npm install
cp .env.example .env      # puis modifiez SITE_URL avec votre domaine
npm start
```

Le site est alors disponible sur `http://localhost:3000`.

Pour le développement (redémarrage automatique) :

```bash
npm run dev
```

## Structure du projet

```
server.js                     Point d'entrée Express (sécurité, routes, statique)
src/
  config/
    company.js                 Coordonnées de l'entreprise (en-tête des documents)
    docTypes.js                 Libellés facture / devis / bon de commande
  lib/
    calculations.js             TVA 19 %, timbre, total TTC
    numberToWordsFr.js           Montant en toutes lettres (français)
    docNumber.js                  Numérotation automatique (persistée dans data/)
    validate.js                   Validation des données du formulaire
    renderPage.js                  Rendu des pages HTML + injection du JSON-LD
    seoFiles.js                     robots.txt / sitemap.xml / llms.txt
  models/
    buildDocumentModel.js         Assemble les données d'un document
  generators/
    docxGenerator.js               Génère le fichier .docx (librairie "docx")
    pdfGenerator.js                 Génère le fichier .pdf (librairie "pdfkit")
  routes/
    documents.js                    POST /api/documents
public/                         Site statique (HTML/CSS/JS, favicon, SEO)
assets/fonts/                  Polices Carlito/Caladea (TTF, sources)
data/                          Compteur de numérotation (créé automatiquement)
```

## Personnaliser les informations de l'entreprise

Toutes les coordonnées affichées en en-tête des documents **et** sur le
site proviennent d'un seul fichier :

```
src/config/company.js
```

Modifiez `name`, `taglineLines`, `phoneDisplay`, `taxId`, `address`, etc.
Le site (page d'accueil, page À propos, schéma LocalBusiness) et les
documents générés se mettent à jour automatiquement — une seule source de
vérité.

## Personnaliser la mise en page des documents

- `src/generators/docxGenerator.js` — génération Word. Polices, tailles,
  couleurs et largeurs de colonnes sont définies en haut du fichier
  (`HEADER_FONT`, `BODY_FONT`, `COL_WIDTHS`...).
- `src/generators/pdfGenerator.js` — génération PDF, avec la même logique
  de mise en page, indépendamment codée avec `pdfkit` (pas de dépendance à
  un navigateur headless).

Les deux générateurs consomment le même modèle de données
(`src/models/buildDocumentModel.js`), ce qui garantit que les deux formats
restent cohérents entre eux.

### Pourquoi Carlito/Caladea et pas Calibri/Cambria ?

Calibri et Cambria sont des polices propriétaires Microsoft, non
redistribuables. **Carlito** et **Caladea** sont des polices libres
(licence SIL Open Font License) *métriquement compatibles* — ce sont
d'ailleurs les polices que LibreOffice utilise lui-même pour substituer
Calibri/Cambria quand elles sont absentes du système. Le fichier Word
généré référence bien "Calibri"/"Cambria" par leur nom (Word affichera les
vraies polices s'il les a), et le PDF embarque directement Carlito/Caladea
pour un rendu identique partout.

## Numéro et date modifiables, bouton « Tout effacer »

Le formulaire pré-remplit le **numéro** (prochain numéro du compteur, ex.
`09/26`) et la **date** (aujourd'hui), tous deux modifiables. Si vous saisissez
un numéro au format `N/AA` de l'année en cours, le compteur avance jusqu'à N :
le numéro proposé ensuite continue à partir de votre saisie. Le numéro reste
affiché après un téléchargement (pour obtenir le même document en Word *et*
en PDF) ; **« Tout effacer »** vide le formulaire et propose le numéro suivant.

## Numérotation des documents

Chaque type de document (facture / devis / bon de commande) a son propre
compteur, remis à zéro chaque année civile, stocké dans
`data/counters.json` (créé automatiquement au premier document généré).

⚠️ En production sur une plateforme au système de fichiers éphémère
(Heroku, certains PaaS...), montez `data/` sur un volume persistant, sinon
la numérotation repartira de zéro à chaque redéploiement.

## Déployer avec un nom de domaine personnalisé

1. Déployez l'application sur un serveur/VPS ou une plateforme Node.js
   (Render, Railway, un VPS avec PM2 + Nginx, etc.).
2. Dans les variables d'environnement de production, définissez :
   ```
   SITE_URL=https://www.votre-domaine.tn
   PORT=3000
   ```
   `SITE_URL` pilote automatiquement les balises canoniques, Open Graph,
   `sitemap.xml`, `robots.txt`, `llms.txt` et les données structurées — un
   seul réglage à changer.
3. Chez votre registrar/DNS, pointez le domaine vers votre serveur :
   - Enregistrement **A** vers l'IP du serveur (ou **CNAME** si votre
     hébergeur fournit un nom d'hôte, ex. Render/Railway).
4. Mettez un reverse proxy (Nginx, Caddy, ou le proxy intégré de votre
   PaaS) devant l'application Node pour gérer HTTPS (Let's Encrypt/Caddy
   s'en chargent automatiquement) et rediriger le port 80/443 vers le
   `PORT` de l'application.
5. Vérifiez `https://votre-domaine.tn/sitemap.xml` et
   `https://votre-domaine.tn/robots.txt` une fois en ligne, puis soumettez
   le sitemap dans Google Search Console.

Exemple minimal avec PM2 + Nginx sur un VPS :

```bash
npm install --omit=dev
pm2 start server.js --name factures
```

```nginx
server {
  listen 80;
  server_name www.votre-domaine.tn;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

(Ajoutez ensuite `certbot --nginx` pour le HTTPS.)

## Qualité / SEO déjà en place

- Titres et meta descriptions uniques par page, balises canoniques,
  Open Graph + Twitter Card, image de partage social (`og-image.png`).
- `robots.txt`, `sitemap.xml`, `llms.txt` générés dynamiquement à partir
  de `SITE_URL`.
- Favicon SVG + PNG multi-tailles + `site.webmanifest`.
- Données structurées JSON-LD (`LocalBusiness`, `WebSite`,
  `BreadcrumbList`) injectées côté serveur.
- Fil d'Ariane et liens internes entre les pages.
- Page 404 personnalisée (pas la page par défaut d'Express).
- En-têtes de sécurité (Helmet) + Content-Security-Policy stricte
  (scripts autorisés par hash SHA-256, pas de `unsafe-inline`).
- Aucun framework front, aucun bundler : pas de source maps de production,
  pas de JavaScript superflu, le titre de l'onglet et le code source sont
  ceux du site — jamais "Vite" ou "React".
- Polices auto-hébergées en `.woff2` (pas de dépendance à une CDN tierce).

### À personnaliser avant mise en ligne

- `src/config/company.js` : adresse complète et coordonnées GPS
  (`address`, `geo`) pour un schéma LocalBusiness complet — utile pour
  Google Maps / le référencement local.
- `public/og-image.png` : régénérez-la si vous changez le nom ou les
  couleurs de l'entreprise (script de génération non inclus dans le
  paquet npm — recréez une image 1200×630 avec votre outil préféré).

## Plusieurs postes par document

Un document peut comporter plusieurs postes (jusqu'à 30) : bouton
« + Ajouter un poste » dans le formulaire, chacun avec sa propre quantité,
désignation, PU HT et PT HT. Le total HT du document est la somme des PT
HT de tous les postes ; la TVA (19 %) et le timbre fiscal (1,000 DT, un
seul par document) sont calculés sur ce total. Chaque poste devient une
ligne du tableau, avec des marges généreuses pour retrouver l'aspect
spacieux du modèle d'origine ; les lignes récapitulatives (TOT HT / TVA /
TIMBRE / TOT TTC) suivent en bas du tableau.

## Limites connues

- La numérotation des documents utilise un simple fichier JSON (pas de
  verrou inter-process) : adapté à un usage mono-serveur/petite
  entreprise, pas à une charge concurrente élevée.
