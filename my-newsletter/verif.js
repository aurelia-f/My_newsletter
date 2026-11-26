// ============================================================
//  verif.js — controle que les lots D, E, F, la fausse boite mail
//  (serveur + client) et la mention imprimerie sont en place.
//  A lancer depuis le dossier my-newsletter :  node verif.js
//
//  Chaque ligne : [lot, fichier, ce qu'on verifie,
//                  doit contenir, ne doit PLUS contenir]
// ============================================================
const fs = require('fs');
const path = require('path');

const CHECKS = [
  // ---------- LOT D : supprimer un numero, avec vote ----------
  ['Lot D', 'server/sql/schema.sql', 'table des votes',
    ['CREATE TABLE issue_deletion_votes'], []],
  ['Lot D', 'server/models/IssueDeletionVote.js', 'modele du vote',
    ['issue_deletion_votes', 'requested_by'], []],
  ['Lot D', 'server/models/index.js', 'modele branche',
    ["require('./IssueDeletionVote')", 'deletionVotes', 'IssueDeletionVote, Ban'], []],
  ['Lot D', 'server/routes/issues.js', 'qui peut voter',
    ['async function votersOf', 'async function deleteIfUnanimous'], []],
  ['Lot D', 'server/routes/issues.js', 'les 4 routes',
    ["'/pending-deletions/:groupId'", "'/:id/deletion'",
     "'/:id/deletion/agree'", 'IssueDeletionVote'], []],
  ['Lot D', 'client/src/api/client.js', 'appels du client',
    ['pendingDeletions', 'askDeletion', 'agreeDeletion', 'cancelDeletion'], []],
  ['Lot D', 'client/src/views/Group.vue', 'bandeau et boutons',
    ['pendingDeletions', 'deletionFor', 'Ask to delete', 'I agree', 'Call it off'], []],

  // ---------- LOT E : bannir et supprimer un membre ----------
  ['Lot E', 'server/sql/schema.sql', 'table des bannies',
    ['CREATE TABLE bans'], []],
  ['Lot E', 'server/models/Ban.js', 'modele du ban',
    ['Ban.isBanned', 'kept_pages'], []],
  ['Lot E', 'server/models/index.js', 'modele branche',
    ["require('./Ban')", 'bannedBy'], []],
  ['Lot E', 'server/routes/admin.js', 'routes du ban',
    ["'/members/:id/ban'", "'/bans'", "'/bans/:id'",
     'bannedEmails', 'A creator cannot be banned'], []],
  ['Lot E', 'server/routes/auth.js', 'controle inscription + connexion',
    ['Ban.isBanned'], []],
  ['Lot E', 'client/src/api/client.js', 'appels du client',
    ['banMember', 'bans:', 'unban'], []],
  ['Lot E', 'client/src/views/Admin.vue', 'la question et la liste',
    ['banTarget', 'confirmBan', 'Keep her pages', 'Erase everything',
     'Banned addresses', 'admin.bans()'], []],

  // ---------- LOT F : mot de passe oublie + email ----------
  ['Lot F', 'server/sql/schema.sql', 'table des jetons',
    ['CREATE TABLE auth_tokens', 'token_hash'], []],
  ['Lot F', 'server/models/AuthToken.js', 'jeton hache, a usage unique',
    ['AuthToken.issue', 'AuthToken.consume', 'sha256', 'used_at'], []],
  ['Lot F', 'server/models/index.js', 'modele branche',
    ["require('./AuthToken')", 'authTokens'], []],
  ['Lot F', 'server/routes/auth.js', 'les 5 routes',
    ["'/forgot'", "'/reset'", "'/email'", "'/email/confirm'", "'/token/:token'"], []],
  ['Lot F', 'server/routes/auth.js', 'durees de vie',
    ['RESET_MINUTES', 'EMAIL_MINUTES'], []],
  ['Lot F', 'server/routes/auth.js', 'les groupes suivent la nouvelle adresse',
    ['Member.update'], []],

  // ---------- FAUSSE BOITE MAIL : serveur ----------
  ['Boite mail (serveur)', 'server/sql/schema.sql', 'table des mails',
    ['CREATE TABLE mails'], []],
  ['Boite mail (serveur)', 'server/models/Mail.js', 'la seule porte de sortie',
    ['Mail.send'], []],
  ['Boite mail (serveur)', 'server/models/index.js', 'modele branche',
    ["require('./Mail')", 'AuthToken, Mail'], []],
  ['Boite mail (serveur)', 'server/routes/mails.js', 'routes de la boite',
    ["'/:id/read'"], []],
  ['Boite mail (serveur)', 'server/index.js', 'routes montees',
    ["app.use('/api/mails'"], []],
  ['Boite mail (serveur)', 'server/routes/auth.js', 'le jeton part dans le lien',
    ['Mail.send', "link: '/link/' + raw", 'sent_to'],
    ['token: raw']],

  // ---------- FAUSSE BOITE MAIL : client ----------
  ['Boite mail (client)', 'client/src/api/client.js', 'appels de la boite',
    ['export const mails', 'inspectToken', 'both by mailed link'],
    ['both by code']],
  ['Boite mail (client)', 'client/src/router/index.js', 'les 2 routes publiques',
    ["name: 'mailbox'", "path: '/link/:token'"], []],
  ['Boite mail (client)', 'client/src/views/Mailbox.vue', 'la boite elle-meme',
    ['apiMails.inbox', 'Follow the link'], []],
  ['Boite mail (client)', 'client/src/views/Link.vue', 'la page du lien',
    ['inspectToken', 'password_reset', 'email_change'], []],
  ['Boite mail (client)', 'client/src/views/Login.vue', 'mot de passe oublie',
    ['askMail', 'sentTo', "name: 'mailbox'"],
    ['codeShown', 'resetToken']],
  ['Boite mail (client)', 'client/src/views/Profile.vue', 'changement d\'adresse',
    ['askEmailChange', 'emailSentTo'],
    ['emailCodeShown', 'emailToken']],

  // ---------- L'IMPRIMERIE ----------
  ['Imprimerie', 'client/src/views/Shop.vue', 'mention sur la page papier',
    ['Printed by a local press'], []]
];

// Les pieges d'ordre : Express lit ses routes dans l'ordre d'ecriture.
const ORDER = [
  ['Lot D', 'server/routes/issues.js',
    'pending-deletions declaree AVANT /:id',
    "'/pending-deletions/:groupId'", "router.get('/:id'"]
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

console.log('\n──── Ordre des routes ────');
for (const [group, file, label, first, second] of ORDER) {
  const text = read(file);
  if (text === null) {
    console.log('  [?] ' + label + '  --> fichier introuvable : ' + file);
    ko++; continue;
  }
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  if (a === -1 || b === -1) {
    console.log('  [!!] ' + label + '   (' + file + ')');
    if (a === -1) console.log('       introuvable   : ' + first);
    if (b === -1) console.log('       introuvable   : ' + second);
    ko++;
  } else if (a < b) {
    console.log('  [OK] ' + label);
    ok++;
  } else {
    console.log('  [!!] ' + label + '   (' + file + ')');
    console.log('       ' + first + ' doit etre AVANT ' + second);
    console.log('       sinon Express lit "pending-deletions" comme un id de numero');
    ko++;
  }
}

console.log('\n════════════════════════════════');
console.log('  ' + ok + ' verification(s) OK, ' + ko + ' a corriger');
console.log('════════════════════════════════\n');