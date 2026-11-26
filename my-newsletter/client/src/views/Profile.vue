<!-- My profile card: what appears under my name in the newspaper. -->
<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { profiles, auth } from '../api/client';
import { state } from '../api/state';
import Loading from '../components/Loading.vue';
import Notice from '../components/Notice.vue';

const loading = ref(true);
const card = ref({});
const error = ref('');
const info = ref('');
const uploading = ref(false);

const current = ref('');
const next = ref('');
const passwordInfo = ref('');
const passwordError = ref('');

const newEmail = ref('');
const emailPassword = ref('');
const emailSentTo = ref('');
const emailInfo = ref('');
const emailError = ref('');

async function askEmailChange() {
  emailError.value = ''; emailInfo.value = ''; emailSentTo.value = '';
  try {
    const answer = await auth.changeEmail({
      new_email: newEmail.value, password: emailPassword.value
    });
    emailSentTo.value = answer.sent_to;
    emailInfo.value = 'Sent. Open that mailbox and follow the link.';
    emailPassword.value = '';
  } catch (e) { emailError.value = e.message; }
}

const FIELDS = [
  { key: 'first_name', label: 'My first name', hint: 'This is what appears in the newspaper.' },
  { key: 'occupation', label: 'What I do',     hint: 'Job, studies, a project. Appears under your name.' },
  { key: 'motto',      label: 'My phrase of the moment', hint: 'It runs as a pull quote on your page.' },
  { key: 'city',       label: 'My town' },
  { key: 'children',   label: 'My children',   hint: 'For example: two, aged 4 and 7.' },
  { key: 'pets',       label: 'My pets',       hint: 'For example: a cat, Plume.' }
];

onMounted(async () => {
  try {
    card.value = await profiles.me();
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
});

async function save() {
  error.value = ''; info.value = '';
  try {
    const updated = await profiles.updateMe(card.value);
    card.value = updated;
    state.account = updated;
    info.value = 'Profile saved.';
  } catch (e) { error.value = e.message; }
}

async function choosePhoto(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  uploading.value = true;
  error.value = '';
  try {
    const { url } = await profiles.uploadMedia(file);
    card.value.avatar_url = url;
    const updated = await profiles.updateMe({ avatar_url: url });
    state.account = updated;
    info.value = 'Photo updated.';
  } catch (err) { error.value = err.message; }
  finally { uploading.value = false; }
}

async function changePassword() {
  passwordError.value = ''; passwordInfo.value = '';
  try {
    await auth.password({ current: current.value, next: next.value });
    passwordInfo.value = 'Password changed.';
    current.value = ''; next.value = '';
  } catch (e) { passwordError.value = e.message; }
}
</script>

<template>
  <Loading v-if="loading" />

  <div v-else class="page narrow">
    <h1>My profile</h1>
    <p class="muted" style="margin:4px 0 22px">
      All of it is optional. What you do and your phrase of the moment
      appear under your name in the newspaper; the rest stays on your card.
    </p>

    <Notice :text="error" kind="error" />
    <Notice :text="info" kind="ok" />

    <div class="card">
      <div class="avatar-block row" style="gap:16px;align-items:center">
        <span class="badge" style="width:64px;height:64px;font-size:1.6rem">
          <img v-if="card.avatar_url" :src="card.avatar_url" alt="">
          <template v-else>{{ (card.first_name || card.email || '?').charAt(0).toUpperCase() }}</template>
        </span>
        <label class="btn outline small" style="cursor:pointer">
          {{ uploading ? 'Uploading…' : 'Change my photo' }}
          <input type="file" accept="image/*" hidden @change="choosePhoto">
        </label>
      </div>
    </div>

    <form class="card" style="margin-top:16px" @submit.prevent="save">
      <label v-for="f in FIELDS" :key="f.key" class="field">
        <span class="label">{{ f.label }}</span>
        <span v-if="f.hint" class="hint">{{ f.hint }}</span>
        <input type="text" v-model="card[f.key]">
      </label>

      <label class="field">
        <span class="label">My birthday</span>
        <span class="hint">Used by the "birthdays this month" page.</span>
        <input type="date" v-model="card.birthday">
      </label>

      <label class="field">
        <span class="label">Something few people know about me</span>
        <textarea v-model="card.fun_fact" rows="2"></textarea>
      </label>

      <label class="field">
        <span class="label">A couple of free words</span>
        <textarea v-model="card.bio" rows="3"></textarea>
      </label>

      <button class="btn" type="submit">Save my profile</button>
    </form>

    <div class="card" style="margin-top:16px">
      <h3>Change my password</h3>
      <Notice :text="passwordError" kind="error" />
      <Notice :text="passwordInfo" kind="ok" />
      <form @submit.prevent="changePassword">
        <label class="field">
          <span class="label">My current password</span>
          <input type="password" v-model="current" required autocomplete="current-password">
        </label>
        <label class="field">
          <span class="label">The new one</span>
          <span class="hint">Eight characters at least.</span>
          <input type="password" v-model="next" required autocomplete="new-password">
        </label>
                <button class="btn outline" type="submit">Change it</button>
      </form>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Change my e-mail address</h3>
            <p class="muted" style="margin:6px 0 14px">
        Your password, then a message goes to the new address with a link to
        confirm. Your groups follow you: you stay exactly where you are.
      </p>

      <Notice :text="emailError" kind="error" />
      <Notice :text="emailInfo" kind="ok" />

      <form @submit.prevent="askEmailChange">
        <label class="field">
          <span class="label">My new address</span>
          <input type="email" v-model="newEmail" required placeholder="me@example.com">
        </label>
        <label class="field">
          <span class="label">My password</span>
          <input type="password" v-model="emailPassword" required
                 autocomplete="current-password">
        </label>
        <button class="btn outline" type="submit">Send the link</button>
      </form>

      <p v-if="emailSentTo" style="margin-top:14px">
        <RouterLink class="btn small" :to="{ name: 'mailbox', query: { email: emailSentTo } }">
          Open that mailbox
        </RouterLink>
      </p>
    </div>
  </div>
</template>
