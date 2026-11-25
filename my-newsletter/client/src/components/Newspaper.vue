<!-- ============================================================
     The "real newsprint" rendering of one page.

     The HEADER and the FOOTER are locked: the same structure
     everywhere, whichever template is used. What changes is the
     body.

     Five templates, handed out so that two neighbours never get
     the same one, and so they rotate from month to month.
     ============================================================ -->
<script setup>
import { computed } from 'vue';
import { monthInWords } from '../api/dates';
import { state } from '../api/state';

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

const template = computed(() =>
  TEMPLATES[(props.index + (Number(props.issue.number) || 0)) % TEMPLATES.length]);

const name = computed(() => props.entry.author?.first_name || 'A friend');

const content = computed(() => props.entry.content || {});
const media   = computed(() => props.entry.media || []);
const images  = computed(() => media.value.filter(m => m.type !== 'video'));

// The page's photo: the first photo of the month. The profile
// picture is the fallback, so the page is never bare.
const mainPhoto = computed(() =>
  images.value[0]?.url || props.entry.author?.avatar_url || null);

const caption = computed(() => {
  const a = props.entry.author || {};
  return [a.occupation, a.city].filter(Boolean).join(' · ') || `${name.value}, this month`;
});

const standfirst = computed(() => content.value.summary || '');
const quote = computed(() =>
  props.entry.author?.motto || content.value.win || '');

// The sections, minus the ones already used above.
const USED = new Set(['summary', 'photos', 'cover_photo']);

const blocks = computed(() =>
  (props.issue.questions || [])
    .filter(q => !USED.has(q.id))
    .map(q => ({ question: q, value: content.value[q.id],
                 label: content.value[q.id + '_label'] || q.label,
                 link: content.value[q.id + '_link'] }))
    .filter(b => filled(b.value)));

// The questions put by friends, with the answer.
const askedBlocks = computed(() =>
  (props.asked || [])
    .filter(q => filled(content.value['q_' + q.id]))
    .map(q => ({
      id: q.id,
      text: q.text,
      value: content.value['q_' + q.id],
      byline: q.target_id
        ? `${q.author?.first_name || 'A friend'} asks her`
        : `${q.author?.first_name || 'A friend'} asks the group`
    })));

// The remaining photos and the videos, at the foot of the page.
const gallery = computed(() => {
  const skip = images.value.length && mainPhoto.value === images.value[0]?.url ? 1 : 0;
  return media.value.slice(skip);
});

const footer = computed(() => props.issue.footer || '');

function filled(v) {
  return !(v == null || v === '' || (Array.isArray(v) && !v.length));
}

function stars(v) {
  const n = Math.max(0, Math.min(5, Number(v) || 0));
  return { full: '★'.repeat(n), empty: '★'.repeat(5 - n) };
}

function percent(q, v) {
  const min = q.min ?? 0, max = q.max ?? 10;
  return Math.round(((Number(v) - min) / (max - min)) * 100);
}

function asArray(v) { return Array.isArray(v) ? v : [v]; }

/** Turns a Spotify or YouTube link into an embedded player. */
function player(link) {
  if (!link) return null;
  try {
    const u = new URL(link);
    if (u.hostname.includes('spotify')) {
      return { kind: 'spotify', src: 'https://open.spotify.com/embed' +
        u.pathname.replace(/^\/(intl-[a-z]+\/)?/, '/') };
    }
    if (u.hostname.includes('youtu')) {
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
      if (id && /^[\w-]{6,20}$/.test(id)) {
        return { kind: 'youtube', src: 'https://www.youtube.com/embed/' + id };
      }
    }
    return { kind: 'link', src: link };
  } catch { return null; }
}
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

          <figure class="np-photo" :class="{ 'np-photo-empty': !mainPhoto }">
            <template v-if="mainPhoto">
              <img :src="mainPhoto" alt="" loading="lazy">
              <figcaption>{{ caption }}</figcaption>
            </template>
            <div v-else class="np-frame-empty">no photo this month</div>
          </figure>

          <div class="np-flow">
            <p v-if="standfirst" class="np-standfirst">{{ standfirst }}</p>
            <blockquote v-if="quote" class="np-quote">{{ quote }}</blockquote>

            <!-- The sections -->
            <section v-for="b in blocks" :key="b.question.id"
                     class="np-block"
                     :class="{ 'np-block-framed':
                       ['choice','emojis','word','rating','slider'].includes(b.question.type) }"
                     :data-id="b.question.id">
              <h3 class="np-block-title">{{ b.label }}</h3>

              <template v-if="b.question.type === 'music'">
                <p class="np-text">{{ b.value }}</p>
                <div class="no-print" v-if="player(b.link)">
                  <iframe v-if="player(b.link).kind === 'spotify'"
                          :src="player(b.link).src" style="border-radius:12px;margin-top:10px"
                          width="100%" height="152" frameborder="0" loading="lazy"
                          allow="encrypted-media; clipboard-write"></iframe>
                  <iframe v-else-if="player(b.link).kind === 'youtube'"
                          :src="player(b.link).src" style="border-radius:12px;margin-top:10px"
                          width="100%" height="200" frameborder="0" loading="lazy"
                          allowfullscreen></iframe>
                  <p v-else>
                    <a :href="player(b.link).src" target="_blank" rel="noopener">Listen ↗</a>
                  </p>
                </div>
              </template>

              <p v-else-if="b.question.type === 'choice'" class="np-verdict">{{ b.value }}</p>

              <p v-else-if="b.question.type === 'multi'" class="np-choice-list">
                <span v-for="c in asArray(b.value)" :key="c">{{ c }}</span>
              </p>

              <p v-else-if="b.question.type === 'emojis'" class="np-emojis">
                {{ asArray(b.value).join(' ') }}
              </p>

              <p v-else-if="b.question.type === 'word'" class="np-one-word">{{ b.value }}</p>

              <p v-else-if="b.question.type === 'rating'" class="np-stars">
                {{ stars(b.value).full
                }}<span class="np-empties">{{ stars(b.value).empty }}</span>
              </p>

              <template v-else-if="b.question.type === 'slider'">
                <div class="np-gauge">
                  <div :style="{ width: percent(b.question, b.value) + '%' }"></div>
                </div>
                <p class="np-caption">{{ b.value }} out of {{ b.question.max ?? 10 }}</p>
              </template>

              <p v-else class="np-text">{{ b.value }}</p>
            </section>

            <!-- The questions from friends -->
            <section v-for="q in askedBlocks" :key="'q' + q.id"
                     class="np-block np-block-question" :data-id="'q_' + q.id">
              <h3 class="np-block-title">{{ q.byline }}</h3>
              <p class="np-question">{{ q.text }}</p>
              <p class="np-text">{{ q.value }}</p>
            </section>
          </div>

          <div v-if="gallery.length" class="np-gallery">
            <template v-for="(m, i) in gallery" :key="i">
              <video v-if="m.type === 'video'" :src="m.url" controls playsinline></video>
              <img v-else :src="m.url" alt="" loading="lazy">
            </template>
          </div>
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
