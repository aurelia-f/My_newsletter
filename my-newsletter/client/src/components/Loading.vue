<script setup>
defineProps({ message: { type: String, default: 'One moment…' } });
</script>

<template>
  <div class="loading"><div class="spin"></div>{{ message }}</div>
</template>
