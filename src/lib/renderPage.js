'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Charge un gabarit HTML, y injecte des données structurées JSON-LD à
 * l'emplacement du marqueur <!--JSONLD--> et calcule le hash SHA-256 du
 * script injecté afin de l'autoriser précisément via la Content-Security-
 * Policy (au lieu d'un 'unsafe-inline' qui affaiblirait la protection XSS
 * de toute la page). Le rendu est mis en cache car le contenu est statique.
 */
/**
 * `vars` : simple remplacement de jetons {{CLE}} dans le gabarit. Utilisé
 * pour injecter les informations de l'entreprise (une seule source de
 * vérité : src/config/company.js) et SITE_URL dans le HTML statique, afin
 * que le site affiche toujours les mêmes coordonnées que les documents
 * générés, et que l'URL canonique suive le domaine configuré.
 */
function preparePage(templatePath, { jsonLd, vars = {} } = {}) {
  let template = fs.readFileSync(templatePath, 'utf8');
  for (const [key, value] of Object.entries(vars)) {
    template = template.split(`{{${key}}}`).join(value);
  }

  if (!jsonLd) {
    // Pas de données structurées pour cette page (ex : 404) -> on retire
    // simplement le marqueur, aucun hash CSP supplémentaire n'est requis.
    const html = template.replace('<!--JSONLD-->', '');
    return { html, cspHash: null };
  }

  const jsonText = JSON.stringify(jsonLd, null, 2);
  const scriptTag = `<script type="application/ld+json">\n${jsonText}\n    </script>`;
  const html = template.replace('<!--JSONLD-->', scriptTag);
  const hash = crypto.createHash('sha256').update(`\n${jsonText}\n    `, 'utf8').digest('base64');
  return { html, cspHash: `'sha256-${hash}'` };
}

function servePage(templatePath, opts, { status = 200 } = {}) {
  const { html, cspHash } = preparePage(templatePath, opts);
  const scriptSrc = cspHash ? `'self' ${cspHash}` : "'self'";
  return (req, res) => {
    res.status(status);
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
    res.type('html').send(html);
  };
}

module.exports = { preparePage, servePage };
