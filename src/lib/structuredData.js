'use strict';

const company = require('../config/company');

/**
 * Construit les données structurées schema.org (JSON-LD) pour chaque page :
 * WebSite + LocalBusiness + BreadcrumbList + WebPage/WebApplication.
 * Un seul objet @graph par page regroupe toutes les entités liées.
 */
function buildStructuredData(siteUrl) {
  const localBusiness = {
    '@type': 'LocalBusiness',
    '@id': `${siteUrl}/#business`,
    name: company.name,
    description: `${company.taglineLines.join(', ')} — ${company.name}`,
    telephone: company.phoneE164 || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: company.address.streetAddress || undefined,
      addressLocality: company.address.addressLocality,
      postalCode: company.address.postalCode || undefined,
      addressCountry: company.address.addressCountry,
    },
    ...(company.geo.latitude && company.geo.longitude
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: company.geo.latitude,
            longitude: company.geo.longitude,
          },
        }
      : {}),
    url: siteUrl,
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: siteUrl,
    name: `${company.name} — Générateur de factures, devis et bons de commande`,
    inLanguage: 'fr-TN',
    publisher: { '@id': `${siteUrl}/#business` },
  };

  const home = {
    '@context': 'https://schema.org',
    '@graph': [
      website,
      localBusiness,
      {
        '@type': 'WebApplication',
        '@id': `${siteUrl}/#app`,
        name: 'Générateur de factures, devis et bons de commande',
        url: siteUrl,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'TND' },
        isPartOf: { '@id': `${siteUrl}/#website` },
        provider: { '@id': `${siteUrl}/#business` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${siteUrl}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${siteUrl}/` },
        ],
      },
      {
        '@type': 'WebPage',
        '@id': `${siteUrl}/#webpage`,
        url: `${siteUrl}/`,
        name: 'Générateur de factures, devis et bons de commande — Méga store',
        isPartOf: { '@id': `${siteUrl}/#website` },
        about: { '@id': `${siteUrl}/#business` },
        breadcrumb: { '@id': `${siteUrl}/#breadcrumb` },
        inLanguage: 'fr-TN',
      },
    ],
  };

  const about = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@id': `${siteUrl}/#website` },
      {
        '@type': 'BreadcrumbList',
        '@id': `${siteUrl}/a-propos#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'À propos', item: `${siteUrl}/a-propos` },
        ],
      },
      {
        '@type': 'AboutPage',
        '@id': `${siteUrl}/a-propos#webpage`,
        url: `${siteUrl}/a-propos`,
        name: 'À propos du générateur — Méga store',
        isPartOf: { '@id': `${siteUrl}/#website` },
        about: { '@id': `${siteUrl}/#business` },
        breadcrumb: { '@id': `${siteUrl}/a-propos#breadcrumb` },
        inLanguage: 'fr-TN',
      },
    ],
  };

  return { home, about };
}

module.exports = buildStructuredData;
