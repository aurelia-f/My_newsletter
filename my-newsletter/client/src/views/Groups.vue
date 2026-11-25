<!-- ============================================================
     "Your groups": two tabs (I run / I take part), the card for
     this month's questionnaire, and creating a group.
     ============================================================ -->
<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { groups as apiGroups, issues, entries } from '../api/client';
import { state } from '../api/state';
import { monthInWords, currentMonth } from '../api/dates';
import GroupIcon from '../components/GroupIcon.vue';
import IconPicker from '../components/IconPicker.vue';
import Loading from '../components/Loading.vue';
import Notice from '../components/Notice.vue';
import EmptyState from '../components/EmptyState.vue';
import Advert from '../components/Advert.vue';

const router = useRouter();

const loading = ref(true);
const error = ref('');
const iRun = ref([]);
const iTakePart = ref([]);
const openIssues = ref([]);
const sent = ref([]);
const tab = ref('admin');

// Creating a group
const newName = ref('');
const newIcon = ref('icon:flower-00');
const creating = ref(false);
const createError = ref('');
const quotaReached = ref(false);

const openMonths = computed(() =>
  [...new Set(openIssues.value.map(i => i.month?.slice(0, 10)))].sort().reverse());
const thisMonth = computed(() => openMonths.value[0] || null);

const forThisMonth = computed(() =>
  openIssues.value.filter(i => i.month?.slice(0, 10) === thisMonth.value));
const done = computed(() => forThisMonth.value.filter(i => i.already_sent).length);
const total = computed(() => forThisMonth.value.length);
const allDone = computed(() => total.value > 0 && done.value === total.value);

const sendState = computed(() => {
  if (allDone.value) {
    return `Your page has gone to ${total.value === 1 ? 'your group' : 'all ' + total.value + ' of your groups'}.`;
  }
  if (done.value) return `Already sent to ${done.value} of ${total.value} groups.`;
  return 'Fill it in once, then choose who gets it.';
});

const otherMonths = computed(() => openMonths.value.filter(m => m !== thisMonth.value));

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const [mine, open] = await Promise.all([apiGroups.mine(), issues.open()]);
    iRun.value = mine.i_run;
    iTakePart.value = mine.i_take_part;
    openIssues.value = open;
    tab.value = iRun.value.length ? 'admin' : 'member';
    if (thisMonth.value) sent.value = await entries.sentTo(thisMonth.value);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function createGroup() {
  createError.value = '';
  quotaReached.value = false;
  creating.value = true;
  try {
    const g = await apiGroups.create({ name: newName.value, icon: newIcon.value });
    router.push('/groups/' + g.id);
  } catch (e) {
    createError.value = e.message;
    if (e.status === 402) quotaReached.value = true;
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <Loading v-if="loading" />

  <div v-else class="page">
    <Notice :text="error" kind="error" />

    <div class="row spread" style="align-items:flex-end;margin-bottom:22px">
      <div>
        <span class="eyebrow">Hello {{ state.account?.first_name || '' }}</span>
        <h1 style="margin:4px 0 0">Your groups</h1>
      </div>
      <RouterLink class="btn outline small" to="/issues">
        <GroupIcon value="icon:newspaper-00" /> My newspapers
      </RouterLink>
    </div>

    <Advert place="home_banner" />

    <!-- The questionnaire card: the way into the month -->
    <div v-if="!thisMonth" class="card card-questionnaire">
      <div class="row spread" style="gap:18px">
        <div style="min-width:0">
          <span class="eyebrow">This month's questionnaire</span>
          <h2 style="margin:2px 0 6px;font-size:1.6rem">{{ monthInWords(currentMonth()) }}</h2>
          <p class="muted" style="margin:0">
            Not open yet. You can open it for your groups, even the ones
            you do not run.
          </p>
        </div>
        <RouterLink class="btn" :to="'/write/' + currentMonth()">Open it</RouterLink>
      </div>
    </div>

    <template v-else>
      <div class="card card-questionnaire">
        <div class="row spread" style="gap:18px">
          <div style="min-width:0">
            <span class="eyebrow">This month's questionnaire</span>
            <h2 style="margin:2px 0 6px;font-size:1.6rem">{{ monthInWords(thisMonth) }}</h2>
            <p class="muted" style="margin:0">{{ sendState }}</p>
          </div>
          <RouterLink class="btn" :to="'/write/' + thisMonth">
            {{ allDone ? 'Edit my page' : (done ? 'Carry on' : 'Fill it in') }}
          </RouterLink>
        </div>
        <div v-if="total > 1" class="gauge" style="margin-top:18px">
          <div class="gauge-fill" :style="{ width: Math.round((done / total) * 100) + '%' }"></div>
        </div>
      </div>

      <p v-if="otherMonths.length" class="muted" style="margin:-8px 0 22px">
        Still open:
        <template v-for="(m, i) in otherMonths" :key="m">
          <RouterLink :to="'/write/' + m">{{ monthInWords(m) }}</RouterLink
          ><span v-if="i < otherMonths.length - 1">, </span>
        </template>.
      </p>
    </template>

    <!-- The tabs -->
    <div v-if="iRun.length && iTakePart.length" class="tabs" role="tablist">
      <button class="tab" :class="{ active: tab === 'admin' }"
              role="tab" @click="tab = 'admin'">
        I run <span class="counter">{{ iRun.length }}</span>
      </button>
      <button class="tab" :class="{ active: tab === 'member' }"
              role="tab" @click="tab = 'member'">
        I take part <span class="counter">{{ iTakePart.length }}</span>
      </button>
    </div>

    <EmptyState v-if="!iRun.length && !iTakePart.length"
          icon="icon:flower-00"
          title="No groups yet"
          detail="Create your first one below, then invite your friends by e-mail." />

    <!-- Panel: I run -->
    <section v-if="iRun.length" class="panel" :class="{ hidden: tab !== 'admin' }">
      <details class="card card-role disclosure">
        <summary>
          <span><strong>You are an admin</strong> · what that means</span>
          <span class="arrow">▾</span>
        </summary>
        <div class="disclosure-body">
          <p class="muted" style="margin-bottom:14px">
            In these groups you are the editor in chief. In practice:
          </p>
          <ul class="role-list">
            <li><strong>Invite your friends</strong> by e-mail, and remove them.</li>
            <li><strong>Open the month's issue.</strong> Without that, nobody can answer.</li>
            <li><strong>Publish</strong> when you think there are enough entries: the whole group can read it then.</li>
            <li><strong>Name a co-admin</strong> to help you chase people and publish.</li>
            <li>And like everyone else, <strong>answer the questionnaire</strong>.</li>
          </ul>
          <p class="muted" style="margin-top:14px">
            The rhythm that works: open the issue on the 1st, remind people
            around the 20th, publish on the 1st of the following month.
          </p>
        </div>
      </details>

      <div class="grid">
        <RouterLink v-for="g in iRun" :key="g.id"
                    class="card card-group clickable"
                    style="text-decoration:none;display:block"
                    :style="g.color ? { '--group': g.color } : {}"
                    :to="'/groups/' + g.id">
          <span class="emoji"><GroupIcon :value="g.icon" large /></span>
          <h3>
            <span class="group-dot" :style="g.color ? { background: g.color } : {}"></span>
            {{ g.name }}
          </h3>
          <p class="muted">
            {{ g.created_by === state.account?.id ? 'You created this group' : 'You run this group' }}
            · {{ g.member_count }} {{ g.member_count > 1 ? 'people' : 'person' }}
          </p>
        </RouterLink>
      </div>
    </section>

    <!-- Panel: I take part -->
    <section v-if="iTakePart.length" class="panel" :class="{ hidden: tab !== 'member' }">
      <details class="card card-role disclosure">
        <summary>
          <span><strong>You are a member</strong> · what that means</span>
          <span class="arrow">▾</span>
        </summary>
        <div class="disclosure-body">
          <p class="muted">
            A friend runs these groups. You answer the questionnaire each month
            and read the issues as soon as they are published. Nothing else to do.
          </p>
        </div>
      </details>

      <div class="grid">
        <RouterLink v-for="g in iTakePart" :key="g.id"
                    class="card card-group clickable"
                    style="text-decoration:none;display:block"
                    :style="g.color ? { '--group': g.color } : {}"
                    :to="'/groups/' + g.id">
          <span class="emoji"><GroupIcon :value="g.icon" large /></span>
          <h3>
            <span class="group-dot" :style="g.color ? { background: g.color } : {}"></span>
            {{ g.name }}
          </h3>
          <p class="muted">Member · {{ g.member_count }} {{ g.member_count > 1 ? 'people' : 'person' }}</p>
        </RouterLink>
      </div>
    </section>

    <Advert place="groups_box" />

    <div class="divider">· · ·</div>

    <!-- Creating a group -->
    <div class="card">
      <h3>Create a new group</h3>
      <p class="muted" style="margin:6px 0 16px">
        One group per set of friends. They only ever see their own.
        You will be its admin.
      </p>

      <p v-if="state.subscription.quota && !state.subscription.quota.unlimited"
         class="muted" style="margin:-6px 0 16px">
        You have <strong>{{ state.subscription.quota.left }}</strong> free
        group(s) left out of {{ state.subscription.quota.free }}.
      </p>

      <form @submit.prevent="createGroup">
        <label class="field">
          <span class="label">Its name</span>
          <input type="text" v-model="newName" required placeholder="The school friends">
        </label>

        <div class="field">
          <span class="label">Its icon</span>
          <span class="hint">This is what shows next to the name everywhere.</span>
          <div class="row" style="margin:8px 0 10px">
            <span class="preview-icon"><GroupIcon :value="newIcon" large /></span>
          </div>
          <IconPicker v-model="newIcon" />
        </div>

        <button class="btn" type="submit" :disabled="creating">
          {{ creating ? 'Creating…' : 'Create the group' }}
        </button>
      </form>

      <Notice v-if="!quotaReached" :text="createError" kind="error" />

      <!-- Quota reached: offer the subscription -->
      <div v-if="quotaReached" class="card card-open" style="margin-top:16px">
        <h3>You have used your free groups</h3>
        <p class="muted" style="margin:8px 0 14px">
          The first {{ state.subscription.quota?.free || 3 }} groups are free.
          To create as many as you like, you need the
          "Unlimited groups" add-on.
        </p>
        <RouterLink class="btn" to="/plans">See the plans</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* style.css only styles "label.field > .label". The icon picker is
   not a label (it contains buttons), so we restate the same rules
   here rather than editing the shared stylesheet. */
.field > .label {
  display: block;
  font-family: var(--serif);
  font-size: 1.06rem;
  font-weight: 600;
  color: var(--raspberry);
  margin-bottom: 4px;
}
.field > .hint {
  display: block;
  font-size: .85rem;
  color: var(--ink-soft);
  margin-bottom: 9px;
}
</style>
