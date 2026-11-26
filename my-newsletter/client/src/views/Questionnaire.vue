<!-- ============================================================
     The month's questionnaire.

     This is the heart of the site: you do NOT fill in one form per
     group. You fill one in once, into a private draft that saves
     itself, then you tick the groups to send it to. The server
     maps each answer onto the right question of each issue.
     ============================================================ -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { entries, issues, questions as apiQuestions, profiles, groups as apiGroups } from '../api/client';
import { state } from '../api/state';
import { monthInWords, currentMonth } from '../api/dates';
import GroupIcon from '../components/GroupIcon.vue';
import Loading from '../components/Loading.vue';
import Notice from '../components/Notice.vue';
import Advert from '../components/Advert.vue';

const props = defineProps({ month: { type: String, default: '' } });

const theMonth = computed(() => props.month || currentMonth());

const loading = ref(true);
const error = ref('');
const info = ref('');
const draft = ref({});
const media = ref([]);
const openIssues = ref([]);
const chosen = ref([]);
const asked = ref([]);
const express = ref(false);
const sending = ref(false);
const saved = ref('');

// Asking a question
const newQuestion = ref('');
const target = ref('');
const issueForQuestion = ref('');

/** The month's questions, de-duplicated across the groups. */
const monthQuestions = computed(() => {
  const seen = new Map();
  for (const issue of openIssues.value) {
    for (const q of issue.questions || []) {
      const key = keyOf(q);
      if (!seen.has(key)) {
        seen.set(key, { ...q, key, groups: [issue.group?.name].filter(Boolean) });
      } else if (issue.group?.name) {
        const already = seen.get(key);
        if (!already.groups.includes(issue.group.name)) already.groups.push(issue.group.name);
      }
    }
  }
  const all = [...seen.values()];
  // Two different things to show:
  //  · onlyIn   → this question was drawn in SOME groups only
  //  · perGroup → this question is a draw, so it differs per group
  //    (it is flagged `rotating` by questionsForMonth)
  for (const q of all) {
    q.onlyIn = q.groups.length < openIssues.value.length ? q.groups.join(', ') : null;
    q.perGroup = q.rotating === true;
  }
  return all;
});

const expressIds = computed(() => new Set(state.config?.express_ids || []));

const visibleQuestions = computed(() => {
  if (!express.value) return monthQuestions.value;
  return monthQuestions.value.filter(q => q.express === true || expressIds.value.has(q.id));
});

/** Questions aimed at me personally: always visible. */
const askedOfMe = computed(() =>
  asked.value.filter(q => !q.target_id || q.target_id === state.account?.id));

const possibleTargets = computed(() => {
  const issue = openIssues.value.find(i => i.id === issueForQuestion.value);
  return issue ? (issue.members || []) : [];
});

/** A question's key in the draft: the same from one group to the next. */
function keyOf(q) {
  if (String(q.id).startsWith('q_')) return q.id;
  return q.type + '__' + slug(q.label);
}

function slug(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '').slice(0, 60);
}

onMounted(load);
watch(() => props.month, load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [d, open, sent] = await Promise.all([
      entries.draft(theMonth.value),
      issues.open(),
      entries.sentTo(theMonth.value).catch(() => [])
    ]);
    draft.value = d.content || {};
    media.value = d.media || [];
    openIssues.value = open.filter(i => i.month?.slice(0, 10) === theMonth.value);

    // A group that ALREADY has my page is not re-ticked on its own:
    // my edits meant for another group do not go back to it without
    // me saying so.
    const already = new Set(sent.filter(s => s.sent).map(s => s.group_id));
    chosen.value = openIssues.value
      .map(i => i.group_id).filter(g => !already.has(g));

    if (openIssues.value.length) {
      issueForQuestion.value = openIssues.value[0].id;
      const batches = await Promise.all(
        openIssues.value.map(i => apiQuestions.forIssue(i.id).catch(() => [])));
      asked.value = batches.flat();
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

// --- Saved automatically, two seconds after you stop typing ---
let timer = null;
watch([draft, media], () => {
  if (loading.value) return;
  clearTimeout(timer);
  saved.value = '…';
  timer = setTimeout(async () => {
    try {
      await entries.saveDraft(theMonth.value,
        { content: draft.value, media: media.value });
      saved.value = 'Saved';
      setTimeout(() => { saved.value = ''; }, 2500);
    } catch { saved.value = ''; }
  }, 2000);
}, { deep: true });

function valueOf(q) { return draft.value[q.key]; }
function setValue(q, v) { draft.value[q.key] = v; }

function toggleMulti(q, choice) {
  const currentValue = Array.isArray(draft.value[q.key]) ? [...draft.value[q.key]] : [];
  const i = currentValue.indexOf(choice);
  if (i >= 0) currentValue.splice(i, 1); else currentValue.push(choice);
  draft.value[q.key] = currentValue;
}

function toggleEmoji(q, emoji) {
  const currentValue = Array.isArray(draft.value[q.key]) ? [...draft.value[q.key]] : [];
  const i = currentValue.indexOf(emoji);
  if (i >= 0) currentValue.splice(i, 1);
  else if (currentValue.length < 3) currentValue.push(emoji);   // three, no more
  draft.value[q.key] = currentValue;
}

async function addPhotos(e) {
  const files = [...(e.target.files || [])];
  error.value = '';
  for (const f of files) {
    try {
      const m = await profiles.uploadMedia(f);
      media.value = [...media.value, m];
    } catch (err) { error.value = err.message; }
  }
  e.target.value = '';
}

function removeMedia(i) {
  media.value = media.value.filter((_, j) => j !== i);
}

async function send() {
  error.value = ''; info.value = '';
  sending.value = true;
  try {
    clearTimeout(timer);
    await entries.saveDraft(theMonth.value,
      { content: draft.value, media: media.value });
    const r = await entries.send({ month: theMonth.value, groups: chosen.value });
    const ok = r.results.filter(x => x.ok).length;
    const failed = r.results.filter(x => !x.ok);
    info.value = `Your page has gone to ${ok} group${ok > 1 ? 's' : ''}.`
      + (failed.length ? ` (${failed.map(x => x.reason).join(' ')})` : '');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    sending.value = false;
  }
}

async function openForThisMonth() {
  error.value = '';
  try {
    const mine = await apiGroups.mine();
    const all = [...mine.i_run, ...mine.i_take_part];
    for (const g of all) {
      await issues.create({ group_id: g.id, month: theMonth.value }).catch(() => {});
    }
    await load();
  } catch (e) { error.value = e.message; }
}

async function askQuestion() {
  error.value = '';
  try {
    await apiQuestions.ask({
      issue_id: issueForQuestion.value,
      text: newQuestion.value,
      target_id: target.value || null
    });
    newQuestion.value = ''; target.value = '';
    info.value = "Your question is now part of this month's questionnaire.";
    await load();
  } catch (e) { error.value = e.message; }
}
</script>

<template>
  <Loading v-if="loading" />

  <div v-else class="page narrow">
    <RouterLink class="back-link" to="/groups">← My groups</RouterLink>

    <div class="row spread" style="align-items:flex-end">
      <div>
        <span class="eyebrow">The questionnaire</span>
        <h1 style="margin:4px 0 0">{{ monthInWords(theMonth) }}</h1>
      </div>
      <span class="muted" style="font-size:.85rem">{{ saved }}</span>
    </div>

    <Notice :text="error" kind="error" />
    <Notice :text="info" kind="ok" />

    <!-- No issue open this month -->
    <div v-if="!openIssues.length" class="card card-open" style="margin-top:20px">
      <h3>No issue open for {{ monthInWords(theMonth) }}</h3>
      <p class="muted" style="margin:8px 0 14px">
        Anyone can open it, group admin or not.
      </p>
      <button class="btn" type="button" @click="openForThisMonth">
        Open this month in my groups
      </button>
    </div>

    <template v-else>
      <div class="row spread" style="margin:18px 0">
        <p class="muted" style="margin:0">
          Fill it in once, for {{ openIssues.length }} group{{ openIssues.length > 1 ? 's' : '' }}.
        </p>
        <button class="btn outline small" type="button" @click="express = !express">
          {{ express ? 'The whole questionnaire' : '5-minute mode' }}
        </button>
      </div>

      <Advert place="questionnaire_strip" />

      <!-- The questions -->
      <div v-for="q in visibleQuestions" :key="q.key" class="card section-card">
        <h3 class="section-question">{{ q.label }}</h3>
        <p v-if="q.hint" class="hint">{{ q.hint }}</p>
                <p v-if="q.perGroup || q.onlyIn" class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0 10px">
          <span v-if="q.perGroup" class="tag">Drawn for this group</span>
          <span v-if="q.onlyIn" class="tag">Only in: {{ q.onlyIn }}</span>
        </p>

        <!-- one line -->
        <input v-if="q.type === 'short'" type="text"
               :value="valueOf(q)" @input="setValue(q, $event.target.value)">

        <!-- a paragraph -->
        <textarea v-else-if="q.type === 'long'" rows="4"
                  :value="valueOf(q)" @input="setValue(q, $event.target.value)"></textarea>

        <!-- a single word -->
        <input v-else-if="q.type === 'word'" type="text" class="one-word" maxlength="24"
               :value="valueOf(q)" @input="setValue(q, $event.target.value.split(' ')[0])">

        <!-- one answer only -->
        <div v-else-if="q.type === 'choice'" class="pills">
          <button v-for="c in q.choices" :key="c" type="button"
                  class="choice-pill" :class="{ active: valueOf(q) === c }"
                  @click="setValue(q, valueOf(q) === c ? null : c)">{{ c }}</button>
        </div>

        <!-- several answers -->
        <div v-else-if="q.type === 'multi'" class="pills">
          <button v-for="c in q.choices" :key="c" type="button"
                  class="choice-pill"
                  :class="{ active: (valueOf(q) || []).includes(c) }"
                  @click="toggleMulti(q, c)">{{ c }}</button>
        </div>

        <!-- 0 to 10 -->
        <div v-else-if="q.type === 'slider'" class="slider">
          <input type="range" :min="q.min ?? 0" :max="q.max ?? 10"
                 :value="valueOf(q) ?? 5"
                 @input="setValue(q, Number($event.target.value))">
          <div class="row spread">
            <span class="muted">{{ q.lowLabel }}</span>
            <span class="slider-value">{{ valueOf(q) ?? 5 }}</span>
            <span class="muted">{{ q.highLabel }}</span>
          </div>
        </div>

        <!-- five stars -->
        <div v-else-if="q.type === 'rating'" class="stars">
          <button v-for="n in 5" :key="n" type="button" class="star"
                  :class="{ active: (valueOf(q) || 0) >= n }"
                  @click="setValue(q, valueOf(q) === n ? 0 : n)">★</button>
        </div>

        <!-- up to three emojis -->
        <div v-else-if="q.type === 'emojis'">
          <p class="emoji-counter muted">
            {{ (valueOf(q) || []).length }} / 3 — {{ (valueOf(q) || []).join(' ') }}
          </p>
          <div class="emoji-palette">
            <button v-for="e in (state.config?.emoji_palette || [])" :key="e"
                    type="button" class="emoji-chip"
                    :class="{ chosen: (valueOf(q) || []).includes(e) }"
                    @click="toggleEmoji(q, e)">{{ e }}</button>
          </div>
        </div>

        <!-- title + link -->
        <template v-else-if="q.type === 'music'">
          <input type="text" placeholder="Title and artist"
                 :value="valueOf(q)" @input="setValue(q, $event.target.value)">
          <input type="url" placeholder="Spotify or YouTube link" style="margin-top:8px"
                 :value="draft[q.key + '_link']"
                 @input="draft[q.key + '_link'] = $event.target.value">
        </template>

        <!-- photos and videos -->
        <template v-else-if="q.type === 'photos'">
          <label class="dropzone">
            <strong>Choose photos or videos</strong>
            <p class="muted">They will appear on your page this month.</p>
            <input type="file" accept="image/*,video/mp4" multiple @change="addPhotos">
          </label>
          <div v-if="media.length" class="thumbs">
            <div v-for="(m, i) in media" :key="i" class="thumb">
              <video v-if="m.type === 'video'" :src="m.url"></video>
              <img v-else :src="m.url" alt="">
              <button type="button" class="remove-link" @click="removeMedia(i)">×</button>
            </div>
          </div>
        </template>

        <input v-else type="text" :value="valueOf(q)" @input="setValue(q, $event.target.value)">
      </div>

      <!-- The questions from friends -->
      <template v-if="askedOfMe.length">
        <h2 class="section-title">Your friends are asking</h2>
        <div v-for="q in askedOfMe" :key="q.id" class="card section-card asked-question">
          <h3 class="section-question">{{ q.text }}</h3>
          <p class="hint">
            From {{ q.author?.first_name || 'a friend' }}
            {{ q.target_id ? '· for you' : '· to the group' }}
          </p>
          <textarea rows="3" :value="draft['q_' + q.id]"
                    @input="draft['q_' + q.id] = $event.target.value"></textarea>
        </div>
      </template>

      <!-- Asking a question -->
      <div class="card" style="margin-top:18px">
        <h3>Ask a question</h3>
        <p class="muted" style="margin:6px 0 14px">
          It joins this month's questionnaire straight away, and the answer
          appears in the issue.
        </p>
        <form @submit.prevent="askQuestion">
          <label class="field">
            <span class="label">Which group?</span>
            <select v-model="issueForQuestion">
              <option v-for="i in openIssues" :key="i.id" :value="i.id">{{ i.group?.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="label">Who for?</span>
            <select v-model="target">
              <option value="">The whole group</option>
              <option v-for="m in possibleTargets" :key="m.account_id" :value="m.account_id">
                {{ m.first_name }}
              </option>
            </select>
          </label>
          <label class="field">
            <span class="label">Your question</span>
            <input type="text" v-model="newQuestion" maxlength="300"
                   placeholder="So, how did the move go?">
          </label>
          <button class="btn outline" type="submit">Ask it</button>
        </form>
      </div>

      <!-- Sending -->
      <div class="card card-send" style="margin-top:22px">
        <h3>Send my page</h3>
        <p class="muted" style="margin:6px 0 14px">
          Tick the groups that get this page. You can leave some out and
          come back later: everything is kept.
        </p>

        <label v-for="i in openIssues" :key="i.id" class="group-row row"
               style="gap:10px;align-items:center;cursor:pointer">
          <input type="checkbox" :value="i.group_id" v-model="chosen">
          <GroupIcon :value="i.group?.icon" />
          <span>{{ i.group?.name }}</span>
          <span v-if="i.already_sent" class="tag">already sent</span>
        </label>

        <button class="btn wide" type="button" style="margin-top:16px"
                :disabled="!chosen.length || sending" @click="send">
          {{ sending ? 'Sending…' : `Send to ${chosen.length} group${chosen.length > 1 ? 's' : ''}` }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* style.css styles ".dropzone" on a div. Here it is a label, which
   is inline by default: without this its 26px of padding spills
   over the hint text instead of pushing the layout. The shared
   stylesheet is left alone. */
.dropzone { display: block; }
.dropzone p { margin: 4px 0 0; }
</style>