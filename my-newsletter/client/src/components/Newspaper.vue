<!-- ============================================================
     The "real newsprint" rendering of one page.

     The HEADER and the FOOTER are locked: the same structure
     everywhere, whichever template is used. What changes is the
     body.

     Two renderings of the body, from ONE list of pieces
     (`api/pieces.js`):

       - the templates — five of them, handed out so that two
         neighbours never get the same one and so they rotate from
         month to month. The browser places the pieces;
       - the free canvas, when the person has arranged her page
         herself (`entry.layout.free`). She places them.

     There is no conversion from one to the other: both read the
     same list. Nothing here touches the DOM by hand.
     ============================================================ -->
<script setup>
import { computed } from 'vue';
import { monthInWords } from '../api/dates';
import { state } from '../api/state';
import { piecesOf, mergeLayout } from '../api/pieces';
import NewspaperPiece from './NewspaperPiece.vue';
import NewspaperCanvas from './NewspaperCanvas.vue';

const props = defineProps({
  entry: { type: Object, required: true },
  issue: { type: Object, required: true },
  index: { type: Number, default: 0 },
  asked: { type: Array, default: () => [] },

  // A heavily filled page runs onto several sheets. Nothing is
  // shrunk or hidden: the content is shifted up to show what
  // comes next, with the same header and footer (see Issue.vue).
  sheet:  { type: Number, default: 1 },
  sheets: { type: Number, default: 1 },
  offset: { type: Number, default: 0 },
  usable: { type: Number, default: 0 }
});

const TEMPLATES = ['g-classic', 'g-edit', 'g-dropcap', 'g-retro', 'g-urban'];

// All the pieces of this page, in reading order.
const pieces = computed(() => piecesOf(props.entry, props.issue, props.asked));

// Has she arranged this page herself?
const free = computed(() => props.entry.layout?.free === true);

// Free rendering: the pieces with the boxes she saved. A piece
// that has vanished is dropped, a new one is stacked underneath.
const placed = computed(() =>
  free.value ? mergeLayout(pieces.value, props.entry.layout) : []);

// Template rendering: the pieces as the browser will flow them.
const photo   = computed(() => pieces.value.find(p => p.kind === 'photo'));
const gallery = computed(() => pieces.value.find(p => p.kind === 'gallery'));
const flow    = computed(() =>
  pieces.value.filter(p => !['photo', 'gallery'].includes(p.kind)));

const template = computed(() => free.value
  ? 'g-free'
  : TEMPLATES[(props.index + (Number(props.issue.number) || 0)) % TEMPLATES.length]);

const name = computed(() => props.entry.author?.first_name || 'A friend');
const footer = computed(() => props.issue.footer || '');
</script>

<template>
  <article class="np-page" :class="template"
           :data-entry="sheet === 1 ? entry.id : null"
           :data-sheet="sheet" :data-sheets="sheets">
    <div class="np-fit">

      <!-- ===== LOCKED HEADER ===== -->
      <div class="np-head">
        <div class="np-topline">
          <span>{{ monthInWords(issue.month) }}</span>
          <span class="np-brand">
            <img src="/logo-newspaper.png" alt="">{{ state.config?.site_name || 'My Newsletter' }}
          </span>
        </div>
        <div class="np-rule"></div>
        <h1 class="np-masthead">{{ issue.group?.name }}</h1>
        <div class="np-rule np-double"></div>
        <div class="np-person">{{ name }}</div>
        <div class="np-rule"></div>
      </div>

      <!-- ===== BODY ===== -->
      <div class="np-body">
        <div class="np-flowbox"
             :style="offset ? { transform: `translateY(-${offset}px)` } : null">

          <!-- End-of-sheet marks, never printed -->
          <div v-for="k in Math.max(0, sheets - 1)" :key="'end' + k"
               class="np-sheet-end no-print"
               :style="{ top: (k * usable) + 'px' }"></div>

          <!-- ----- Arranged by hand ----- -->
          <NewspaperCanvas v-if="free" :pieces="placed" />

          <!-- ----- Laid out by the template ----- -->
          <template v-else>
            <NewspaperPiece v-if="photo" :piece="photo" />

            <div class="np-flow">
              <NewspaperPiece v-for="p in flow" :key="p.id" :piece="p" />
            </div>

            <NewspaperPiece v-if="gallery" :piece="gallery" />
          </template>
        </div>
      </div>

      <!-- ===== LOCKED FOOTER ===== -->
      <div class="np-foot">
        <span>{{ footer }}</span>
        <span>Issue number {{ issue.number }}</span>
      </div>
    </div>
  </article>
</template>