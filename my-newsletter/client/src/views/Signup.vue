<!-- Creating an account. The password travels in clear inside the
     request (that is what HTTPS is for), but bcrypt hashes it on
     the server before it reaches the database: nothing is ever
     stored in clear. -->
<script setup>
import { ref, computed } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { state, signUp } from '../api/state';
import Notice from '../components/Notice.vue';

const router = useRouter();

const firstName = ref('');
const email = ref('');
const password = ref('');
const confirmation = ref('');
const error = ref('');
const busy = ref(false);

const tooShort = computed(() => password.value.length > 0 && password.value.length < 8);
const mismatch = computed(() => confirmation.value.length > 0 && confirmation.value !== password.value);

async function submit() {
  error.value = '';
  if (password.value !== confirmation.value) {
    error.value = 'The two passwords do not match.';
    return;
  }
  busy.value = true;
  try {
    await signUp({
      first_name: firstName.value, email: email.value, password: password.value
    });
    router.push('/groups');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page narrow">
    <div class="cover">
      <img class="logo" src="/logo.png" alt="">
      <span class="kicker">Private newsletter</span>
      <h1>{{ state.config?.site_name || 'My Newsletter' }}</h1>
      <p class="month">Create my account</p>
    </div>

    <div class="card">
      <h2>Welcome</h2>
      <p class="muted" style="margin:8px 0 20px">
        If a friend has already invited you, use the same address:
        you will find her groups waiting.
      </p>

      <form @submit.prevent="submit">
        <label class="field">
          <span class="label">Your first name</span>
          <input type="text" v-model="firstName" placeholder="Alex" autocomplete="given-name">
        </label>

        <label class="field">
          <span class="label">Your e-mail address</span>
          <input type="email" v-model="email" required
                 placeholder="you@example.com" autocomplete="email">
        </label>

        <label class="field">
          <span class="label">Your password</span>
          <span class="hint">Eight characters at least.</span>
          <input type="password" v-model="password" required
                 placeholder="••••••••" autocomplete="new-password">
        </label>
        <p v-if="tooShort" class="muted" style="margin:-8px 0 12px;color:#c0392b">
          {{ 8 - password.length }} more character(s).
        </p>

        <label class="field">
          <span class="label">Confirm your password</span>
          <input type="password" v-model="confirmation" required
                 placeholder="••••••••" autocomplete="new-password">
        </label>
        <p v-if="mismatch" class="muted" style="margin:-8px 0 12px;color:#c0392b">
          These two do not match.
        </p>

        <button class="btn wide" type="submit" :disabled="busy">
          {{ busy ? 'Creating…' : 'Create my account' }}
        </button>
      </form>

      <Notice :text="error" kind="error" />

      <p class="muted" style="margin-top:18px;text-align:center">
        Already have an account? <RouterLink to="/">Sign me in</RouterLink>
      </p>
    </div>
  </div>
</template>
