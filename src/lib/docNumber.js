'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const COUNTER_FILE = path.join(DATA_DIR, 'counters.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(COUNTER_FILE)) fs.writeFileSync(COUNTER_FILE, JSON.stringify({}), 'utf8');
}

function readCounters() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeCounters(data) {
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function yearInfo() {
  const year = new Date().getFullYear();
  return { year, yy: String(year).slice(-2) };
}

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Numéro qui SERAIT attribué au prochain document (sans incrémenter le
 * compteur) — sert à pré-remplir le champ modifiable du formulaire.
 */
function peekDocNumber(docType) {
  const { year, yy } = yearInfo();
  const next = (readCounters()[`${docType}_${year}`] || 0) + 1;
  return `${pad2(next)}/${yy}`;
}

/**
 * Attribue et persiste le prochain numéro séquentiel ("09/26") pour un type
 * de document et l'année en cours. Un compteur distinct par type et par année.
 *
 * Remarque : lecture/écriture synchrone d'un fichier JSON, suffisant pour un
 * usage mono-utilisateur / petite entreprise (voir README).
 */
function nextDocNumber(docType) {
  const { year, yy } = yearInfo();
  const key = `${docType}_${year}`;
  const counters = readCounters();
  const next = (counters[key] || 0) + 1;
  counters[key] = next;
  writeCounters(counters);
  return `${pad2(next)}/${yy}`;
}

/**
 * Quand l'utilisateur saisit lui-même un numéro au format "N/AA" de l'année
 * en cours, le compteur est avancé jusqu'à N (jamais reculé) : le numéro
 * suivant proposé continue donc à partir de sa saisie.
 */
function syncCounter(docType, docNumber) {
  const m = /^\s*(\d+)\s*\/\s*(\d{2})\s*$/.exec(String(docNumber));
  const { year, yy } = yearInfo();
  if (!m || m[2] !== yy) return;
  const key = `${docType}_${year}`;
  const counters = readCounters();
  const n = parseInt(m[1], 10);
  if (n > (counters[key] || 0)) {
    counters[key] = n;
    writeCounters(counters);
  }
}

module.exports = { nextDocNumber, peekDocNumber, syncCounter };
