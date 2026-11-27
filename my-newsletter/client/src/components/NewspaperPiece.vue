<!-- ============================================================
     ONE PIECE OF A PAGE, rendered.

     The same component serves both renderings: the template
     (Newspaper.vue) and the free canvas (NewspaperCanvas.vue).
     A piece therefore looks the same wherever it is placed —
     which is the whole point of having a list of pieces rather
     than a block of HTML to cut up.

     Its root element IS the piece's own element (figure, p,
     blockquote, section, div): the component adds no wrapper,
     so the stylesheet's rules on `.np-photo`, `.np-flow > *`
     and the five templates keep working untouched.
     ============================================================ -->
<script setup>
import { asArray, stars, percent, player } from '../api/pieces';

defineProps({
  piece: { type: Object, required: true }
});
</script>

<template>
  <!-- ===== The photo of the month ===== -->
  <figure v-if="piece.kind === 'photo'"
          class="np-photo" :class="{ 'np-photo-empty': !piece.url }">
    <template v-if="piece.url">
      <img :src="piece.url" alt="" loading="lazy">
      <figcaption>{{ piece.caption }}</figcaption>
    </template>
    <div v-else class="np-frame-empty">no photo this month</div>
  </figure>

  <!-- ===== The standfirst ===== -->
  <p v-else-if="piece.kind === 'standfirst'" class="np-standfirst">
    {{ piece.text }}
  </p>

  <!-- ===== The quote ===== -->
  <blockquote v-else-if="piece.kind === 'quote'" class="np-quote">
    {{ piece.text }}
  </blockquote>

  <!-- ===== A section of the questionnaire ===== -->
  <section v-else-if="piece.kind === 'block'"
           class="np-block" :class="{ 'np-block-framed': piece.framed }"
           :data-id="piece.id">
    <h3 class="np-block-title">{{ piece.label }}</h3>

    <template v-if="piece.question.type === 'music'">
      <p class="np-text">{{ piece.value }}</p>
      <div class="no-print" v-if="player(piece.link)">
        <iframe v-if="player(piece.link).kind === 'spotify'"
                :src="player(piece.link).src"
                style="border-radius:12px;margin-top:10px"
                width="100%" height="152" frameborder="0" loading="lazy"
                allow="encrypted-media; clipboard-write"></iframe>
        <iframe v-else-if="player(piece.link).kind === 'youtube'"
                :src="player(piece.link).src"
                style="border-radius:12px;margin-top:10px"
                width="100%" height="200" frameborder="0" loading="lazy"
                allowfullscreen></iframe>
        <p v-else>
          <a :href="player(piece.link).src" target="_blank" rel="noopener">Listen ↗</a>
        </p>
      </div>
    </template>

    <p v-else-if="piece.question.type === 'choice'" class="np-verdict">
      {{ piece.value }}
    </p>

    <p v-else-if="piece.question.type === 'multi'" class="np-choice-list">
      <span v-for="c in asArray(piece.value)" :key="c">{{ c }}</span>
    </p>

    <p v-else-if="piece.question.type === 'emojis'" class="np-emojis">
      {{ asArray(piece.value).join(' ') }}
    </p>

    <p v-else-if="piece.question.type === 'word'" class="np-one-word">
      {{ piece.value }}
    </p>

    <p v-else-if="piece.question.type === 'rating'" class="np-stars">
      {{ stars(piece.value).full
      }}<span class="np-empties">{{ stars(piece.value).empty }}</span>
    </p>

    <template v-else-if="piece.question.type === 'slider'">
      <div class="np-gauge">
        <div :style="{ width: percent(piece.question, piece.value) + '%' }"></div>
      </div>
      <p class="np-caption">
        {{ piece.value }} out of {{ piece.question.max ?? 10 }}
      </p>
    </template>

    <p v-else class="np-text">{{ piece.value }}</p>
  </section>

  <!-- ===== A question put by a friend ===== -->
  <section v-else-if="piece.kind === 'asked'"
           class="np-block np-block-question" :data-id="piece.id">
    <h3 class="np-block-title">{{ piece.byline }}</h3>
    <p class="np-question">{{ piece.text }}</p>
    <p class="np-text">{{ piece.value }}</p>
  </section>

  <!-- ===== The rest of the photos and the videos ===== -->
  <div v-else-if="piece.kind === 'gallery'" class="np-gallery">
    <template v-for="(m, i) in piece.media" :key="i">
      <video v-if="m.type === 'video'" :src="m.url" controls playsinline></video>
      <img v-else :src="m.url" alt="" loading="lazy">
    </template>
  </div>
</template>