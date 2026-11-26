<!-- ============================================================
     The page a mailed link lands on.

     One page for both journeys: the server is asked what the
     token is for, and the right form is shown. The token stays
     in the URL and is only spent when the password or the
     address really changes.
     ============================================================ -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { auth } from '../api/client';
import { state } from '../api/state';
import Loading from '../components/Loading.vue';
import Notice from '../components/Notice.vue';

const props = defineProps({ token: { type: String, required: true } });
const router = useRouter();

const loading = ref(true);
const purpose = ref('');
const newEmail = ref('');
const password = ref('');
const error = ref('');
const info = ref('');

onMounted(async () => {
  try {
    const answer = await auth.inspectToken(props.token);
    purpose.value = answer.purpose;
    newEmail.value = answer.new_email || '';
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
});

async function setPassword() {
  error.value = ''; info.value = '';
  try {
    await auth.reset({ token: props.token, password: password.value });
    info.value = 'Password changed. Taking you to the sign-in page…';
    setTimeout(() => router.push({ name: 'login' }), 1200);
  } catch (e) { error.value = e.message; }
}

async function confirmAddress() {
  error.value = ''; info.value = '';
  try {
    const updated = await auth.confirmEmail({ token: props.token });
    state.account = updated;
    info.value = 'Address confirmed. Taking you to your profile…';
    setTimeout(() => router.push({ name: 'profile' }), 1200);
  } catch (e) { error.value = e.message; }
}
</script>

<template>
  <Loading v-if="loading" />

  <div v-else class="page narrow">
    <Notice :text="error" kind="error" />
    <Notice :text="info" kind="ok" />

    <!-- A forgotten password -->
    <div v-if="purpose === 'password_reset'" class="card">
      <h2>Choose a new password</h2>
      <p class="muted" style="margin:8px 0 20px">
        This link works once. Pick your password and you are back in.
      </p>
      <form @submit.prevent="setPassword">
        <label class="field">
          <span class="label">My new password</span>
          <span class="hint">Eight characters at least.</span>
          <input type="password" v-model="password" required
                 autocomplete="new-password">
        </label>
        <button class="btn wide" type="submit">Set it</button>
      </form>
    </div>

    <!-- A change of address -->
    <div v-else-if="purpose === 'email_change'" class="card">
      <h2>Confirm your new address</h2>
      <p class="muted" style="margin:8px 0 20px">
        From now on you would sign in with <strong>{{ newEmail }}</strong>.
        Your groups follow you.
      </p>

      <template v-if="state.account">
        <button class="btn wide" type="button" @click="confirmAddress">
          Yes, this is my address
        </button>
      </template>
      <p v-else class="muted">
        Sign in first with your old address, then open this link again.
        <RouterLink to="/">Sign in</RouterLink>
      </p>
    </div>

    <div v-else class="card">
      <h2>This link leads nowhere</h2>
      <p class="muted" style="margin:8px 0 0">
        It has been used already, or it is out of date. Ask for a new one
        from the sign-in page.
      </p>
      <p style="margin-top:16px">
        <RouterLink class="btn small" to="/">Back to the sign-in page</RouterLink>
      </p>
    </div>
  </div>
</template>