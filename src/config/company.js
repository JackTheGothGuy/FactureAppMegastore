'use strict';

/**
 * Informations de l'entreprise (en-tête des documents).
 * Modifiez ces valeurs pour personnaliser vos factures/devis/bons de commande.
 * Ces informations sont utilisées à la fois dans les documents générés (DOCX/PDF)
 * et dans les données structurées (schema.org LocalBusiness) du site.
 */
module.exports = {
  name: 'Méga store',
  taglineLines: ['Abris de voiture', 'Fer forgé', 'Miniseries aluminum'],
  phoneDisplay: 'Tel: 98.270.019',
  phoneE164: '+21698270019',
  taxId: 'M.F:1203141/X /A/ M/ 000',
  city: 'Tunis',
  country: 'TN',
  // Renseignez une adresse complète et des coordonnées GPS réelles pour un
  // référencement local optimal (Google Maps, schema.org LocalBusiness).
  address: {
    streetAddress: '',
    addressLocality: 'Tunis',
    postalCode: '',
    addressCountry: 'TN',
  },
  geo: {
    latitude: null,
    longitude: null,
  },
  email: '',
};
