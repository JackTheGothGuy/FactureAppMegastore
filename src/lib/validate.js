'use strict';

const { ALLOWED_TYPES } = require('../config/docTypes');

const MAX_CLIENT_LEN = 200;
const MAX_DESIGNATION_LEN = 3000;
const MAX_ITEMS = 30;
const MAX_DOC_NUMBER_LEN = 30;

function validateItem(raw, index) {
  const errors = [];
  const designation = String((raw && raw.designation) || '').trim();
  if (!designation) {
    errors.push(`Poste ${index + 1} : la désignation est requise.`);
  } else if (designation.length > MAX_DESIGNATION_LEN) {
    errors.push(`Poste ${index + 1} : la désignation ne doit pas dépasser ${MAX_DESIGNATION_LEN} caractères.`);
  }

  let quantity = 0;
  if (raw && raw.quantity !== undefined && raw.quantity !== null && raw.quantity !== '') {
    quantity = Number(raw.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      errors.push(`Poste ${index + 1} : la quantité doit être un nombre positif.`);
      quantity = 0;
    }
  }

  const puHt = Number(raw && raw.puHt);
  if (!Number.isFinite(puHt) || puHt < 0) {
    errors.push(`Poste ${index + 1} : le PU HT doit être un nombre positif.`);
  }

  const ptHt = Number(raw && raw.ptHt);
  if (!Number.isFinite(ptHt) || ptHt < 0) {
    errors.push(`Poste ${index + 1} : le PT HT doit être un nombre positif.`);
  }

  return { errors, data: { quantity, designation, puHt: puHt || 0, ptHt: ptHt || 0 } };
}

/**
 * Valide et normalise les données envoyées par le formulaire, y compris
 * la liste (1 à MAX_ITEMS) des postes de la facture/devis/bon de commande.
 * Retourne { valid, errors, data }.
 */
function validateInput(body) {
  const errors = [];
  const src = body || {};

  const docType = String(src.docType || '').trim();
  if (!ALLOWED_TYPES.includes(docType)) {
    errors.push('Type de document invalide.');
  }

  const client = String(src.client || '').trim();
  if (!client) {
    errors.push('Le nom du client est requis.');
  } else if (client.length > MAX_CLIENT_LEN) {
    errors.push(`Le nom du client ne doit pas dépasser ${MAX_CLIENT_LEN} caractères.`);
  }

  const rawItems = Array.isArray(src.items) ? src.items : [];
  let items = [];
  if (rawItems.length === 0) {
    errors.push('Ajoutez au moins un poste (désignation, PU HT, PT HT).');
  } else if (rawItems.length > MAX_ITEMS) {
    errors.push(`Un document ne peut pas comporter plus de ${MAX_ITEMS} postes.`);
  } else {
    items = rawItems.map((raw, index) => {
      const { errors: itemErrors, data } = validateItem(raw, index);
      errors.push(...itemErrors);
      return data;
    });
  }

  const docNumber = String(src.docNumber || '').replace(/[\r\n\t]+/g, ' ').trim();
  if (docNumber.length > MAX_DOC_NUMBER_LEN) {
    errors.push(`Le numéro du document ne doit pas dépasser ${MAX_DOC_NUMBER_LEN} caractères.`);
  }

  // Date au format AAAA-MM-JJ (champ <input type="date">) ; vide = aujourd'hui.
  const date = String(src.date || '').trim();
  if (date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const y = m ? Number(m[1]) : 0;
    const d = m ? new Date(y, Number(m[2]) - 1, Number(m[3])) : null;
    const ok = d && d.getFullYear() === y && d.getMonth() === Number(m[2]) - 1
      && d.getDate() === Number(m[3]) && y >= 2000 && y <= 2100;
    if (!ok) errors.push('La date du document est invalide.');
  }

  const format = String(src.format || 'docx').trim().toLowerCase();
  if (!['docx', 'pdf'].includes(format)) {
    errors.push('Format de sortie invalide (docx ou pdf attendu).');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { docType, client, items, docNumber, date, format },
  };
}

module.exports = { validateInput, MAX_ITEMS };
