<!-- ============================================================
     "ARRANGE MY PAGE HOW I LIKE"

     One sheet, hers, and a bar on the side. She drags the pieces
     where she wants them, resizes them by the corner, and keeps
     the arrangement; it is saved on `entries.layout` and read
     back by `Newspaper.vue` every month afterwards.

     Three decisions that are hers, and are kept here:
       - the sheet is an A4 and STAYS an A4. It does not grow
         while she arranges it: its bottom edge is drawn in red,
         and no block can be dragged below it. Nothing is ever
         lost off the paper without her seeing it;
       - a page that does not fit on opening is brought inside
         once, every block together (`fitInto`). The words are
         not touched: A− and A+ are there for that;
       - overlapping is allowed, and flagged in red.

     Only her own page: the server refuses anyone else's
     (PATCH /api/entries/:id/layout).
     ============================================================ -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { RouterLink, useRouter, useRoute } from 'vue-router';
import { issues, entries, questions as apiQuestions } from '../api/client';
import { state } from '../api/state';
import { monthInWords } from '../api/dates';
import { piecesOf, mergeLayout, toLayout, defaultBoxes, fitInto } from '../api/pieces';
import { useArrange } from '../api/arrange';
import NewspaperCanvas from '../components/NewspaperCanvas.vue';
import Loading from '../components/Loading.vue';
import Notice from '../components/Notice.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const route = useRoute();

const loading = ref(true);
const issue = ref(null);
const entry = ref(null);
const asked = ref([]);
const pieces = ref([]);
const error = ref('');
const info = ref('');
const busy = ref(false);
const side = ref('right');      // which side the bar sits on
const sheet = ref(null);        // the <article>
const canvas = ref(null);       // the NewspaperCanvas component
const usable = ref(0);          // the height of one sheet's body

const {
  chosenId, chosen, draggingId, overlapping, changed,
  grab, nudge, scaleText, forget, saved, stop
} = useArrange(pieces, () => canvas.value?.root, () => usable.value);

const name = computed(() => entry.value?.author?.first_name
  || state.account?.first_name || 'A friend');

// The footer: the group's first names, locked, as in the issue.
const footer = computed(() =>
  (issue.value?.entries || []).map(e => e.author?.first_name || 'A friend').join(' · '));

const overlaps = computed(() => overlapping.value.size > 0);

// How much room is left at the bottom of the A4.
const lowest = computed(() =>
  pieces.value.reduce((b, p) => Math.max(b, p.box.y + p.box.h), 0));

const roomLeft = computed(() => Math.max(0, usable.value - lowest.value));
const full = computed(() => usable.value > 0 && roomLeft.value < 12);

/** In duotone the photos are turned towards the chosen colour. */
function hueRotation(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360) - 35;
}

const newspaperStyle = computed(() => {
  const color = issue.value?.color;
  if (!color) return null;
  return { '--np-accent': color, '--np-rotation': hueRotation(color) + 'deg' };
});

onMounted(async () => {
  try {
    issue.value = await issues.one(props.id);
    asked.value = await apiQuestions.forIssue(props.id).catch(() => []);

    // My page, taken from the issue: it carries the author and
    // the media, which the bare entry route does not.
    entry.value = (issue.value.entries || [])
      .find(e => e.account_id === state.account?.id) || null;

    if (!entry.value) {
      error.value = 'You have no page in this issue.';
    } else {
      const list = piecesOf(entry.value, issue.value, asked.value);
      pieces.value = entry.value.layout?.free === true
        ? mergeLayout(list, entry.value.layout)
        : defaultBoxes(list);     // first time: the reading order, laid out
    }

    // Straight out of the questionnaire: say where she has landed.
    const sent = Number(route.query.sent) || 0;
    if (sent > 0) {
      info.value = `Your page has gone to ${sent} group${sent > 1 ? 's' : ''}.`
        + ' Arrange this one here; the others are waiting under My newspapers.';
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }

  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('keydown', nudge);
});

// The sheet is measured after rendering, so the arrangement is
// brought inside the A4 as soon as its real height is known —
// and again if the window changes the masthead's height.
watch(usable, (room) => {
  if (!room || !pieces.value.length) return;
  const fitted = fitInto(pieces.value, room);
  if (fitted !== pieces.value) {
    pieces.value = fitted;
    changed.value = true;
  }
});

onBeforeUnmount(() => {
  stop();
  window.removeEventListener('resize', measure);
  window.removeEventListener('keydown', nudge);
});

/**
 * The usable height of ONE sheet: what is left inside the A4 once
 * the locked header, the locked footer and the body's padding are
 * taken out. Measured, not guessed, because the masthead grows
 * with the group's name.
 *
 * The body is read straight from the page when it is there — it
 * is the real thing — and worked out by arithmetic otherwise.
 */
const BODY_PADDING = 34;   // 16 px on top, 18 at the bottom

function measure() {
  const page = sheet.value;
  if (!page) return;

  const body = page.querySelector('.np-body');
  if (body?.clientHeight) {
    usable.value = Math.max(300, body.clientHeight - BODY_PADDING);
    return;
  }

  const head = page.querySelector('.np-head')?.offsetHeight || 0;
  const foot = page.querySelector('.np-foot')?.offsetHeight || 0;
  usable.value = Math.max(300, 1123 - head - foot - BODY_PADDING);
}

async function keep() {
  busy.value = true;
  error.value = '';
  info.value = '';
  try {
    await entries.saveLayout(entry.value.id, toLayout(pieces.value));
    saved();
    info.value = 'Kept. Your page stays like this.';
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function giveBack() {
  busy.value = true;
  error.value = '';
  try {
    await entries.saveLayout(entry.value.id, null);
    router.push('/issues/' + props.id);
  } catch (e) {
    error.value = e.message;
    busy.value = false;
  }
}

/** Start again from the reading order, without saving. */
function startOver() {
  pieces.value = fitInto(
    defaultBoxes(piecesOf(entry.value, issue.value, asked.value)),
    usable.value);
  forget();
  info.value = '';
}
</script>

<template>
  <Loading v-if="loading" />

  <div v-else class="page">
    <div class="no-print">
      <RouterLink class="back-link" :to="'/issues/' + id">← The newspaper</RouterLink>
      <Notice :text="error" kind="error" />
      <Notice :text="info" kind="ok" />
    </div>

    <template v-if="entry && issue">
      <div class="newspaper" :data-render="issue.render || 'bw'" :style="newspaperStyle">

        <!-- ===== The sheet, grown so everything is in view ===== -->
        <!-- `np-fixed`: an A4 that does not grow while she works. -->
        <article class="np-page np-issue np-fixed g-free" ref="sheet"
                 @pointerdown.self="forget">
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

            <!-- ===== BODY: the canvas ===== -->
            <div class="np-body">
              <div class="np-flowbox">
                <NewspaperCanvas ref="canvas"
                                 :pieces="pieces"
                                 editing
                                 :chosen-id="chosenId"
                                 :dragging-id="draggingId"
                                 :overlapping="overlapping"
                                 :usable="usable"
                                 @grab="grab" />
              </div>
            </div>

            <!-- ===== LOCKED FOOTER ===== -->
            <div class="np-foot">
              <span>{{ footer }}</span>
              <span>Issue number {{ issue.number }}</span>
            </div>
          </div>
        </article>
      </div>

      <!-- ===== The bar ===== -->
      <div class="np-bar no-print" :class="side === 'right' ? 'np-bar-right' : 'np-bar-left'">
        <div class="np-bar-head">
          <span class="np-bar-title">My page</span>
          <button class="np-bar-side" type="button"
                  :title="side === 'right' ? 'Move the bar to the left' : 'Move the bar to the right'"
                  @click="side = side === 'right' ? 'left' : 'right'">
            {{ side === 'right' ? '←' : '→' }}
          </button>
        </div>

        <p class="np-bar-hint">
          Drag a piece where you want it. The corner handle resizes it.
          The arrow keys move it four pixels at a time, with Shift to resize.
          The red rule is the bottom of the sheet: nothing goes below it.
        </p>

        <div class="np-bar-group">
          <span class="np-bar-tag">The chosen piece</span>
          <span class="np-bar-state">
            {{ chosen ? (chosen.label || chosen.kind) : 'none — click one' }}
          </span>
          <div class="np-bar-row">
            <button class="btn outline small" type="button"
                    :disabled="!chosen" @click="scaleText(-0.1)">A−</button>
            <button class="btn outline small" type="button"
                    :disabled="!chosen" @click="scaleText(0.1)">A+</button>
          </div>
        </div>

        <div class="np-bar-group">
          <span class="np-bar-tag">The sheet</span>
          <span class="np-bar-state" :style="full ? 'color:#8c1d2f' : null">
            <template v-if="full">The A4 is full, right down to the red rule.</template>
            <template v-else>{{ roomLeft }} px left at the bottom.</template>
          </span>
          <span class="np-bar-state" v-if="overlaps" style="color:#8c1d2f">
            Two pieces are on top of each other. Allowed — just so you know.
          </span>
        </div>

        <div class="np-bar-group">
          <button class="btn small" type="button" :disabled="busy" @click="keep">
            {{ changed ? 'Keep it' : 'Kept' }}
          </button>
          <button class="np-bar-choice" type="button" @click="startOver">
            Lay it out again
          </button>
          <button class="np-bar-choice" type="button" :disabled="busy" @click="giveBack">
            Go back to the template
          </button>
        </div>
      </div>
    </template>
  </div>
</template>