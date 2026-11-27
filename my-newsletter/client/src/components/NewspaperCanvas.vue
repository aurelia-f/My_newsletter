<!-- ============================================================
     THE FREE CANVAS

     The template renderings (g-classic, g-edit…) let the browser
     decide where things go. Here the person decides: each piece
     is a `.np-cell` placed absolutely, exactly where she put it.
     Nothing is pushed by its neighbour, nothing is realigned.

     Units: `x` and `w` are a share of the sheet's width (%), so
     the page survives a change of zoom or of screen. `y` and `h`
     are in pixels of the A4 body at 96 dpi, because a filled page
     runs onto several sheets and there is no total height to be a
     percentage of.

     The canvas gives itself the height of its lowest piece: its
     children are absolute, so without that `Issue.vue` would
     measure nothing and would never split the page into sheets.

     The same component reads AND edits. Read-only it is a page of
     the newspaper; with `editing`, it hands every gesture up to
     `EntryLayout.vue`, which does the arithmetic (`api/arrange.js`).

     While editing, the canvas is EXACTLY as tall as one A4 body —
     never taller. The bottom edge is drawn in red, with its
     label, so the end of the sheet is in plain sight; and no box
     can be dragged past it, so nothing is ever lost below the
     paper. Read-only, on the contrary, the canvas takes the
     height of its content and `Issue.vue` cuts it into sheets.
     ============================================================ -->
<script setup>
import { computed, ref } from 'vue';
import NewspaperPiece from './NewspaperPiece.vue';

const props = defineProps({
  pieces: { type: Array, required: true },

  // Editing: the labels, the dashed outlines and the corner
  // handle (the stylesheet does it all, under `.np-issue`).
  editing: { type: Boolean, default: false },
  chosenId: { type: String, default: '' },
  draggingId: { type: String, default: '' },

  // The ids of the pieces that overlap another one. Flagged,
  // never prevented.
  overlapping: { type: Object, default: () => new Set() },

  // The dashed rules showing where each sheet stops.
  usable: { type: Number, default: 0 }
});

const emit = defineEmits(['grab']);

const root = ref(null);
defineExpose({ root });     // EntryLayout measures this width

// Where the lowest piece ends.
const lowest = computed(() =>
  props.pieces.reduce((low, p) => Math.max(low, p.box.y + p.box.h), 0));

// Editing: one A4, full stop. Reading: the height of the content.
const height = computed(() =>
  props.editing && props.usable > 0 ? props.usable : lowest.value + 24);

// Reading only: how many sheets the content runs onto.
const sheets = computed(() =>
  !props.editing && props.usable > 0
    ? Math.max(1, Math.ceil((lowest.value + 24) / props.usable))
    : 1);

function styleOf(box) {
  return {
    left: box.x + '%',
    width: box.w + '%',
    top: box.y + 'px',
    height: box.h + 'px',
    '--np-text': box.text ?? 1
  };
}

/** The label on the handle: the piece, in two words. */
function nameOf(piece) {
  if (piece.kind === 'block') return piece.label || piece.id;
  if (piece.kind === 'asked') return 'a question';
  return { photo: 'photo', standfirst: 'opening', quote: 'quote',
           gallery: 'photos' }[piece.kind] || piece.id;
}
</script>

<template>
  <div class="np-canvas" ref="root" :style="{ height: height + 'px' }">

    <!-- Reading: where each sheet stops. Never printed. -->
    <div v-for="k in Math.max(0, sheets - 1)" :key="'end' + k"
         class="np-sheet-end no-print"
         :style="{ top: (k * usable) + 'px' }"></div>

    <!-- Editing: the bottom of the A4, in plain sight. -->
    <div v-if="editing && usable" class="np-edge no-print"
         :style="{ top: usable + 'px' }"
         data-label="end of the A4 — nothing goes below"></div>

    <div v-for="piece in pieces" :key="piece.id"
         class="np-cell"
         :class="{
           'np-chosen': editing && chosenId === piece.id,
           'np-dragging': draggingId === piece.id,
           'np-overlay': editing && overlapping.has(piece.id)
         }"
         :data-id="piece.id"
         :style="styleOf(piece.box)"
         @pointerdown="editing && emit('grab', piece.id, $event, 'move')">

      <span v-if="editing" class="np-handle">{{ nameOf(piece) }}</span>

      <NewspaperPiece :piece="piece" />

      <span v-if="editing" class="np-resize"
            @pointerdown.stop="emit('grab', piece.id, $event, 'resize')"></span>
    </div>
  </div>
</template>