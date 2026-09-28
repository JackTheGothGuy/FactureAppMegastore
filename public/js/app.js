'use strict';

/* Générateur de factures/devis/bons de commande — logique du formulaire.
 * Aucune dépendance externe, aucun bundler : ce fichier est servi tel quel. */

(function () {
  // --- Constantes fiscales (dupliquées côté serveur — voir src/lib/calculations.js) ---
  var TVA_RATE = 0.19;
  var TIMBRE = 1.0;

  function round3(n) {
    return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
  }
  function fmt(n) {
    return round3(n).toFixed(3);
  }

  // --- Conversion en toutes lettres (port du module Node src/lib/numberToWordsFr.js) ---
  var UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    'dix-sept', 'dix-huit', 'dix-neuf'];
  var TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante',
    'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

  function twoDigitsToWords(n, allowS) {
    if (allowS === undefined) allowS = true;
    if (n < 20) return UNITS[n];
    var tensDigit = Math.floor(n / 10);
    var unit = n % 10;
    if (tensDigit === 7 || tensDigit === 9) {
      var base = TENS[tensDigit - 1];
      if (unit === 1 && tensDigit === 7) return base + ' et onze';
      return base + '-' + UNITS[10 + unit];
    }
    if (unit === 0) {
      if (tensDigit === 8) return allowS ? TENS[8] + 's' : TENS[8];
      return TENS[tensDigit];
    }
    if (unit === 1 && tensDigit >= 2 && tensDigit !== 8) return TENS[tensDigit] + ' et un';
    return TENS[tensDigit] + '-' + UNITS[unit];
  }

  function threeDigitsToWords(n, allowS) {
    if (allowS === undefined) allowS = true;
    var hundreds = Math.floor(n / 100);
    var rest = n % 100;
    var words = '';
    if (hundreds > 0) {
      words += hundreds === 1 ? 'cent' : UNITS[hundreds] + ' cent';
      if (hundreds > 1 && rest === 0 && allowS) words += 's';
      if (rest > 0) words += ' ';
    }
    if (rest > 0) words += twoDigitsToWords(rest, allowS);
    return words;
  }

  var SCALES = [
    { value: 1000000000, singular: 'milliard', plural: 'milliards' },
    { value: 1000000, singular: 'million', plural: 'millions' },
    { value: 1000, singular: 'mille', plural: 'mille' },
  ];

  function integerToWords(n) {
    if (n === 0) return 'zéro';
    var remaining = Math.floor(n);
    var parts = [];
    for (var i = 0; i < SCALES.length; i += 1) {
      var scale = SCALES[i];
      var count = Math.floor(remaining / scale.value);
      if (count > 0) {
        if (scale.value === 1000 && count === 1) {
          parts.push('mille');
        } else {
          var label = count > 1 ? scale.plural : scale.singular;
          parts.push(threeDigitsToWords(count, false) + ' ' + label);
        }
        remaining -= count * scale.value;
      }
    }
    if (remaining > 0 || parts.length === 0) parts.push(threeDigitsToWords(remaining, true));
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function capitalize(s) {
    return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function joinWithNoun(numberWords, noun) {
    if (/\b(million|millions|milliard|milliards)$/.test(numberWords)) return numberWords + ' de ' + noun;
    return numberWords + ' ' + noun;
  }

  function amountToWordsFr(amount) {
    var rounded = Math.round(Number(amount) * 1000) / 1000;
    var dinars = Math.floor(rounded);
    var millimes = Math.round((rounded - dinars) * 1000);
    var words = joinWithNoun(integerToWords(dinars), 'dinar' + (dinars > 1 ? 's' : ''));
    if (millimes > 0) {
      words += ' et ' + joinWithNoun(integerToWords(millimes), 'millime' + (millimes > 1 ? 's' : ''));
    }
    return capitalize(words);
  }

  // --- Libellés par type de document (voir src/config/docTypes.js) ---
  var DOC_LABELS = {
    facture: { title: 'Facture', closing: 'Arrêté la présente facture à la somme de :' },
    devis: { title: 'Devis', closing: 'Arrêté le présent devis à la somme de :' },
    bon_de_commande: { title: 'Bon de commande', closing: 'Arrêté le présent bon de commande à la somme de :' },
  };

  // --- Éléments du DOM ---
  var form = document.getElementById('doc-form');
  var clientInput = document.getElementById('client');
  var itemsList = document.getElementById('items-list');
  var itemTemplate = document.getElementById('item-template');
  var addItemBtn = document.getElementById('add-item');
  var statusEl = document.getElementById('form-status');
  var docNumberInput = document.getElementById('docNumber');
  var docDateInput = document.getElementById('docDate');
  var resetBtn = document.getElementById('reset-form');
  var COMPANY_CITY = document.body.getAttribute('data-company-city') || 'Tunis';

  var preview = {
    doctype: document.getElementById('preview-doctype'),
    date: document.getElementById('preview-date'),
    title: document.getElementById('preview-title'),
    client: document.getElementById('preview-client'),
    itemsBody: document.getElementById('preview-items-body'),
    totht: document.getElementById('preview-totht'),
    tva: document.getElementById('preview-tva'),
    timbre: document.getElementById('preview-timbre'),
    totttc: document.getElementById('preview-totttc'),
    closing: document.getElementById('preview-closing'),
    words: document.getElementById('preview-words'),
  };

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // "AAAA-MM-JJ" -> "JJ/MM/AAAA" (vide = aujourd'hui, comme côté serveur)
  function isoToFr(iso) {
    var parts = (iso || todayIso()).split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function selectedDocType() {
    var checked = form.querySelector('input[name="docType"]:checked');
    return checked ? checked.value : 'facture';
  }

  // --- Gestion dynamique des postes (ajout/suppression/numérotation) ---
  function itemCards() {
    return Array.prototype.slice.call(itemsList.querySelectorAll('.item-card'));
  }

  function renumberItems() {
    var cards = itemCards();
    cards.forEach(function (card, index) {
      card.querySelector('.item-number').textContent = 'Poste ' + (index + 1);
      card.querySelector('.remove-item').disabled = cards.length <= 1;
    });
  }

  function wireItemCard(card) {
    card.querySelector('.remove-item').addEventListener('click', function () {
      if (itemCards().length <= 1) return;
      card.remove();
      renumberItems();
      updatePreview();
    });

    var quantityInput = card.querySelector('.item-quantity');
    var puHtInput = card.querySelector('.item-puht');
    var ptHtInput = card.querySelector('.item-ptht');
    var recalcBtn = card.querySelector('.item-recalc');

    function autoComputePtHt() {
      if (card.dataset.ptHtEdited === 'true') return;
      var quantity = Number(quantityInput.value) || 0;
      var puHt = Number(puHtInput.value) || 0;
      if (quantity > 0 && puHt > 0) {
        ptHtInput.value = round3(quantity * puHt);
      }
    }

    ptHtInput.addEventListener('input', function () {
      card.dataset.ptHtEdited = 'true';
    });
    quantityInput.addEventListener('input', autoComputePtHt);
    puHtInput.addEventListener('input', autoComputePtHt);
    recalcBtn.addEventListener('click', function () {
      card.dataset.ptHtEdited = 'false';
      autoComputePtHt();
      updatePreview();
      ptHtInput.focus();
    });
  }

  wireItemCard(itemsList.querySelector('.item-card'));

  addItemBtn.addEventListener('click', function () {
    var fragment = itemTemplate.content.cloneNode(true);
    var card = fragment.querySelector('.item-card');
    itemsList.appendChild(fragment);
    wireItemCard(card);
    renumberItems();
    updatePreview();
    card.querySelector('.item-designation').focus();
  });

  function collectItems() {
    return itemCards().map(function (card) {
      return {
        quantity: Number(card.querySelector('.item-quantity').value) || 0,
        designation: card.querySelector('.item-designation').value.trim(),
        puHt: Number(card.querySelector('.item-puht').value) || 0,
        ptHt: Number(card.querySelector('.item-ptht').value) || 0,
      };
    });
  }

  // --- Aperçu en direct ---
  function updatePreview() {
    var docType = selectedDocType();
    var labels = DOC_LABELS[docType];

    preview.doctype.textContent = labels.title;
    preview.date.textContent = COMPANY_CITY + ' le ' + isoToFr(docDateInput.value);
    preview.title.textContent = labels.title + ' N° ' + (docNumberInput.value.trim() || '--/--');
    preview.closing.textContent = labels.closing;

    var client = clientInput.value.trim();
    preview.client.textContent = client || '—';
    preview.client.className = client ? '' : 'doc-empty-placeholder';

    var items = collectItems();
    var hasContent = items.some(function (it) { return it.designation || it.puHt || it.ptHt; });

    preview.itemsBody.innerHTML = '';
    if (!hasContent) {
      var emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td class="col-qte"></td><td class="col-desc"><span class="doc-empty-placeholder">—</span></td><td class="col-pu"></td><td class="col-pt"></td>';
      preview.itemsBody.appendChild(emptyRow);
    } else {
      items.forEach(function (item) {
        var tr = document.createElement('tr');
        var qteCell = document.createElement('td');
        qteCell.className = 'col-qte';
        qteCell.textContent = item.quantity > 0 ? String(item.quantity) : '';

        var descCell = document.createElement('td');
        descCell.className = 'col-desc';
        descCell.textContent = item.designation || '—';
        if (!item.designation) descCell.classList.add('doc-empty-placeholder');

        var puCell = document.createElement('td');
        puCell.className = 'col-pu';
        puCell.textContent = fmt(item.puHt);

        var ptCell = document.createElement('td');
        ptCell.className = 'col-pt';
        ptCell.textContent = fmt(item.ptHt);

        tr.appendChild(qteCell);
        tr.appendChild(descCell);
        tr.appendChild(puCell);
        tr.appendChild(ptCell);
        preview.itemsBody.appendChild(tr);
      });
    }

    var totHt = round3(items.reduce(function (sum, it) { return sum + round3(it.ptHt); }, 0));
    var tva = round3(totHt * TVA_RATE);
    var timbre = round3(TIMBRE);
    var totTtc = round3(totHt + tva + timbre);

    preview.totht.textContent = fmt(totHt);
    preview.tva.textContent = fmt(tva);
    preview.timbre.textContent = fmt(timbre);
    preview.totttc.textContent = fmt(totTtc);
    preview.words.textContent = amountToWordsFr(totTtc) + '.';
  }

  // --- Numéro du document : proposé automatiquement, modifiable ---
  // "edited" = l'utilisateur a saisi son propre numéro : on ne l'écrase plus
  // quand le type de document change.
  function fetchNextNumber() {
    if (docNumberInput.dataset.edited === 'true') return;
    fetch('/api/next-number?docType=' + encodeURIComponent(selectedDocType()))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (data && data.docNumber && docNumberInput.dataset.edited !== 'true') {
          docNumberInput.value = data.docNumber;
          updatePreview();
        }
      })
      .catch(function () { /* champ laissé vide : numéro automatique côté serveur */ });
  }

  docNumberInput.addEventListener('input', function () {
    docNumberInput.dataset.edited = docNumberInput.value.trim() ? 'true' : 'false';
  });
  Array.prototype.forEach.call(form.querySelectorAll('input[name="docType"]'), function (radio) {
    radio.addEventListener('change', fetchNextNumber);
  });

  // --- Tout effacer ---
  resetBtn.addEventListener('click', function () {
    var dirty = clientInput.value.trim() || collectItems().some(function (it) {
      return it.designation || it.puHt || it.ptHt || it.quantity;
    });
    if (dirty && !window.confirm('Effacer toutes les valeurs saisies ?')) return;

    clientInput.value = '';
    var cards = itemCards();
    cards.slice(1).forEach(function (card) { card.remove(); });
    Array.prototype.forEach.call(cards[0].querySelectorAll('input, textarea'), function (el) { el.value = ''; });
    cards[0].dataset.ptHtEdited = 'false';

    docDateInput.value = todayIso();
    docNumberInput.value = '';
    docNumberInput.dataset.edited = 'false';

    renumberItems();
    setStatus('', null);
    updatePreview();
    fetchNextNumber(); // repart sur le numéro suivant : c'est un nouveau document
    clientInput.focus();
  });

  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);

  // --- Soumission : génération et téléchargement du document ---
  function setStatus(message, state) {
    statusEl.textContent = message;
    if (state) {
      statusEl.setAttribute('data-state', state);
    } else {
      statusEl.removeAttribute('data-state');
    }
  }

  function setButtonsDisabled(disabled) {
    form.querySelectorAll('button[type="submit"]').forEach(function (btn) {
      btn.disabled = disabled;
    });
  }

  function filenameFromDisposition(header, fallback) {
    if (!header) return fallback;
    var match = /filename="([^"]+)"/.exec(header);
    return match ? match[1] : fallback;
  }

  form.addEventListener('submit', function (evt) {
    evt.preventDefault();
    var submitter = evt.submitter || document.getElementById('submit-docx');
    var format = submitter.getAttribute('data-format') || 'docx';

    if (!form.reportValidity()) return;

    var payload = {
      docType: selectedDocType(),
      client: clientInput.value.trim(),
      docNumber: docNumberInput.value.trim(),
      date: docDateInput.value,
      items: collectItems(),
      format: format,
    };

    setButtonsDisabled(true);
    setStatus('Génération du document en cours…', null);

    fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error((data && data.details && data.details.join(' ')) || (data && data.error) || 'Erreur inconnue.');
          });
        }
        var disposition = res.headers.get('Content-Disposition');
        return res.blob().then(function (blob) {
          return { blob: blob, filename: filenameFromDisposition(disposition, 'document.' + format) };
        });
      })
      .then(function (result) {
        var url = URL.createObjectURL(result.blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        setStatus('Document généré et téléchargé.', 'success');
      })
      .catch(function (err) {
        setStatus(err.message || 'Une erreur est survenue.', 'error');
      })
      .finally(function () {
        setButtonsDisabled(false);
      });
  });

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  docDateInput.value = todayIso();
  renumberItems();
  updatePreview();
  fetchNextNumber();
})();
