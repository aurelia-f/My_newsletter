// ============================================================
//  verif.js — contrôle que les lots 1, 3 et 9 sont bien en place.
//  À lancer depuis le dossier my-newsletter :  node verif.js
// ============================================================
const fs = require('fs');
const path = require('path');

const CHECKS = [
  // ---------- LOT 1 : boutons et inputs ----------
  ['Lot 1', 'client/src/assets/style.css', 'inputs tous pareils',
    ['input:not([type=checkbox])'], ['input[type=text], input[type=email]']],
  ['Lot 1', 'client/src/assets/style.css', 'pastilles reparees',
    ['.choice-pill.active'], ['.choice-pill > span', '.choice-pill input:checked']],
  ['Lot 1', 'client/src/assets/style.css', 'etoiles reparees',
    ['.star.active'], ['.star.filled']],
  ['Lot 1', 'client/src/assets/style.css', 'emojis harmonises',
    ['.emoji-chip:focus-visible'], []],

  // ---------- LOT 3 : questions personnalisees ----------
  ['Lot 3', 'server/config/questions.js', '4 questions surprises',
    ['SURPRISE_COUNT = 4'], ['SURPRISE_COUNT = 2']],
  ['Lot 3', 'client/src/views/Questionnaire.vue', 'calcul du badge',
    ['q.perGroup = q.rotating === true'], []],
  ['Lot 3', 'client/src/views/Questionnaire.vue', 'affichage du badge',
    ['Drawn for this group'], ['Only asked in:']],

  // ---------- LOT 9 : payer par X mois ----------
  ['Lot 9', 'server/services/pricing.js', 'signature avec months',
    ['async function quote(codes, months = 1)'], ['async function quote(codes) {']],
  ['Lot 9', 'server/services/pricing.js', 'cas vide complete',
    ['period_discount: 0'], []],
  ['Lot 9', 'server/services/pricing.js', 'calcul de la remise',
    ['six_month_discount', 'period_savings'], []],
  ['Lot 9', 'server/models/Subscription.js', 'colonnes months/total_paid',
    ['total_paid', 'months:'], []],
  ['Lot 9', 'server/sql/schema.sql', 'schema a jour',
    ['total_paid'], []],
  ['Lot 9', 'server/routes/subscriptions.js', 'date sur n mois',
    ['function inNMonths(n)'], ['function inAMonth()']],
  ['Lot 9', 'server/routes/subscriptions.js', 'montant total debite',
    ['quote.total'], []],
  ['Lot 9', 'client/src/api/client.js', 'devis avec duree',
    ['months: m'], []],
  ['Lot 9', 'client/src/views/Plans.vue', 'selecteur de duree',
    ['const months = ref(1)', 'PERIODS'], []],
  ['Lot 9', 'client/src/views/Plans.vue', 'total affiche',
    ['To pay now', 'quote.total'], []]
];

if (!fs.existsSync('package.json')) {
  console.log('\n  Tu n\'es pas dans le bon dossier.');
  console.log('  Place-toi dans my-newsletter (celui qui contient package.json).\n');
  process.exit(1);
}

const cache = {};
function read(f) {
  if (!(f in cache)) {
    try { cache[f] = fs.readFileSync(path.join(process.cwd(), f), 'utf8'); }
    catch { cache[f] = null; }
  }
  return cache[f];
}

let ok = 0, ko = 0, lot = '';
for (const [group, file, label, mustHave, mustNotHave] of CHECKS) {
  if (group !== lot) { lot = group; console.log('\n──── ' + lot + ' ────'); }

  const text = read(file);
  if (text === null) {
    console.log('  [?] ' + label + '  --> fichier introuvable : ' + file);
    ko++; continue;
  }

  const missing = mustHave.filter(s => !text.includes(s));
  const leftover = mustNotHave.filter(s => text.includes(s));

  if (!missing.length && !leftover.length) {
    console.log('  [OK] ' + label);
    ok++;
  } else {
    console.log('  [!!] ' + label + '   (' + file + ')');
    missing.forEach(s => console.log('       manque        : ' + s));
    leftover.forEach(s => console.log('       a supprimer   : ' + s));
    ko++;
  }
}

console.log('\n════════════════════════════════');
console.log('  ' + ok + ' verification(s) OK, ' + ko + ' a corriger');
console.log('════════════════════════════════\n');
