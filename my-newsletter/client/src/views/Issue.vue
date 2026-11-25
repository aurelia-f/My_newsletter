<!-- ============================================================
     A published issue: the newspaper, one sheet per person, the
     reactions, the choice of rendering, and printing to PDF.
     ============================================================ -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { issues, questions as apiQuestions } from '../api/client';
import { state } from '../api/state';
import { monthInWords } from '../api/dates';
import Newspaper from '../components/Newspaper.vue';
import Loading from '../components/Loading.vue';
import Notice from '../components/Notice.vue';
import Advert from '../components/Advert.vue';

const props = defineProps({ id: { type: String, required: true } });

const loading = ref(true);
const issue = ref(null);
const asked = ref([]);
const error = ref('');
const info = ref('');

// Splitting into sheets: a heavily filled page becomes two.
// Measured after rendering, then applied by rendering several
// copies of the sheet, each shifted further up.
const MAX_SHEETS = 6;
const split = ref([]);   // [{ sheets, usable }] per page

const RENDERINGS = [
  { code: 'bw',    name: 'Black and white' },
  { code: 'duo',   name: 'One colour' },
  { code: 'color', name: 'Full colour' }
];

const iAmAdmin = computed(() => issue.value?.my_role === 'admin');
const pages = computed(() => issue.value?.entries || []);

// The footer: the group's first names, locked.
const footer = computed(() =>
  pages.value.map(e => e.author?.first_name || 'A friend').join(' · '));

const issueWithFooter = computed(() =>
  issue.value ? { ...issue.value, footer: footer.value } : null);

/**
 * In duotone the photos are hue-rotated towards the chosen colour.
 * The stylesheet reads --np-rotation; we work it out from the hex.
 */
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

// The rendering is carried by a data attribute, not a class:
// that is what the stylesheet looks at.
const newspaperStyle = computed(() => {
  const color = issue.value?.color;
  if (!color) return null;
  return { '--np-accent': color, '--np-rotation': hueRotation(color) + 'deg' };
});

function myReaction(entryId) {
  return (issue.value?.reactions || [])
    .find(r => r.entry_id === entryId && r.account_id === state.account?.id);
}

function reactionsFor(entryId) {
  return (issue.value?.reactions || []).filter(r => r.entry_id === entryId);
}

onMounted(load);

async function load() {
  loading.value = true;
  try {
    issue.value = await issues.one(props.id);
    asked.value = await apiQuestions.forIssue(props.id).catch(() => []);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }

  await measureSheets();

  // Images change the height when they arrive: measure again.
  document.querySelectorAll('.np-page img').forEach(img => {
    if (!img.complete) img.addEventListener('load', measureSoon, { once: true });
  });
  document.fonts?.ready.then(measureSoon);
  window.addEventListener('resize', measureSoon);
  window.addEventListener('beforeprint', measureSheets);
}

/**
 * Measures each sheet and works out how many are needed.
 * Nothing is shrunk or cut: what overflows goes onto the next
 * sheet, with the same header and footer.
 */
async function measureSheets() {
  await nextTick();

  const firsts = document.querySelectorAll('.np-page[data-sheet="1"]');
  const measures = [];

  firsts.forEach(page => {
    const body = page.querySelector(':scope > .np-fit > .np-body');
    const flow = body?.querySelector(':scope > .np-flowbox');
    if (!body || !flow) { measures.push({ sheets: 1, usable: 0 }); return; }

    const usable = body.clientHeight;

    // The end-of-sheet marks are not content: without this
    // precaution each one would lengthen the page and manufacture
    // one more empty sheet.
    const marks = [...flow.querySelectorAll(':scope > .np-sheet-end')];
    marks.forEach(m => { m.style.display = 'none'; });
    const needed = flow.scrollHeight;
    marks.forEach(m => m.style.removeProperty('display'));

    const sheets = usable > 0
      ? Math.min(MAX_SHEETS, Math.max(1, Math.ceil((needed - 2) / usable)))
      : 1;

    measures.push({ sheets, usable });
  });

  // Only write if something changed, or we loop on rendering.
  if (JSON.stringify(measures) !== JSON.stringify(split.value)) {
    split.value = measures;
  }
}

function sheetsOf(i) { return split.value[i]?.sheets || 1; }
function usableOf(i) { return split.value[i]?.usable || 0; }

let measureTimer = null;
function measureSoon() {
  clearTimeout(measureTimer);
  measureTimer = setTimeout(measureSheets, 150);
}

onBeforeUnmount(() => {
  clearTimeout(measureTimer);
  window.removeEventListener('resize', measureSoon);
  window.removeEventListener('beforeprint', measureSheets);
});

async function chooseRendering(code) {
  error.value = '';
  try {
    await issues.render(props.id, { render: code, color: issue.value?.color });
    await load();
  } catch (e) { error.value = e.message; }
}

async function react(entryId, emoji) {
  error.value = '';
  try {
    const current = myReaction(entryId);
    if (current && current.emoji === emoji) {
      await apiQuestions.removeReaction(entryId);
    } else {
      await apiQuestions.react(entryId, { emoji });
    }
    await load();
  } catch (e) { error.value = e.message; }
}

function print() { window.print(); }
</script>

<template>
  <Loading v-if="loading" />

  <div v-else-if="issue" class="page np-issue">
    <div class="no-print">
      <RouterLink class="back-link" to="/issues">← My newspapers</RouterLink>

      <div class="row spread" style="align-items:flex-end;margin-bottom:18px">
        <div>
          <span class="eyebrow">{{ issue.group?.name }}</span>
          <h1 style="margin:4px 0 0">
            Issue {{ issue.number }} · {{ monthInWords(issue.month) }}
          </h1>
        </div>
        <div class="row" style="gap:8px">
          <RouterLink class="btn outline small" to="/shop">Order it on paper</RouterLink>
          <button class="btn small" type="button" @click="print">Save as PDF</button>
        </div>
      </div>

      <Notice :text="error" kind="error" />
      <Notice :text="info" kind="ok" />

      <!-- The issue's rendering: the first to choose decides -->
      <div class="card" style="margin-bottom:18px">
        <h3>The colour of this issue</h3>
        <p class="muted" style="margin:6px 0 12px">
          <template v-if="!issue.render">
            Nobody has chosen yet. The first to do so decides for the whole group.
          </template>
          <template v-else-if="iAmAdmin">
            Already chosen. You can change it, you are an admin.
          </template>
          <template v-else>
            Already chosen for the whole group. Only an admin can change it.
          </template>
        </p>
        <div class="pills">
          <button v-for="r in RENDERINGS" :key="r.code" type="button"
                  class="choice-pill" :class="{ active: issue.render === r.code }"
                  :disabled="issue.render && !iAmAdmin"
                  @click="chooseRendering(r.code)">{{ r.name }}</button>
        </div>
      </div>
    </div>

    <!-- ===== THE NEWSPAPER ===== -->
    <div class="newspaper" :data-render="issue.render || 'bw'" :style="newspaperStyle">

      <!-- The front page -->
      <article class="np-page np-front">
        <div class="np-fit">
          <div class="np-head">
            <div class="np-topline">
              <span>{{ monthInWords(issue.month) }}</span>
              <span class="np-brand">
                <img src="/logo-newspaper.png" alt="">{{ state.config?.site_name || 'My Newsletter' }}
              </span>
            </div>
            <div class="np-rule"></div>
            <h1 class="np-masthead np-masthead-front">{{ issue.group?.name }}</h1>
            <div class="np-rule np-double"></div>
            <div class="np-person">This month's issue</div>
            <div class="np-rule"></div>
          </div>
          <div class="np-body">
            <p class="np-standfirst np-standfirst-front">
              {{ pages.length }} page{{ pages.length > 1 ? 's' : '' }} this month.
              One each, to read in order or out of it.
            </p>
            <div class="np-portraits">
              <figure v-for="e in pages" :key="e.id" class="np-portrait">
                <img v-if="e.content?.cover_photo || e.author?.avatar_url"
                     :src="e.content?.cover_photo || e.author?.avatar_url" alt="" loading="lazy">
                <div v-else class="np-frame-empty">
                  {{ (e.author?.first_name || '?').charAt(0).toUpperCase() }}
                </div>
                <figcaption>{{ e.author?.first_name || 'A friend' }}</figcaption>
              </figure>
            </div>
            <p class="np-contents">{{ footer }}</p>
          </div>
          <div class="np-foot">
            <span>{{ footer }}</span>
            <span>Issue number {{ issue.number }}</span>
          </div>
        </div>
      </article>

      <!-- One page per person -->
      <template v-for="(e, i) in pages" :key="e.id">
        <Newspaper v-for="k in sheetsOf(i)" :key="e.id + '-' + k"
                   :entry="e" :issue="issueWithFooter" :index="i" :asked="asked"
                   :sheet="k" :sheets="sheetsOf(i)"
                   :usable="usableOf(i)" :offset="(k - 1) * usableOf(i)" />

        <!-- The reactions, not printed -->
        <div class="reactions-area no-print">
          <div class="reaction-choices">
            <button v-for="em in (state.config?.reaction_emojis || [])" :key="em"
                    type="button" class="emoji-button"
                    :class="{ active: myReaction(e.id)?.emoji === em }"
                    :disabled="e.account_id === state.account?.id"
                    @click="react(e.id, em)">{{ em }}</button>
          </div>
          <div v-if="reactionsFor(e.id).length" class="row" style="gap:8px;flex-wrap:wrap">
            <span v-for="re in reactionsFor(e.id)" :key="re.id" class="reaction">
              <span class="reaction-emoji">{{ re.emoji }}</span>
              {{ re.author?.first_name }}<template v-if="re.word"> — {{ re.word }}</template>
            </span>
          </div>
        </div>

        <!-- A full-page ad, in the middle of the newspaper -->
        <Advert v-if="i === 0 && pages.length > 1" place="paper_full_page" />
      </template>

      <Advert place="paper_footer" />
    </div>
  </div>
</template>

<style scoped>
@media print {
  .no-print { display: none !important; }
}
</style>
