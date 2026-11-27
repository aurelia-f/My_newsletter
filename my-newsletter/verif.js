// ============================================================
//  verif.js  —  version 2 (27/11/2026)
//  Controle lot par lot que les modifications sont en place.
//  A lancer depuis le dossier my-newsletter :   node verif.js
// ============================================================
const fs = require('fs');
const path = require('path');

// [lot, fichier, libelle, [doit contenir], [ne doit plus contenir]]
const CHECKS = [

  // ---------------- LOT 1 : boutons et inputs ----------------
  ['LOT 1  boutons et inputs', 'client/src/assets/style.css', 'inputs tous pareils',
    ['input:not([type=checkbox])'], ['input[type=text], input[type=email]']],
  ['LOT 1  boutons et inputs', 'client/src/assets/style.css', 'pastilles de choix reparees',
    ['.choice-pill.active'], ['.choice-pill > span', '.choice-pill input:checked']],
  ['LOT 1  boutons et inputs', 'client/src/assets/style.css', 'etoiles reparees',
    ['.star.active'], ['.star.filled']],
  ['LOT 1  boutons et inputs', 'client/src/assets/style.css', 'emojis harmonises',
    ['.emoji-chip:focus-visible'], []],

  // ---------------- LOT 3 : questions personnalisees ----------------
  ['LOT 3  questions personnalisees', 'server/config/questions.js', '4 questions surprises',
    ['SURPRISE_COUNT = 4'], ['SURPRISE_COUNT = 2']],
  ['LOT 3  questions personnalisees', 'client/src/views/Questionnaire.vue', 'calcul du drapeau perGroup',
    ['q.perGroup = q.rotating === true'], []],
  ['LOT 3  questions personnalisees', 'client/src/views/Questionnaire.vue', 'mention visible du tirage',
    ['Drawn for this group'], ['Only asked in:']],

  // ---------------- LOT 9 : payer par X mois ----------------
  ['LOT 9  payer par X mois', 'server/services/pricing.js', 'signature avec months',
    ['async function quote(codes, months = 1)'], ['async function quote(codes) {']],
  ['LOT 9  payer par X mois', 'server/services/pricing.js', 'remises 6 mois et 1 an',
    ['six_month_discount', 'yearly_discount', 'period_savings'], []],
  ['LOT 9  payer par X mois', 'server/models/Subscription.js', 'champs months et total_paid',
    ['total_paid', 'months:'], []],
  ['LOT 9  payer par X mois', 'server/sql/schema.sql', 'colonnes dans le schema',
    ['total_paid'], []],
  ['LOT 9  payer par X mois', 'server/routes/subscriptions.js', 'date sur n mois',
    ['inNMonths'], ['function inAMonth()']],
  ['LOT 9  payer par X mois', 'server/routes/subscriptions.js', 'montant total debite',
    ['quote.total'], []],
  ['LOT 9  payer par X mois', 'client/src/api/client.js', 'devis avec la duree',
    ['months'], []],
  ['LOT 9  payer par X mois', 'client/src/views/Plans.vue', 'selecteur de duree',
    ['months'], []],
  ['LOT 9  payer par X mois', 'client/src/views/Plans.vue', 'total a payer affiche',
    ['quote.total'], []],

  // ---------------- LOT 5 : gabarit stable entre groupes ----------------
  ['LOT 5  gabarit stable entre groupes', 'client/src/components/Newspaper.vue', 'gabarit lie au compte, pas au rang',
    ['hashOf'], ['TEMPLATES[(props.index']],

  // ---------------- LOT A : questionnaire par groupe ----------------
  ['LOT A  questionnaire par groupe', 'client/src/components/QuestionField.vue', 'composant de champ extrait',
    ['question'], []],
  ['LOT A  questionnaire par groupe', 'client/src/views/Questionnaire.vue', 'une section par groupe',
    ['groupSections'], []],
  ['LOT A  questionnaire par groupe', 'client/src/views/Questionnaire.vue', 'avertissement pages non liees',
    ['not linked to one another'], []],

  // ---------------- LOT D : supprimer un numero, vote du groupe ----------------
  ['LOT D  suppression avec vote', 'server/models/IssueDeletionVote.js', 'modele des votes',
    ['issue_id'], []],
  ['LOT D  suppression avec vote', 'server/sql/schema.sql', 'table issue_deletion_votes',
    ['CREATE TABLE issue_deletion_votes'], []],
  ['LOT D  suppression avec vote', 'server/routes/issues.js', 'routes de demande et accord',
    ["'/:id/deletion'", "'/:id/deletion/agree'", "'/pending-deletions/:groupId'"], []],
  ['LOT D  suppression avec vote', 'client/src/views/Group.vue', 'bandeau en haut du groupe',
    ['agreeDeletion'], []],

  // ---------------- LOT E : bannir et supprimer un membre ----------------
  ['LOT E  bannir un membre', 'server/models/Ban.js', 'modele des bannis',
    ['email'], []],
  ['LOT E  bannir un membre', 'server/sql/schema.sql', 'table bans',
    ['CREATE TABLE bans'], []],
  ['LOT E  bannir un membre', 'server/routes/admin.js', 'route de bannissement',
    ["'/members/:id/ban'"], []],
  ['LOT E  bannir un membre', 'client/src/views/Admin.vue', 'bouton dans l ecran createur',
    ['ban'], []],

  // ---------------- LOT F : mot de passe oublie et email ----------------
  ['LOT F  mot de passe et email', 'server/models/AuthToken.js', 'modele des jetons',
    ['token_hash'], []],
  ['LOT F  mot de passe et email', 'server/models/Mail.js', 'modele de la boite mail locale',
    ['to_email'], []],
  ['LOT F  mot de passe et email', 'server/sql/schema.sql', 'tables auth_tokens et mails',
    ['CREATE TABLE auth_tokens', 'CREATE TABLE mails'], []],
  ['LOT F  mot de passe et email', 'server/routes/auth.js', 'routes mot de passe oublie',
    ["'/forgot'", "'/reset'"], []],
  ['LOT F  mot de passe et email', 'server/routes/auth.js', 'routes changement d email',
    ["'/email'", "'/email/confirm'"], []],
  ['LOT F  mot de passe et email', 'server/routes/mails.js', 'routes de la boite mail',
    ['router'], []],
  ['LOT F  mot de passe et email', 'server/index.js', 'boite mail branchee sur l API',
    ['mails'], []],
  ['LOT F  mot de passe et email', 'client/src/views/Mailbox.vue', 'ecran de la boite mail',
    ['mail'], []],
  ['LOT F  mot de passe et email', 'client/src/views/Link.vue', 'ecran d ouverture du lien',
    ['token'], []],
  ['LOT F  mot de passe et email', 'client/src/router/index.js', 'routes mailbox et lien',
    ['mailbox'], []],
  ['LOT F  mot de passe et email', 'client/src/views/Login.vue', 'lien mot de passe oublie',
    ['forgot'], []],
  ['LOT F  mot de passe et email', 'client/src/views/Profile.vue', 'changement d email',
    ['email'], []],

  // ---------------- LOT G : telephone et ordinateur ----------------
  ['LOT G  telephone et ordinateur', 'client/src/assets/style.css', 'petits ecrans (420px)',
    ['@media (max-width: 420px)'], []],
  ['LOT G  telephone et ordinateur', 'client/src/assets/style.css', 'tablettes (1024px)',
    ['@media (max-width: 1024px)'], []],

  // ---------------- LOT H : renommage createur ----------------
  ['LOT H  renommage createur', 'client/src/App.vue', 'bouton Creator dans le menu',
    ['>Creator<'], []],
  ['LOT H  renommage createur', 'client/src/views/Groups.vue', 'admin de groupe explicite',
    ['group admin'], ['You are an admin']],
  ['LOT H  renommage createur', 'client/src/views/Issue.vue', 'admin de groupe explicite',
    ['group admin'], ['Only an admin can change it']],
  ['LOT H  renommage createur', 'client/src/views/Shop.vue', 'admin de groupe explicite',
    ['group admins'], []],

  // ---------------- LOT C : add-on Music (mon�tisation notee) ----------------
  ['LOT C  add-on Music payant', 'server/sql/seed.js', 'plan payant de code music',
    ["'music'"], []]
];

if (!fs.existsSync('package.json')) {
  console.log('\n  Mauvais dossier.');
  console.log('  Place-toi dans my-newsletter, celui qui contient package.json.\n');
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
const failures = [];

for (const [group, file, label, mustHave, mustNotHave] of CHECKS) {
  if (group !== lot) { lot = group; console.log('\n──── ' + lot + ' ' + '─'.repeat(Math.max(0, 46 - lot.length))); }

  const text = read(file);
  if (text === null) {
    console.log('  [?]  ' + label);
    console.log('       fichier absent : ' + file);
    ko++; failures.push(lot + ' / ' + label); continue;
  }

  const missing  = mustHave.filter(s => !text.includes(s));
  const leftover = mustNotHave.filter(s => text.includes(s));

  if (!missing.length && !leftover.length) {
    console.log('  [OK] ' + label);
    ok++;
  } else {
    console.log('  [!!] ' + label + '   (' + file + ')');
    missing.forEach(s  => console.log('       manque      : ' + s));
    leftover.forEach(s => console.log('       a supprimer : ' + s));
    ko++; failures.push(lot + ' / ' + label);
  }
}

console.log('\n' + '═'.repeat(52));
console.log('  ' + ok + ' verification(s) OK, ' + ko + ' a corriger');
if (failures.length) {
  console.log('\n  A reprendre :');
  failures.forEach(f => console.log('   · ' + f));
}
console.log('═'.repeat(52) + '\n');
