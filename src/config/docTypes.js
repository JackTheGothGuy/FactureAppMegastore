'use strict';

/**
 * Les 3 types de documents supportés. La mise en page reste strictement
 * identique entre les 3 — seuls le libellé, le titre et la phrase de
 * clôture changent.
 */
const DOC_TYPES = {
  facture: {
    key: 'facture',
    label: 'Facture',
    title: (num) => `Facture N° ${num}`,
    closingLine: 'Arrêté la présente facture à la somme de :',
  },
  devis: {
    key: 'devis',
    label: 'Devis',
    title: (num) => `Devis N° ${num}`,
    closingLine: 'Arrêté le présent devis à la somme de :',
  },
  bon_de_commande: {
    key: 'bon_de_commande',
    label: 'Bon de commande',
    title: (num) => `Bon de commande N° ${num}`,
    closingLine: 'Arrêté le présent bon de commande à la somme de :',
  },
};

const ALLOWED_TYPES = Object.keys(DOC_TYPES);

module.exports = { DOC_TYPES, ALLOWED_TYPES };
