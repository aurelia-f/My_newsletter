<!-- ============================================================
     The local mailbox — a mail catcher, like MailHog.

     This site sends no real mail. Every message the server
     "sends" is stored, and read here. That keeps the whole
     forgotten-password journey intact: the code travels in a
     link, inside a mail, instead of being shown to whoever
     asked for it.

     Open on purpose, like every mail catcher: it is a
     development tool and would not be deployed on a live site.
     ============================================================ -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { mails as apiMails } from '../api/client';
import Notice from '../components/Notice.vue';
import EmptyState from '../components/EmptyState.vue';

const route = useRoute();
const router = useRouter();

const address = ref(String(route.query.email || ''));
const list = ref([]);
const open = ref(null);
const error = ref('');
const loaded = ref(false);

onMounted(() => { if (address.value) refresh(); });

async function refresh() {
  error.value = '';
  const email = address.value.trim().toLowerCase();
  if (!email) return;
  try {
    list.value = await apiMails.inbox(email);
    loaded.value = true;
    if (route.query.email !== email) {
      router.replace({ name: 'mailbox', query: { email } });
    }
  } catch (e) { error.value = e.message; }
}

async function openMail(mail) {
  open.value = mail;
  if (!mail.read_at) {
    try { Object.assign(mail, await apiMails.read(mail.id)); }
    catch { /* reading the mail matters more than the flag */ }
  }
}

async function remove(mail) {
  try {
    await apiMails.remove(mail.id);
    if (open.value && open.value.id === mail.id) open.value = null;
    await refresh();
  } catch (e) { error.value = e.message; }
}

const when = (value) => new Date(value).toLocaleString();
</script>

<template>
  <div class="page narrow">
    <div class="cover">
      <span class="kicker">Development tool</span>
      <h1>The mailbox</h1>
      <p class="month">
        This site has no mail service. The messages it sends land here.
      </p>
    </div>

    <div class="card">
      <form class="row" style="gap:10px" @submit.prevent="refresh">
        <label class="field" style="flex:1;margin:0">
          <span class="label">Whose mailbox?</span>
          <input type="email" v-model="address" required
                 placeholder="you@example.com">
        </label>
        <button class="btn" type="submit">Open it</button>
      </form>
    </div>

    <Notice :text="error" kind="error" />

    <EmptyState v-if="loaded && !list.length"
          icon="icon:newspaper-00"
          title="Nothing here"
          detail="No message has been sent to that address yet." />

    <div v-if="list.length" class="stack" style="margin-top:16px">
      <div v-for="m in list" :key="m.id" class="card group-row">
        <div class="row spread">
          <div style="min-width:0">
            <strong>{{ m.subject }}</strong>
            <span v-if="!m.read_at" class="tag" style="margin-left:8px">New</span>
            <p class="muted" style="margin:2px 0 0;font-size:.85rem">
              to {{ m.to_email }} · {{ when(m.created_at) }}
            </p>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn small outline" type="button" @click="openMail(m)">
              Read
            </button>
            <button class="btn small outline" type="button" @click="remove(m)">
              Delete
            </button>
          </div>
        </div>

        <div v-if="open && open.id === m.id" style="margin-top:14px">
          <p style="white-space:pre-line">{{ m.body }}</p>
          <p v-if="m.link" style="margin-top:14px">
            <RouterLink class="btn small" :to="m.link">Follow the link</RouterLink>
          </p>
        </div>
      </div>
    </div>

    <p class="muted" style="text-align:center;margin-top:20px">
      <RouterLink to="/">Back to the sign-in page</RouterLink>
    </p>
  </div>
</template>