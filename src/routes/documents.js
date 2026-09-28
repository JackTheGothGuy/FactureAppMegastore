'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { validateInput } = require('../lib/validate');
const { ALLOWED_TYPES } = require('../config/docTypes');
const { peekDocNumber } = require('../lib/docNumber');
const { buildDocumentModel } = require('../models/buildDocumentModel');
const { generateDocxBuffer } = require('../generators/docxGenerator');
const { generatePdfBuffer } = require('../generators/pdfGenerator');

const router = express.Router();

// Limite raisonnable : ce générateur n'est pas destiné à un usage public
// massif. Ajustez selon votre volumétrie réelle.
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de documents générés en peu de temps. Réessayez dans une minute.' },
});

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// Numéro proposé pour le prochain document (n'incrémente pas le compteur).
router.get('/next-number', (req, res) => {
  const docType = String(req.query.docType || '');
  if (!ALLOWED_TYPES.includes(docType)) {
    return res.status(400).json({ error: 'Type de document invalide.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ docNumber: peekDocNumber(docType) });
});

router.post('/documents', generateLimiter, async (req, res) => {
  const { valid, errors, data } = validateInput(req.body);
  if (!valid) {
    return res.status(400).json({ error: 'Champs invalides.', details: errors });
  }

  try {
    const model = buildDocumentModel(data);
    const numberSlug = slugify(model.docNumber) || 'sans-numero';
    const filenameBase = `${model.type.key}-${numberSlug}-${slugify(model.client) || 'client'}`;

    if (data.format === 'pdf') {
      const buffer = await generatePdfBuffer(model);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
      return res.send(buffer);
    }

    const buffer = await generateDocxBuffer(model);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.docx"`);
    return res.send(buffer);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Erreur de génération de document :', err);
    return res.status(500).json({ error: "Une erreur est survenue lors de la génération du document." });
  }
});

module.exports = router;
