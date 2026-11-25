<!-- A group's icon: an image if it is one, the emoji otherwise. -->
<script setup>
import { computed } from 'vue';
import { isIcon, iconPath } from '../api/icons';

const props = defineProps({
  value: { type: String, default: '' },
  large: { type: Boolean, default: false }
});

const path = computed(() => isIcon(props.value) ? iconPath(props.value) : null);
const text = computed(() => (props.value || '🎀').replace(/[<>&"]/g, ''));
</script>

<template>
  <img v-if="path" class="group-icon" :class="{ large }" :src="path" alt="" loading="lazy">
  <span v-else class="group-icon text" :class="{ large }">{{ text }}</span>
</template>
