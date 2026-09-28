'use strict';

const path = require('path');
const PDFDocument = require('pdfkit');
const { formatMontant } = require('../lib/calculations');

// Carlito/Caladea = polices libres (SIL OFL) métriquement compatibles avec
// Calibri/Cambria — ce sont d'ailleurs celles que LibreOffice utilise pour
// substituer Calibri/Cambria quand elles sont absentes, ce qui garde ce
// rendu PDF cohérent avec le DOCX généré par ce même projet.
const FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const FONT_HEADER = path.join(FONTS_DIR, 'Caladea-Bold.ttf'); // ~ Cambria Bold
const FONT_BODY = path.join(FONTS_DIR, 'Carlito-Bold.ttf'); // ~ Calibri Bold

// dxa (twips) -> points PDF : 1440 dxa = 1 pouce = 72 pt
const DXA_TO_PT = 72 / 1440;
const toPt = (dxa) => dxa * DXA_TO_PT;

const PAGE_WIDTH = toPt(11906); // A4
const PAGE_HEIGHT = toPt(16838);
const MARGIN = toPt(1417);

const COL_WIDTHS = [805, 5007, 1661, 1501].map(toPt);
const TABLE_INDENT = toPt(98);
const CELL_PAD_X = toPt(108);

// Tous les postes + le récapitulatif (TOT HT/TVA/TIMBRE) forment UN seul
// bloc continu, sans ligne horizontale entre eux (l'espacement vient des
// marges, pas d'un trait) — seule une ligne sépare ce bloc du TOT TTC,
// exactement comme dans le modèle d'origine.
const ITEM_PAD_Y = toPt(200);
const SUMMARY_PAD_Y = toPt(90);
const HEADER_PAD_Y = toPt(140);
const ITEM_MIN_HEIGHT = toPt(500);
const SUMMARY_MIN_HEIGHT = toPt(320);
const HEADER_MIN_HEIGHT = toPt(380);

const BLACK = '#000000';

function colX(tableX, index) {
  let x = tableX;
  for (let i = 0; i < index; i += 1) x += COL_WIDTHS[i];
  return x;
}

// `rows`: [{ height, lineBelow }] — une ligne horizontale n'est tracée
// qu'après les lignes marquées lineBelow=true ; les lignes verticales
// (séparateurs de colonnes) restent, elles, toujours continues.
function drawTableStructure(doc, x, y, colWidths, rows) {
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const totalHeight = rows.reduce((sum, r) => sum + r.height, 0);

  doc.lineWidth(0.75).strokeColor(BLACK);

  doc.moveTo(x, y).lineTo(x + tableWidth, y).stroke(); // bordure haute
  let cy = y;
  rows.forEach((r) => {
    cy += r.height;
    if (r.lineBelow) doc.moveTo(x, cy).lineTo(x + tableWidth, cy).stroke();
  });

  let cx = x;
  doc.moveTo(cx, y).lineTo(cx, y + totalHeight).stroke();
  colWidths.forEach((w) => {
    cx += w;
    doc.moveTo(cx, y).lineTo(cx, y + totalHeight).stroke();
  });
}

function text(doc, str, x, y, width, opts = {}) {
  doc.font(opts.font || FONT_BODY).fontSize(opts.size || 14);
  doc.text(str, x, y, { width, align: opts.align || 'left', lineGap: opts.lineGap || 0 });
}

function centerY(rowTop, rowHeight, contentHeight) {
  return rowTop + Math.max(0, (rowHeight - contentHeight) / 2);
}

function buildPdfDocument(model) {
  const doc = new PDFDocument({
    size: [PAGE_WIDTH, PAGE_HEIGHT],
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: model.type.title(model.docNumber),
      Author: model.company.name,
      Subject: model.type.label,
    },
  });

  doc.registerFont('Header', FONT_HEADER);
  doc.registerFont('Body', FONT_BODY);

  const contentWidth = PAGE_WIDTH - 2 * MARGIN;

  // --- En-tête société ---
  doc.font('Header').fontSize(14).fillColor(BLACK);
  const companyLines = [
    model.company.name,
    ...model.company.taglineLines,
    model.company.phoneDisplay,
    model.company.taxId,
  ];
  companyLines.forEach((line) => doc.text(line, MARGIN, doc.y === MARGIN ? MARGIN : doc.y, { lineGap: 0 }));

  // --- Date (alignée à droite) ---
  doc.moveDown(0.3);
  doc.font('Header').fontSize(14).text(model.dateLabel, MARGIN, doc.y, { width: contentWidth, align: 'right' });

  // --- Titre ---
  doc.moveDown(1.5);
  doc.font('Body').fontSize(20).text(model.type.title(model.docNumber), MARGIN, doc.y, {
    width: contentWidth, align: 'center', underline: true,
  });

  // --- Client ---
  doc.moveDown(1.2);
  doc.font('Body').fontSize(14).text(`Client : ${model.client}`, MARGIN, doc.y, { underline: true });

  // --- Tableau ---
  doc.moveDown(0.8);
  const tableX = MARGIN + TABLE_INDENT;
  const tableY = doc.y;
  const designationWidth = COL_WIDTHS[1] - 2 * CELL_PAD_X;

  const headerRowHeight = Math.max(HEADER_MIN_HEIGHT, 16 * 1.3 + 2 * HEADER_PAD_Y);

  doc.font('Body').fontSize(16);
  const itemRowHeights = model.items.map((item) => {
    const h = doc.heightOfString(item.designation, { width: designationWidth, lineGap: 2 });
    return Math.max(ITEM_MIN_HEIGHT, h + 2 * ITEM_PAD_Y);
  });

  const summaryRowHeight = SUMMARY_MIN_HEIGHT;
  const summaryLines = [
    ['TOT HT', formatMontant(model.totHt)],
    ['TVA 19%', formatMontant(model.tva)],
    ['TIMBRE', formatMontant(model.timbre)],
    ['TOT TTC', formatMontant(model.totTtc)],
  ];

  // Structure des lignes pour le tracé des bordures : pas de ligne entre
  // les postes, ni entre les postes et le récapitulatif, ni au sein du
  // récapitulatif — seulement sous l'en-tête et avant/après TOT TTC.
  const rows = [
    { height: headerRowHeight, lineBelow: true },
    ...itemRowHeights.map((h) => ({ height: h, lineBelow: false })),
    { height: summaryRowHeight, lineBelow: false }, // TOT HT
    { height: summaryRowHeight, lineBelow: false }, // TVA 19%
    { height: summaryRowHeight, lineBelow: true }, // TIMBRE -> ligne avant TOT TTC
    { height: summaryRowHeight, lineBelow: true }, // TOT TTC -> bordure de fermeture
  ];
  drawTableStructure(doc, tableX, tableY, COL_WIDTHS, rows);

  // -- En-têtes de colonnes --
  const headerTextY = centerY(tableY, headerRowHeight, 16 * 1.2);
  text(doc, 'Qte', colX(tableX, 0) + CELL_PAD_X, headerTextY, COL_WIDTHS[0] - 2 * CELL_PAD_X, { size: 16 });
  text(doc, 'désignation', colX(tableX, 1) + CELL_PAD_X, headerTextY, COL_WIDTHS[1] - 2 * CELL_PAD_X, { size: 16, align: 'center' });
  text(doc, 'PU HT', colX(tableX, 2) + CELL_PAD_X, headerTextY, COL_WIDTHS[2] - 2 * CELL_PAD_X, { size: 16 });
  text(doc, 'PT HT', colX(tableX, 3) + CELL_PAD_X, headerTextY, COL_WIDTHS[3] - 2 * CELL_PAD_X, { size: 16 });

  // -- Lignes des postes (chaque valeur centrée verticalement dans SA propre ligne) --
  let rowTop = tableY + headerRowHeight;
  model.items.forEach((item, i) => {
    const h = itemRowHeights[i];

    if (item.quantityLabel) {
      const qteY = centerY(rowTop, h, 16 * 1.2);
      text(doc, item.quantityLabel, colX(tableX, 0) + CELL_PAD_X, qteY, COL_WIDTHS[0] - 2 * CELL_PAD_X, { size: 16 });
    }

    doc.font('Body').fontSize(16).text(item.designation, colX(tableX, 1) + CELL_PAD_X, rowTop + ITEM_PAD_Y, {
      width: designationWidth, lineGap: 2,
    });

    const puY = centerY(rowTop, h, 14 * 1.2);
    text(doc, formatMontant(item.puHt), colX(tableX, 2) + CELL_PAD_X, puY, COL_WIDTHS[2] - 2 * CELL_PAD_X, { align: 'center' });
    text(doc, formatMontant(item.ptHt), colX(tableX, 3) + CELL_PAD_X, puY, COL_WIDTHS[3] - 2 * CELL_PAD_X);

    rowTop += h;
  });

  // -- Récapitulatif --
  summaryLines.forEach(([label, value]) => {
    const labelY = centerY(rowTop, summaryRowHeight, 14 * 1.2);
    text(doc, label, colX(tableX, 2) + CELL_PAD_X, labelY, COL_WIDTHS[2] - 2 * CELL_PAD_X, { align: 'center' });
    text(doc, value, colX(tableX, 3) + CELL_PAD_X, labelY, COL_WIDTHS[3] - 2 * CELL_PAD_X);
    rowTop += summaryRowHeight;
  });

  // --- Pied : mention légale + montant en lettres ---
  doc.x = MARGIN;
  doc.y = rowTop + toPt(300);
  doc.font('Body').fontSize(14).text(model.type.closingLine, MARGIN, doc.y, { underline: true });
  doc.moveDown(0.6);
  doc.font('Body').fontSize(14).text(model.montantEnLettres, MARGIN, doc.y, { underline: true });

  return doc;
}

async function generatePdfBuffer(model) {
  return new Promise((resolve, reject) => {
    try {
      const doc = buildPdfDocument(model);
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePdfBuffer, buildPdfDocument };
