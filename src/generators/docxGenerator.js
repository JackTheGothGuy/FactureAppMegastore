'use strict';

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, VerticalAlign, BorderStyle, UnderlineType, HeightRule,
} = require('docx');
const { formatMontant } = require('../lib/calculations');

// Polices : Cambria pour l'en-tête société (theme "majorBidi" dans le
// modèle d'origine), Calibri pour tout le reste. Sur les postes sans ces
// polices Microsoft, Word/LibreOffice substituent automatiquement par
// Caladea/Carlito (police libre incluse dans ce projet pour le PDF).
const HEADER_FONT = 'Cambria';
const BODY_FONT = 'Calibri';
const BLACK = '000000';

const LINE = { style: BorderStyle.SINGLE, size: 4, color: BLACK };
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

// Largeurs de colonnes en dxa (twips), identiques au modèle d'origine :
// Qte | désignation | PU HT | PT HT
const COL_WIDTHS = [805, 5007, 1661, 1501];
const TABLE_WIDTH = COL_WIDTHS.reduce((a, b) => a + b, 0);

// Chaque poste et chaque ligne récapitulative est une vraie TableRow
// (ce qui permet un centrage vertical automatique et fiable, quelle que
// soit la longueur du texte) mais SANS bordure horizontale entre elles :
// visuellement, tous les postes + le récapitulatif forment UN seul bloc
// continu, exactement comme dans le modèle d'origine — seule une ligne
// sépare ce bloc du total TTC. L'espacement entre postes vient des marges
// verticales des cellules (pas d'une ligne), pour un rendu "spacieux".
const ITEM_CELL_MARGINS = { top: 200, bottom: 200, left: 108, right: 108 };
const SUMMARY_CELL_MARGINS = { top: 90, bottom: 90, left: 108, right: 108 };
const HEADER_CELL_MARGINS = { top: 140, bottom: 140, left: 108, right: 108 };

const ITEM_MIN_HEIGHT = 500;
const SUMMARY_MIN_HEIGHT = 320;
const HEADER_MIN_HEIGHT = 380;

function run(text, opts = {}) {
  return new TextRun({
    text,
    bold: true,
    font: opts.font || BODY_FONT,
    size: opts.size || 28,
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
    color: BLACK,
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    alignment: opts.alignment,
    spacing: opts.spacing || { after: 0 },
    children: text ? [run(text, opts)] : [],
  });
}

// `lineAbove`/`lineBelow` contrôlent la bordure horizontale de la cellule ;
// les bordures verticales (left/right) restent toujours visibles pour que
// les séparateurs de colonnes soient continus sur toute la hauteur.
function cell(width, children, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: {
      top: opts.lineAbove ? LINE : NONE,
      bottom: opts.lineBelow ? LINE : NONE,
      left: LINE,
      right: LINE,
    },
    margins: opts.margins || ITEM_CELL_MARGINS,
    verticalAlign: opts.verticalAlign || VerticalAlign.CENTER,
    children,
  });
}

function row(cells, minHeight) {
  return new TableRow({
    height: { value: minHeight, rule: HeightRule.ATLEAST },
    children: cells,
  });
}

function headerCell(text, width, alignment) {
  return cell(width, [para(text, { size: 32, alignment })], {
    margins: HEADER_CELL_MARGINS,
    lineAbove: true,
    lineBelow: true,
  });
}

function buildItemRow(item) {
  const designationLines = item.designation.split(/\r?\n/);

  const qteCell = cell(COL_WIDTHS[0], [para(item.quantityLabel, { size: 32 })]);
  const designationCell = cell(
    COL_WIDTHS[1],
    designationLines.map((line) => para(line, { size: 32 })),
  );
  const puHtCell = cell(COL_WIDTHS[2], [para(formatMontant(item.puHt), { size: 28, alignment: AlignmentType.CENTER })]);
  const ptHtCell = cell(COL_WIDTHS[3], [para(formatMontant(item.ptHt), { size: 28 })]);

  return row([qteCell, designationCell, puHtCell, ptHtCell], ITEM_MIN_HEIGHT);
}

function buildSummaryRow(label, value, opts = {}) {
  const margins = SUMMARY_CELL_MARGINS;
  return row(
    [
      cell(COL_WIDTHS[0], [para('')], { margins, lineAbove: opts.lineAbove, lineBelow: opts.lineBelow }),
      cell(COL_WIDTHS[1], [para('')], { margins, lineAbove: opts.lineAbove, lineBelow: opts.lineBelow }),
      cell(COL_WIDTHS[2], [para(label, { size: 28, alignment: AlignmentType.CENTER })], { margins, lineAbove: opts.lineAbove, lineBelow: opts.lineBelow }),
      cell(COL_WIDTHS[3], [para(value, { size: 28 })], { margins, lineAbove: opts.lineAbove, lineBelow: opts.lineBelow }),
    ],
    opts.minHeight || SUMMARY_MIN_HEIGHT,
  );
}

function buildDocxDocument(model) {
  const headerRow = row(
    [
      headerCell('Qte', COL_WIDTHS[0], AlignmentType.LEFT),
      headerCell('désignation', COL_WIDTHS[1], AlignmentType.CENTER),
      headerCell('PU HT', COL_WIDTHS[2], AlignmentType.LEFT),
      headerCell('PT HT', COL_WIDTHS[3], AlignmentType.LEFT),
    ],
    HEADER_MIN_HEIGHT,
  );

  const itemRows = model.items.map(buildItemRow);

  const summaryRows = [
    buildSummaryRow('TOT HT', formatMontant(model.totHt)),
    buildSummaryRow('TVA 19%', formatMontant(model.tva)),
    buildSummaryRow('TIMBRE', formatMontant(model.timbre)),
    buildSummaryRow('TOT TTC', formatMontant(model.totTtc), { lineAbove: true, lineBelow: true, minHeight: SUMMARY_MIN_HEIGHT }),
  ];

  const table = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    rows: [headerRow, ...itemRows, ...summaryRows],
  });

  const companyLines = [
    model.company.name,
    ...model.company.taglineLines,
    model.company.phoneDisplay,
    model.company.taxId,
  ].map((text) => para(text, { font: HEADER_FONT, size: 28 }));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 },
          },
        },
        children: [
          ...companyLines,
          para(model.dateLabel, { font: HEADER_FONT, size: 28, alignment: AlignmentType.RIGHT }),
          para('', { spacing: { after: 0 } }),
          para('', { spacing: { after: 0 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [run(model.type.title(model.docNumber), { size: 40, underline: true })],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [run(`Client : ${model.client}`, { size: 28, underline: true })],
          }),
          table,
          new Paragraph({
            spacing: { before: 300, after: 0 },
            children: [run(model.type.closingLine, { size: 28, underline: true })],
          }),
          new Paragraph({
            spacing: { before: 150 },
            children: [run(model.montantEnLettres, { size: 28, underline: true })],
          }),
        ],
      },
    ],
  });

  return doc;
}

async function generateDocxBuffer(model) {
  const doc = buildDocxDocument(model);
  return Packer.toBuffer(doc);
}

module.exports = { generateDocxBuffer, buildDocxDocument };
