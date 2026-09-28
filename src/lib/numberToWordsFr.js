'use strict';

/**
 * Conversion d'un nombre entier en toutes lettres, en français standard
 * (règles utilisées en France/Tunisie : soixante-dix, quatre-vingts,
 * quatre-vingt-dix — pas de septante/octante/nonante).
 */

const UNITS = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

// Index par dizaine (0,10,20,...,90). 70 et 90 sont gérés comme cas
// particuliers dans twoDigitsToWords (soixante-dix, quatre-vingt-dix).
const TENS = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante',
  'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix',
];

// `allowTrailingS` gouverne la règle du "s" final sur "vingt" et "cent"
// (quatre-vingts, deux cents) : il ne s'applique que si le mot termine
// VRAIMENT le nombre entier. Quand ce groupe de 3 chiffres sert de
// multiplicateur devant "mille/million/milliard" (ex: "quatre-vingt mille"),
// le "s" doit être supprimé — l'appelant passe alors allowTrailingS=false.
function twoDigitsToWords(n, allowTrailingS = true) {
  if (n < 20) return UNITS[n];

  const tensDigit = Math.floor(n / 10);
  const unit = n % 10;

  if (tensDigit === 7 || tensDigit === 9) {
    // 70-79 -> soixante + (dix..dix-neuf) ; 90-99 -> quatre-vingt + (dix..dix-neuf)
    const base = TENS[tensDigit - 1];
    if (unit === 1 && tensDigit === 7) return `${base} et onze`;
    return `${base}-${UNITS[10 + unit]}`;
  }

  if (unit === 0) {
    if (tensDigit === 8) return allowTrailingS ? `${TENS[8]}s` : TENS[8]; // quatre-vingt(s)
    return TENS[tensDigit];
  }

  if (unit === 1 && tensDigit >= 2 && tensDigit !== 8) {
    return `${TENS[tensDigit]} et un`; // vingt et un, trente et un... (pas quatre-vingt-un)
  }

  return `${TENS[tensDigit]}-${UNITS[unit]}`;
}

function threeDigitsToWords(n, allowTrailingS = true) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let words = '';

  if (hundreds > 0) {
    words += hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent`;
    if (hundreds > 1 && rest === 0 && allowTrailingS) words += 's'; // "deux cents" mais "deux cent un" / "deux cent mille"
    if (rest > 0) words += ' ';
  }

  if (rest > 0) words += twoDigitsToWords(rest, allowTrailingS);

  return words;
}

const SCALES = [
  { value: 1000000000, singular: 'milliard', plural: 'milliards' },
  { value: 1000000, singular: 'million', plural: 'millions' },
  { value: 1000, singular: 'mille', plural: 'mille' }, // "mille" est invariable
];

function integerToWords(n) {
  if (n === 0) return 'zéro';

  let remaining = Math.floor(n);
  const parts = [];

  for (const scale of SCALES) {
    const count = Math.floor(remaining / scale.value);
    if (count > 0) {
      if (scale.value === 1000 && count === 1) {
        parts.push('mille'); // jamais "un mille"
      } else {
        const label = count > 1 ? scale.plural : scale.singular;
        // allowTrailingS=false : ce compte est un multiplicateur (suivi de
        // "mille/million/milliard"), donc pas de "s" sur cent/vingt ici.
        parts.push(`${threeDigitsToWords(count, false)} ${label}`);
      }
      remaining -= count * scale.value;
    }
  }

  if (remaining > 0 || parts.length === 0) {
    // Dernier groupe : c'est vraiment la fin du nombre, le "s" s'applique.
    parts.push(threeDigitsToWords(remaining, true));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function capitalize(s) {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// "million"/"milliard" sont de vrais noms : quand ils terminent le nombre,
// le nom qui suit (dinars, millimes) prend "de" -> "un million de dinars".
function joinWithNoun(numberWords, noun) {
  if (/\b(million|millions|milliard|milliards)$/.test(numberWords)) {
    return `${numberWords} de ${noun}`;
  }
  return `${numberWords} ${noun}`;
}

/**
 * Convertit un montant en dinars tunisiens (avec millimes, 3 décimales)
 * en toutes lettres. Ex : 9521.000 -> "Neuf mille cinq cent vingt et un dinars"
 *                        9521.500 -> "Neuf mille cinq cent vingt et un dinars et cinq cents millimes"
 */
function amountToWordsFr(amount) {
  const rounded = Math.round(Number(amount) * 1000) / 1000;
  const dinars = Math.floor(rounded);
  const millimes = Math.round((rounded - dinars) * 1000);

  let words = joinWithNoun(integerToWords(dinars), `dinar${dinars > 1 ? 's' : ''}`);
  if (millimes > 0) {
    words += ` et ${joinWithNoun(integerToWords(millimes), `millime${millimes > 1 ? 's' : ''}`)}`;
  }
  return capitalize(words);
}

module.exports = { amountToWordsFr, integerToWords };
