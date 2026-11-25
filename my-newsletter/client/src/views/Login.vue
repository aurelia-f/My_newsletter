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
import Notice from '../components/Notice.vue';

const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

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
