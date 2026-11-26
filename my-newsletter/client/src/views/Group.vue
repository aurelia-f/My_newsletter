<!-- One group: its issues, its members, its administration. -->
<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { groups as apiGroups, issues } from '../api/client';
import { monthInWords, recentMonths } from '../api/dates';
import GroupIcon from '../components/GroupIcon.vue';
import Loading from '../components/Loading.vue';
import Notice from '../components/Notice.vue';
import EmptyState from '../components/EmptyState.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();

const loading = ref(true);
const group = ref(null);
const error = ref('');
const info = ref('');

const inviteEmail = ref('');
const inviteName = ref('');
const monthToOpen = ref(recentMonths(3)[0]);

const pendingDeletions = ref([]);
const deletionFor = (id) => pendingDeletions.value.find(d => d.issue_id === id);

const iAmAdmin = computed(() => group.value?.my_role === 'admin');
const freeMonths = computed(() => {
  const taken = new Set((group.value?.issues || []).map(i => i.month?.slice(0, 10)));
  return recentMonths(3).filter(m => !taken.has(m));
});

onMounted(load);

async function load() {
  loading.value = true;
  try {
    group.value = await apiGroups.one(props.id);
    pendingDeletions.value = await issues.pendingDeletions(props.id);
    if (freeMonths.value.length) monthToOpen.value = freeMonths.value[0];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function act(action, success) {
  error.value = ''; info.value = '';
  try { await action(); info.value = success; await load(); }
  catch (e) { error.value = e.message; }
}

const invite = () => act(
  () => apiGroups.invite(props.id, { email: inviteEmail.value, first_name: inviteName.value }),
  'Invitation saved.').then(() => { inviteEmail.value = ''; inviteName.value = ''; });

const openIssue = () => act(
  () => issues.create({ group_id: props.id, month: monthToOpen.value }),
  'Issue opened.');

const publish = (id) => act(() => issues.publish(id), 'Issue published.');

function deleteIssue(id, label) {
  if (!confirm(`Delete the ${label} issue and every page in it? This cannot be undone.`)) return;
  act(() => issues.remove(id), 'Issue deleted.');
}

function askDeletion(id, label) {
  if (!confirm(`Ask the group to delete the ${label} issue? Everybody has to agree.`)) return;
  act(() => issues.askDeletion(id), 'The group has been asked.');
}

const agreeDeletion  = (id) => act(() => issues.agreeDeletion(id), 'Your answer is saved.');
const cancelDeletion = (id) => act(() => issues.cancelDeletion(id), 'Request called off.');

const changeRole = (m, role) => act(
  () => apiGroups.changeRole(props.id, m, role), 'Role changed.');

function removeMember(m, name) {
  if (!confirm(`Remove ${name} from the group?`)) return;
  act(() => apiGroups.removeMember(props.id, m), 'Member removed.');
}

async function deleteGroup() {
  if (!confirm('Delete this group and all its issues? This cannot be undone.')) return;
  try {
    await apiGroups.remove(props.id);
    router.push('/groups');
  } catch (e) { error.value = e.message; }
}
</script>

<template>
  <Loading v-if="loading" />

  <div v-else-if="group" class="page">
    <RouterLink class="back-link" to="/groups">All my groups</RouterLink>

    <!-- Somebody wants an issue gone: everybody has to agree -->
    <div v-for="d in pendingDeletions" :key="d.issue_id"
         class="card card-danger" style="margin-bottom:14px">
      <h3 style="margin:0 0 6px">
        {{ d.asked_by_me ? 'You want' : d.asked_by + ' wants' }}
        to delete the {{ monthInWords(d.month) }} newspaper. Do you agree?
      </h3>
      <p class="muted" style="margin:0 0 12px">
        {{ d.agreed }} of {{ d.needed }} have agreed so far.
        The issue only goes once everybody has.
      </p>
      <div class="row" style="gap:8px">
        <button v-if="!d.i_agreed" class="btn small" type="button"
                @click="agreeDeletion(d.issue_id)">I agree</button>
        <span v-else class="tag">You agreed</span>
        <button v-if="d.asked_by_me || iAmAdmin" class="btn small outline" type="button"
                @click="cancelDeletion(d.issue_id)">Call it off</button>
      </div>
    </div>

    <div class="cover" :style="group.color ? { '--group': group.color } : {}">
      <span class="emoji"><GroupIcon :value="group.icon" large /></span>
      <h1>{{ group.name }}</h1>
      <p class="month">
        {{ group.members.length }} {{ group.members.length > 1 ? 'people' : 'person' }}
        · {{ group.issues.length }} issue{{ group.issues.length > 1 ? 's' : '' }}
      </p>
    </div>

    <Notice :text="error" kind="error" />
    <Notice :text="info" kind="ok" />

    <!-- The issues -->
    <h2 class="section-title">The issues</h2>

    <EmptyState v-if="!group.issues.length"
          icon="icon:newspaper-00"
          title="No issues yet"
          detail="Open the first one, then fill in this month's questionnaire." />

    <div v-else class="stack">
      <div v-for="i in group.issues" :key="i.id" class="card group-row">
        <div class="row spread">
          <div>
            <span class="eyebrow">Issue {{ i.number }}</span>
            <h3 style="margin:2px 0">{{ monthInWords(i.month) }}</h3>
            <p class="muted" style="margin:0">
              {{ i.status === 'published' ? 'Published' : 'Open — being filled in' }}
            </p>
          </div>
          <div class="row" style="gap:8px">
            <RouterLink v-if="i.status === 'published'" class="btn small" :to="'/issues/' + i.id">
              Read
            </RouterLink>
            <RouterLink v-else class="btn small outline" :to="'/write/' + i.month.slice(0, 10)">
              Answer
            </RouterLink>
                        <button v-if="iAmAdmin && i.status !== 'published'"
                    class="btn small" type="button" @click="publish(i.id)">
              Publish
            </button>
            <button v-if="iAmAdmin" class="btn small outline" type="button"
                    @click="deleteIssue(i.id, monthInWords(i.month))">
              Delete
            </button>
            <button v-else-if="!deletionFor(i.id)" class="btn small outline" type="button"
                    @click="askDeletion(i.id, monthInWords(i.month))">
              Ask to delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Opening an issue: any member may do this -->
    <div v-if="freeMonths.length" class="card card-open" style="margin-top:18px">
      <h3>Open an issue</h3>
      <p class="muted" style="margin:6px 0 14px">
        Anyone in the group can open the month's questionnaire.
        Nobody has to wait for anybody.
      </p>
      <div class="row" style="gap:10px">
        <label class="field" style="flex:1;margin:0">
          <span class="label">Which month</span>
          <select v-model="monthToOpen">
            <option v-for="m in freeMonths" :key="m" :value="m">{{ monthInWords(m) }}</option>
          </select>
        </label>
        <button class="btn" type="button" @click="openIssue">Open</button>
      </div>
    </div>

    <div class="divider">· · ·</div>

    <!-- The members -->
    <h2 class="section-title">The friends</h2>

    <div class="stack">
      <div v-for="m in group.members" :key="m.id" class="card member-row">
        <div class="row spread">
          <div class="row" style="gap:12px">
            <span class="badge">
              <img v-if="m.account?.avatar_url" :src="m.account.avatar_url" alt="">
              <template v-else>{{ (m.first_name || m.email).charAt(0).toUpperCase() }}</template>
            </span>
            <div>
              <strong>{{ m.first_name || m.email.split('@')[0] }}</strong>
              <p class="muted" style="margin:0;font-size:.85rem">
                {{ m.email }}
                <span v-if="!m.account_id"> · invitation pending</span>
              </p>
            </div>
          </div>

          <div class="row" style="gap:8px">
            <span v-if="m.account_id === group.created_by" class="tag">Creator</span>
            <span v-else-if="m.role === 'admin'" class="tag">Co-admin</span>

            <template v-if="iAmAdmin && m.account_id !== group.created_by">
              <button v-if="m.role !== 'admin'" class="btn small outline" type="button"
                      @click="changeRole(m.id, 'admin')">Make co-admin</button>
              <button v-else class="btn small outline" type="button"
                      @click="changeRole(m.id, 'member')">Remove the role</button>
              <button class="btn small outline" type="button"
                      @click="removeMember(m.id, m.first_name || m.email)">Remove</button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Inviting -->
    <div v-if="iAmAdmin" class="card" style="margin-top:18px">
      <h3>Invite a friend</h3>
      <p class="muted" style="margin:6px 0 16px">
        She does not have to create anything yet: her invitation will wait,
        and attach itself to her account on its own.
      </p>
      <form @submit.prevent="invite">
        <label class="field">
          <span class="label">Her first name</span>
          <input type="text" v-model="inviteName" placeholder="Lea">
        </label>
        <label class="field">
          <span class="label">Her e-mail address</span>
          <input type="email" v-model="inviteEmail" required placeholder="lea@example.com">
        </label>
        <button class="btn" type="submit">Send the invitation</button>
      </form>
    </div>

    <!-- Danger zone -->
    <div v-if="group.i_am_the_creator" class="card card-danger" style="margin-top:18px">
      <h3>Delete the group</h3>
      <p class="muted" style="margin:6px 0 14px">
        Every issue and every page goes with it. This cannot be undone.
      </p>
      <button class="btn outline" type="button" @click="deleteGroup">
        Delete "{{ group.name }}"
      </button>
    </div>
  </div>
</template>
