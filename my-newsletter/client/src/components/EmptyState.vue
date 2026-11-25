<!-- The "there is nothing here" screen, with its icon. -->
<script setup>
import GroupIcon from './GroupIcon.vue';

defineProps({
  icon: { type: String, default: 'icon:flower-00' },
  title: { type: String, required: true },
  detail: { type: String, default: '' }
});
</script>

<template>
  <div class="empty">
    <span class="emoji"><GroupIcon :value="icon" large /></span>
    <h3>{{ title }}</h3>
    <p v-if="detail" class="muted">{{ detail }}</p>
  </div>
</template>
