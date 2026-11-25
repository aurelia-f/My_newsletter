<!-- My newspapers: every published issue from all my groups. -->
<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { issues } from '../api/client';
import { monthInWords } from '../api/dates';
import GroupIcon from '../components/GroupIcon.vue';
import Loading from '../components/Loading.vue';
import EmptyState from '../components/EmptyState.vue';
import Advert from '../components/Advert.vue';

const loading = ref(true);
const list = ref([]);

onMounted(async () => {
  try { list.value = await issues.mine(); } catch { list.value = []; }
  finally { loading.value = false; }
});
</script>

<template>
  <Loading v-if="loading" />

  <div v-else class="page">
    <RouterLink class="back-link" to="/groups">← My groups</RouterLink>
    <h1>My newspapers</h1>
    <p class="muted" style="margin:4px 0 22px">
      Every published issue, from all your groups. They stay readable forever.
    </p>

    <EmptyState v-if="!list.length"
          icon="icon:newspaper-00"
          title="No published issue yet"
          detail="As soon as an issue is published, it appears here." />

    <div v-else class="grid">
      <RouterLink v-for="i in list" :key="i.id"
                  class="card card-group clickable"
                  style="text-decoration:none;display:block"
                  :to="'/issues/' + i.id">
        <span class="emoji"><GroupIcon :value="i.group?.icon" large /></span>
        <h3>{{ i.group?.name }}</h3>
        <p class="muted">
          Issue {{ i.number }} · {{ monthInWords(i.month) }}
        </p>
      </RouterLink>
    </div>

    <Advert place="issues_square" />
  </div>
</template>
