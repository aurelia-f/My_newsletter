<!-- ============================================================
     The root component (the course: "App.vue content").
     It holds the header, shared by every page, and lets Vue
     Router put the right view underneath.
     ============================================================ -->
<script setup>
import { computed } from 'vue';
import { useRouter, RouterLink, RouterView } from 'vue-router';
import { state, signOut } from './api/state';
import Loading from './components/Loading.vue';

const router = useRouter();

const signedIn = computed(() => !!state.account);
const isSiteAdmin = computed(() => state.account?.site_role === 'admin');
const initial = computed(() => {
  const base = state.account?.first_name || state.account?.email || '?';
  return base.trim().charAt(0).toUpperCase();
});

async function leave() {
  await signOut();
  router.push({ name: 'login' });
}
</script>

<template>
  <header class="site-header">
    <RouterLink class="brand" :to="signedIn ? '/groups' : '/'">
      <img src="/logo.png" alt="">
      <span>{{ state.config?.site_name || 'My Newsletter' }}</span>
    </RouterLink>

    <div id="header-actions">
      <template v-if="signedIn">
        <RouterLink v-if="isSiteAdmin" class="btn outline small" to="/admin">Admin</RouterLink>
        <RouterLink class="btn outline small" to="/plans">Plans</RouterLink>
        <RouterLink class="profile-link" to="/profile"
                    :title="state.account.first_name || 'My profile'">
          <!-- The photo ALWAYS lives inside a badge: that is what
               crops it to a circle. An image dropped bare into the
               header would show at its natural size. -->
          <span class="badge tiny">
            <img v-if="state.account.avatar_url" :src="state.account.avatar_url" alt="">
            <template v-else>{{ initial }}</template>
          </span>
          <span class="header-name">{{ state.account.first_name || 'My profile' }}</span>
        </RouterLink>
        <button class="btn outline small" type="button" @click="leave">Sign out</button>
      </template>
    </div>
  </header>

  <main id="view">
    <Loading v-if="!state.ready" />
    <RouterView v-else />
  </main>
</template>
