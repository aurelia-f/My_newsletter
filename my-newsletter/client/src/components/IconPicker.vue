<!-- The icon board, shared by group creation and group settings.
     One definition, used in both places. -->
<script setup>
import { ICON_SETS, PREFIX } from '../api/icons';

defineProps({ modelValue: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div class="icon-board">
    <template v-for="set in ICON_SETS" :key="set.theme">
      <div class="board-title">{{ set.theme }}</div>
      <div class="board-grid">
        <button
          v-for="name in set.icons" :key="name"
          type="button" class="icon-chip"
          :class="{ chosen: modelValue === PREFIX + name }"
          @click="emit('update:modelValue', PREFIX + name)">
          <img :src="`/icons/${name}.png`" alt="" loading="lazy">
        </button>
      </div>
    </template>
  </div>
</template>
