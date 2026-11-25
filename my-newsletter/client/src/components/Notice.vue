<!-- A short banner: ok, error, or neutral. -->
<script setup>
defineProps({
  kind: { type: String, default: 'error' },
  text: { type: String, default: '' }
});
</script>

<template>
  <div v-if="text" class="message" :class="kind">{{ text }}</div>
</template>
