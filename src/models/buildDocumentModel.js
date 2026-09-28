'use strict';

const { DOC_TYPES } = require('../config/docTypes');
const company = require('../config/company');
const { computeTotals, round3 } = require('../lib/calculations');
const { amountToWordsFr } = require('../lib/numberToWordsFr');
const { nextDocNumber, syncCounter } = require('../lib/docNumber');

function formatDateFr(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// "AAAA-MM-JJ" (déjà validé) -> Date locale, sans décalage de fuseau horaire.
function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Construit le modèle de données complet d'un document (facture/devis/bon
 * de commande) à partir des champs validés du formulaire, y compris la
 * liste des postes. Ce modèle est ensuite consommé à l'identique par le
 * générateur DOCX et le générateur PDF, ce qui garantit une mise en page
 * rigoureusement identique entre les deux formats.
 */
function buildDocumentModel({ docType, client, items, docNumber: customNumber, date }) {
  const type = DOC_TYPES[docType];
  if (!type) throw new Error('Type de document invalide.');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Le document doit comporter au moins un poste.');
  }

  const totals = computeTotals(items);
  // Numéro et date : saisis par l'utilisateur s'ils sont fournis, sinon
  // numéro automatique et date du jour.
  let docNumber;
  if (customNumber) {
    docNumber = customNumber;
    syncCounter(docType, customNumber);
  } else {
    docNumber = nextDocNumber(docType);
  }
  const docDate = date ? parseIsoDate(date) : new Date();

  const modelItems = items.map((item) => ({
    quantityLabel: item.quantity > 0 ? String(item.quantity) : '',
    designation: item.designation,
    puHt: round3(item.puHt),
    ptHt: round3(item.ptHt),
  }));

  return {
    company,
    type,
    docNumber,
    dateLabel: `${company.city} le ${formatDateFr(docDate)}`,
    client,
    items: modelItems,
    totHt: totals.totHt,
    tva: totals.tva,
    timbre: totals.timbre,
    totTtc: totals.totTtc,
    montantEnLettres: `${amountToWordsFr(totals.totTtc)}.`,
  };
}

module.exports = { buildDocumentModel };
