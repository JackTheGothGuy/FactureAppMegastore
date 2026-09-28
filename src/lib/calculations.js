'use strict';

const TVA_RATE = 0.19; // TVA 19%
const TIMBRE_FISCAL = 1.0; // droit de timbre fixe

/**
 * Arrondit à 3 décimales (millimes), comme l'exige la devise (TND).
 */
function round3(n) {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
}

/**
 * Calcule le total HT, la TVA, le timbre fiscal et le total TTC
 * à partir de la liste des postes (chacun avec un prix total HT ptHt).
 * Un seul timbre fiscal est appliqué par document, quel que soit le
 * nombre de postes.
 */
function computeTotals(items) {
  const totHt = round3(items.reduce((sum, item) => sum + round3(item.ptHt), 0));
  const tva = round3(totHt * TVA_RATE);
  const timbre = round3(TIMBRE_FISCAL);
  const totTtc = round3(totHt + tva + timbre);
  return { totHt, tva, timbre, totTtc };
}

/**
 * Formate un montant avec exactement 3 décimales, sans séparateur de
 * milliers (convention utilisée sur les factures tunisiennes : "8000.000").
 */
function formatMontant(n) {
  return round3(n).toFixed(3);
}

module.exports = { TVA_RATE, TIMBRE_FISCAL, round3, computeTotals, formatMontant };
