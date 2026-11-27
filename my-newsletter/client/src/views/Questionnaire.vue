<!-- ============================================================
     The month's questionnaire, arranged by group.

     You still fill it in ONCE, into a private draft that saves
     itself. What changed is the shape of the form:

       1. the questions common to all your groups, once;
       2. then one section per group, headed by its name and its
          icon, holding the questions drawn for that group alone;
       3. at the end, one page per group, each going only to the
          group it belongs to.

     The answers are keyed by question, not by group, so a common
     question is answered once and travels to every page. The
     server maps each answer onto the right question of each issue.
     ============================================================ -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { entries, issues, questions as apiQuestions, profiles, groups as apiGroups } from '../api/client';
import { state } from '../api/state';
import { monthInWords, currentMonth } from '../api/dates';
import GroupIcon from '../components/GroupIcon.vue';
import QuestionField from '../components/QuestionField.vue';
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
const router = useRouter();
const saved = ref('');

// Asking a question
const newQuestion = ref('');
const target = ref('');
const issueForQuestion = ref('');

const expressIds = computed(() => new Set(state.config?.express_ids || []));

/**
 * Every question of the month, with the groups it belongs to and
 * how many of them. Built once and read by the two lists below.
 */
const index = computed(() => {
  const byKey = new Map();
  for (const issue of openIssues.value) {
    for (const q of issue.questions || []) {
      const key = keyOf(q);
      if (!byKey.has(key)) {
        byKey.set(key, { ...q, key, groups: [], count: 0 });
      }
      const entry = byKey.get(key);
      entry.count += 1;
      if (issue.group?.name && !entry.groups.includes(issue.group.name)) {
        entry.groups.push(issue.group.name);
      }
    }
  }
  for (const q of byKey.values()) {
    // onlyIn   → drawn in some groups only
    // perGroup → a draw, so it differs from one group to the next
    q.onlyIn = q.groups.length < openIssues.value.length ? q.groups.join(', ') : null;
    q.perGroup = q.rotating === true;
  }
  return byKey;
});

/** The fixed sections, the season, the feast: asked everywhere. */
const commonQuestions = computed(() => {
  const n = openIssues.value.length;
  if (!n) return [];
  return [...index.value.values()]
    .filter(q => q.count === n && q.rotating !== true);
});

const commonKeys = computed(() => new Set(commonQuestions.value.map(q => q.key)));

/**
 * One section per group: everything that is NOT common, in the
 * order the issue gives it. A question drawn in two groups shows
 * up in both sections and shares a single answer — it is the same
 * question, so it deserves the same answer.
 */
const groupSections = computed(() =>
  openIssues.value.map(issue => ({
    issue,
    questions: (issue.questions || [])
      .map(q => index.value.get(keyOf(q)))
      .filter(q => q && !commonKeys.value.has(q.key))
  })));

const keep = (list) => express.value
  ? list.filter(q => q.express === true || expressIds.value.has(q.id))
  : list;

const commonVisible = computed(() => keep(commonQuestions.value));

const sectionsVisible = computed(() =>
  groupSections.value
    .map(s => ({ ...s, questions: keep(s.questions) }))
    .filter(s => s.questions.length || askedIn(s.issue).length));

/** Questions aimed at me personally: always visible. */
const askedOfMe = computed(() =>
  asked.value.filter(q => !q.target_id || q.target_id === state.account?.id));

function askedIn(issue) {
  return askedOfMe.value.filter(q => q.issue_id === issue.id);
}

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
      const batches = await Promise.all(openIssues.value.map(async i => {
        const list = await apiQuestions.forIssue(i.id).catch(() => []);
        // Stamped with the issue so each question sits in its own
        // group's section rather than in one shared pile.
        return list.map(q => ({ ...q, issue_id: q.issue_id || i.id }));
      }));
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
    const done = r.results.filter(x => x.ok);
    const failed = r.results.filter(x => !x.ok);

    // Sent, and straight on to arranging the page: that is the
    // moment she wants to see it, not a line of text telling her
    // it has gone. The other groups got the same page and wait
    // under My newspapers. If nothing went through, we stay here
    // and say why.
    if (done.length) {
      router.push({ name: 'arrange', params: { id: done[0].issue_id },
                    query: { sent: done.length } });
      return;
    }

    info.value = failed.length
      ? failed.map(x => x.reason).join(' ')
      : 'Nothing was sent.';
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
          The questions everybody gets, once. Then the ones drawn for each
          of your {{ openIssues.length }} group{{ openIssues.length > 1 ? 's' : '' }}.
        </p>
        <button class="btn outline small" type="button" @click="express = !express">
          {{ express ? 'The whole questionnaire' : '5-minute mode' }}
        </button>
      </div>

      <Advert place="questionnaire_strip" />

      <!-- ===== 1. For everybody ===== -->
      <template v-if="commonVisible.length">
        <h2 class="section-title">For everybody</h2>
        <p class="muted" style="margin:0 0 14px">
          These answers go on every one of your pages, whatever the group.
        </p>

        <QuestionField v-for="q in commonVisible" :key="q.key"
                       :question="q" :draft="draft" :media="media"
                       @add-photos="addPhotos" @remove-media="removeMedia" />
      </template>

      <!-- ===== 2. One section per group ===== -->
      <template v-for="s in sectionsVisible" :key="s.issue.id">
        <h2 class="section-title row" style="gap:10px;align-items:center">
          <GroupIcon :value="s.issue.group?.icon" />
          <span>{{ s.issue.group?.name }}</span>
        </h2>
        <p class="muted" style="margin:0 0 14px">
          Drawn for this group alone. Nobody in your other groups sees
          these questions, or your answers to them.
        </p>

        <QuestionField v-for="q in s.questions" :key="q.key"
                       :question="q" :draft="draft" :media="media"
                       @add-photos="addPhotos" @remove-media="removeMedia" />

        <!-- The questions your friends in THIS group are asking -->
        <div v-for="q in askedIn(s.issue)" :key="q.id"
             class="card section-card asked-question">
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
          It joins this month's questionnaire straight away, in the section
          of the group you choose, and the answer appears in the issue.
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

      <!-- ===== 3. One page per group ===== -->
      <div class="card card-send" style="margin-top:22px">
        <h3>One page per group</h3>
        <p class="muted" style="margin:6px 0 14px">
          A separate page is made for each group you tick: the answers
          everybody gets, plus the ones drawn for that group.
          <strong>These pages are not linked to one another</strong> — each
          one goes to its own group and nowhere else. You can leave a group
          out and come back later: everything is kept.
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
          {{ sending ? 'Sending…' : `Send ${chosen.length} page${chosen.length > 1 ? 's' : ''}` }}
        </button>
      </div>
    </template>
  </div>
</template>