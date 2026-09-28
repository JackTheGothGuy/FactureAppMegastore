'use strict';

const company = require('../config/company');

function buildRobotsTxt(siteUrl) {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

function buildSitemapXml(siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${siteUrl}/`, priority: '1.0' },
    { loc: `${siteUrl}/a-propos`, priority: '0.6' },
  ];
  const items = urls
    .map(
      (u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

function buildLlmsTxt(siteUrl) {
  return [
    `# ${company.name}`,
    '',
    `> Générateur de factures, devis et bons de commande pour ${company.name} ` +
      `(${company.taglineLines.join(', ')}). Calcule automatiquement la TVA (19%), ` +
      'le timbre fiscal et le montant total en toutes lettres ; exporte le document ' +
      'au format Word (.docx) ou PDF, dans une mise en page fixe.',
    '',
    '## Pages',
    '',
    `- [Accueil](${siteUrl}/) : formulaire de génération et aperçu en direct du document.`,
    `- [À propos](${siteUrl}/a-propos) : fonctionnement détaillé de l'outil (calculs, formats d'export).`,
    '',
    '## API',
    '',
    `- \`POST ${siteUrl}/api/documents\` : génère un document (JSON en entrée, fichier DOCX ou PDF en réponse). ` +
      'Réservé au formulaire du site ; non documenté publiquement.',
    '',
  ].join('\n');
}

module.exports = { buildRobotsTxt, buildSitemapXml, buildLlmsTxt };
