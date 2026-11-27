// ============================================================
//  verif-mise-en-page.js — controle que les 8 fichiers de la
//  mise en page libre (etape b + l editeur) sont bien en place.
//  A lancer depuis le dossier my-newsletter :
//      node verif-mise-en-page.js
//
//  Meme principe que verif.js : chaque ligne dit quel fichier,
//  ce qu on verifie, ce qu il doit contenir, et ce qu il ne doit
//  PLUS contenir (le signe qu un ancien bloc traine encore).
// ============================================================
const fs = require('fs');
const path = require('path');

const C = 'client/src/components/';
const V = 'client/src/views/';
const A = 'client/src/api/';

const CHECKS = [
  // ---------- ETAPE B : la liste des morceaux ----------
  ['Etape b', A + 'pieces.js', 'les quatre fonctions exportees',
    ['export function piecesOf', 'export function defaultBoxes',
     'export function mergeLayout', 'export function toLayout'], []],
  ['Etape b', A + 'pieces.js', 'la feuille A4 et les boites par defaut',
    ['SHEET_WIDTH = 794', 'SHEET_HEIGHT = 1123', 'DEFAULT_BOX'], []],
  ['Etape b', A + 'pieces.js', 'la taille du texte est enregistree',
    ['text: 1', 'text: clamp(Number(cell.text)'], []],
  ['Etape b', A + 'pieces.js', 'les garde-fous sur ce qui vient de la base',
    ['function sane', 'function clamp'], []],
  ['Etape b', A + 'pieces.js', 'rien de vide : pas de cadre photo sans photo',
    ['if (url) {'], []],
  ['Etape b', A + 'pieces.js', 'on fait tenir la page dans le A4',
    ['export function fitInto'], []],

  ['Etape b', C + 'NewspaperPiece.vue', 'un morceau, tous les types',
    ['piece: { type: Object', "piece.kind === 'photo'",
     "piece.kind === 'standfirst'", "piece.kind === 'quote'",
     "piece.kind === 'block'", "piece.kind === 'asked'",
     "piece.kind === 'gallery'"], []],
  ['Etape b', C + 'NewspaperPiece.vue', 'les helpers viennent de pieces.js',
    ["from '../api/pieces'", 'asArray', 'stars', 'percent', 'player'], []],

  ['Etape b', C + 'Newspaper.vue', 'construit depuis la liste, plus de DOM',
    ['piecesOf', 'mergeLayout', 'NewspaperPiece', 'NewspaperCanvas',
     "'g-free'"], ['querySelector', 'innerHTML']],
  ['Etape b', C + 'Newspaper.vue', 'les cinq gabarits sont toujours la',
    ["'g-classic'", "'g-edit'", "'g-dropcap'", "'g-retro'", "'g-urban'"], []],
  ['Etape b', C + 'Newspaper.vue', 'l ancien rendu a bien ete remplace',
    [], ['const askedBlocks = computed', 'function filled', 'np-block-title']],

  // ---------- L EDITEUR ----------
  ['Editeur', A + 'arrange.js', 'pointer events, pas HTML5 drag and drop',
    ['export function useArrange', "'pointermove'", "'pointerup'",
     "'pointercancel'"],
    // On cherche l usage, pas le mot : le commentaire du fichier
    // parle de l ancienne API, c est normal.
    ['.draggable = true', 'dataTransfer', "addEventListener('dragstart'"]],
  ['Editeur', A + 'arrange.js', 'aimantation, chevauchement, clavier',
    ['MAGNET', 'function magnetise', 'overlapping', 'function hit',
     'function nudge', 'function scaleText'], []],
  ['Editeur', A + 'arrange.js', 'les limites de taille',
    ['MIN_WIDTH', 'MIN_HEIGHT'], []],
  ['Editeur', A + 'arrange.js', 'rien ne descend sous le bas du A4',
    ['limit = () => 0', 'const floor = limit()',
     'const tallest = ', 'const highest = '], []],

  ['Editeur', C + 'NewspaperCanvas.vue', 'les cases placees a la main',
    ['np-canvas', 'np-cell', 'np-handle', 'np-resize',
     "'--np-text'", 'np-sheet-end'], []],
  ['Editeur', C + 'NewspaperCanvas.vue', 'les gestes remontent a la vue',
    ["emit('grab'", "'resize'", 'defineExpose'], []],
  ['Editeur', C + 'NewspaperCanvas.vue', 'chevauchement signale, jamais empeche',
    ['np-overlay', 'np-chosen', 'np-dragging'], []],
  ['Editeur', C + 'NewspaperCanvas.vue', 'la feuille ne grandit pas, le bord est visible',
    ['np-edge', 'props.editing && props.usable > 0 ? props.usable'], []],

  ['Editeur', V + 'EntryLayout.vue', 'la vue d edition',
    ['useArrange', 'NewspaperCanvas', 'np-issue', 'np-bar',
     'defaultBoxes', 'mergeLayout'], []],
  ['Editeur', V + 'EntryLayout.vue', 'enregistrer et revenir au gabarit',
    ['entries.saveLayout', 'toLayout', 'saveLayout(entry.value.id, null)'], []],
  ['Editeur', V + 'EntryLayout.vue', 'le clavier et la mesure de la feuille',
    ["addEventListener('keydown', nudge)", 'function measure',
     '1123 - head - foot'], []],
  ['Editeur', V + 'EntryLayout.vue', 'un A4 qui ne grandit pas',
    ['np-fixed', 'fitInto', 'watch(usable', 'roomLeft', 'BODY_PADDING'],
    ['sheetsUsed']],
  ['Editeur', V + 'EntryLayout.vue', 'aucune reduction du texte',
    [], ['style.zoom', 'Math.min(0.45']],
  ['Editeur', 'client/src/assets/style.css', 'le CSS du A4 fige et du bord rouge',
    ['.np-page.np-issue.np-fixed', '.np-edge'], []],

  // ---------- LE BRANCHEMENT ----------
  ['Branchement', 'client/src/router/index.js', 'la route de l editeur',
    ["path: '/issues/:id/arrange'", "name: 'arrange'",
     'EntryLayout.vue', 'props: true'], []],
  ['Branchement', V + 'Issue.vue', 'le bouton vers l editeur',
    ['const myEntry = computed', 'Arrange my page',
     "'/issues/' + id + '/arrange'"], []],
  ['Branchement', V + 'Questionnaire.vue', 'envoyer mene droit a la mise en page',
    ['useRouter', "name: 'arrange'", 'done[0].issue_id',
     'query: { sent: done.length }'], []],

  // ---------- CE QUI DOIT DEJA ETRE LA ----------
  ['Deja en place', 'client/src/api/client.js', 'appel du client',
    ['saveLayout'], []],
  ['Deja en place', 'server/routes/entries.js', 'la route serveur',
    ["'/:id/layout'", 'You can only arrange your own page'], []],
  ['Deja en place', 'server/models/Entry.js', 'la colonne du modele',
    ['layout'], []],
  ['Deja en place', 'server/sql/schema.sql', 'la colonne en base',
    ['layout     JSON'], []],
  ['Deja en place', 'client/src/assets/style.css', 'le CSS du placement libre',
    ['.np-canvas', '.np-cell', '.np-resize', '.np-overlay', '.np-bar'], []]
];

// Ce qui ne doit apparaitre QU UNE FOIS : deux fois veut dire
// qu un bloc a ete colle sans supprimer l ancien.
const ONCE = [
  ['client/src/router/index.js', 'la route arrange, une seule fois',
    "path: '/issues/:id/arrange'"],
  [V + 'Issue.vue', 'le bouton, une seule fois', 'Arrange my page'],
  [C + 'Newspaper.vue', 'un seul rendu libre', 'NewspaperCanvas v-if'],
  [A + 'pieces.js', 'une seule definition de piecesOf',
    'export function piecesOf'],
  ['client/src/assets/style.css', 'le bloc du A4 fige, une seule fois',
    '.np-page.np-issue.np-fixed {'],
  [V + 'Questionnaire.vue', 'une seule redirection apres envoi',
    "name: 'arrange'"]
];

// Les fichiers qui doivent simplement EXISTER.
const FILES = [
  A + 'pieces.js', A + 'arrange.js',
  C + 'Newspaper.vue', C + 'NewspaperPiece.vue', C + 'NewspaperCanvas.vue',
  V + 'EntryLayout.vue', V + 'Issue.vue', 'client/src/router/index.js'
];

function read(file) {
  try { return fs.readFileSync(path.join(__dirname, file), 'utf8'); }
  catch { return null; }
}

let ok = 0, ko = 0;

console.log('\n════════════════════════════════');
console.log('  Mise en page libre — verification');
console.log('════════════════════════════════');

console.log('\n──── Les 8 fichiers ────');
for (const file of FILES) {
  if (read(file) === null) {
    console.log('  [?] introuvable : ' + file);
    ko++;
  } else {
    console.log('  [OK] ' + file);
    ok++;
  }
}

let lot = '';
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

console.log('\n──── Doublons ────');
for (const [file, label, needle] of ONCE) {
  const text = read(file);
  if (text === null) {
    console.log('  [?] ' + label + '  --> fichier introuvable : ' + file);
    ko++; continue;
  }
  const n = text.split(needle).length - 1;
  if (n === 1) {
    console.log('  [OK] ' + label);
    ok++;
  } else if (n === 0) {
    console.log('  [!!] ' + label + '   (' + file + ')');
    console.log('       introuvable   : ' + needle);
    ko++;
  } else {
    console.log('  [!!] ' + label + '   (' + file + ')');
    console.log('       present ' + n + ' fois : ' + needle);
    console.log('       un bloc a ete colle sans supprimer l ancien');
    ko++;
  }
}

console.log('\n════════════════════════════════');
console.log('  ' + ok + ' verification(s) OK, ' + ko + ' a corriger');
if (!ko) {
  console.log('  Tout est en place. Lance ensuite :');
  console.log('      cd client');
  console.log('      npm run build');
}
console.log('════════════════════════════════\n');