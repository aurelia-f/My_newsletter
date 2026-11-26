<!-- ============================================================
     Sign-in page.

     Change from the Supabase version: there is no more "magic
     link" by e-mail. The course asks for home-made authentication
     — a password hashed with bcrypt and a cookie session — so you
     type a password.
     ============================================================ -->
<script setup>
import { ref } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { state, signIn } from '../api/state';
import { auth } from '../api/client';
import Notice from '../components/Notice.vue';

const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

const forgotOpen = ref(false);
const forgotEmail = ref('');
const forgotInfo = ref('');
const forgotError = ref('');
const sentTo = ref('');

async function askMail() {
  forgotError.value = ''; forgotInfo.value = ''; sentTo.value = '';
  try {
    const answer = await auth.forgot({ email: forgotEmail.value });
    sentTo.value = answer.sent_to || '';
    forgotInfo.value = answer.sent_to
      ? 'Sent. Open the mailbox and follow the link in the message.'
      : 'If that address has an account, a message has been sent to it.';
  } catch (e) { forgotError.value = e.message; }
}


async function submit() {
  error.value = '';
  busy.value = true;
  try {
    await signIn({ email: email.value, password: password.value });
    router.push(route.query.next || '/groups');
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
      <p class="month">{{ state.config?.tagline || 'News from our lives, once a month.' }}</p>
    </div>

    <div class="card">
      <h2>Sign in</h2>
      <p class="muted" style="margin:8px 0 20px">
        Your address and your password, and you are home.
      </p>

      <form @submit.prevent="submit">
        <label class="field">
          <span class="label">Your e-mail address</span>
          <input type="email" v-model="email" required
                 placeholder="you@example.com" autocomplete="email">
        </label>

        <label class="field">
          <span class="label">Your password</span>
          <input type="password" v-model="password" required
                 placeholder="••••••••" autocomplete="current-password">
        </label>

        <button class="btn wide" type="submit" :disabled="busy">
          {{ busy ? 'Signing in…' : 'Sign me in' }}
        </button>
      </form>

      <Notice :text="error" kind="error" />

      <p class="muted" style="margin-top:14px;text-align:center">
        <a href="#" @click.prevent="forgotOpen = !forgotOpen">
          I have forgotten my password
        </a>
      </p>

      <div v-if="forgotOpen" class="card" style="margin-top:12px">
        <h3 style="margin:0 0 6px">A new password</h3>
        <p class="muted" style="margin:0 0 14px">
          Your address, and a message is sent to it with a link. The link
          works once and lasts fifteen minutes.
        </p>

        <Notice :text="forgotError" kind="error" />
        <Notice :text="forgotInfo" kind="ok" />

        <form @submit.prevent="askMail">
          <label class="field">
            <span class="label">Your e-mail address</span>
            <input type="email" v-model="forgotEmail" required
                   placeholder="you@example.com">
          </label>
          <button class="btn small outline" type="submit">Send me the link</button>
        </form>

        <p v-if="sentTo" style="margin-top:14px">
          <RouterLink class="btn small" :to="{ name: 'mailbox', query: { email: sentTo } }">
            Open the mailbox
          </RouterLink>
        </p>
      </div>

      <p class="muted" style="margin-top:18px;text-align:center">
        No account yet?
        <RouterLink to="/signup">Create mine</RouterLink>
      </p>
    </div>

    <p class="muted" style="text-align:center;margin-top:20px">
      <RouterLink to="/plans">See the plans</RouterLink>
    </p>
  </div>
</template>
