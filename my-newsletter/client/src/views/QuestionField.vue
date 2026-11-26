<!-- ============================================================
     One question, whatever its type.

     Pulled out of Questionnaire.vue when the form was split into
     "for everybody" and one section per group: the same markup was
     needed in three places, and three copies drift apart.

     The draft object is passed in and written to directly. The
     answers are keyed by question key, so a question common to
     several groups is answered ONCE and travels to each of them.
     ============================================================ -->
<script setup>
import { state } from '../api/state';

const props = defineProps({
  question: { type: Object, required: true },
  draft:    { type: Object, required: true },
  media:    { type: Array, default: () => [] }
});

const emit = defineEmits(['add-photos', 'remove-media']);

const valueOf = () => props.draft[props.question.key];
const setValue = (v) => { props.draft[props.question.key] = v; };

function toggleMulti(choice) {
  const current = Array.isArray(valueOf()) ? [...valueOf()] : [];
  const i = current.indexOf(choice);
  if (i >= 0) current.splice(i, 1); else current.push(choice);
  setValue(current);
}

function toggleEmoji(emoji) {
  const current = Array.isArray(valueOf()) ? [...valueOf()] : [];
  const i = current.indexOf(emoji);
  if (i >= 0) current.splice(i, 1);
  else if (current.length < 3) current.push(emoji);   // three, no more
  setValue(current);
}
</script>

<template>
  <div class="card section-card">
    <h3 class="section-question">{{ question.label }}</h3>
    <p v-if="question.hint" class="hint">{{ question.hint }}</p>

    <p v-if="question.perGroup || question.onlyIn" class="row"
       style="gap:6px;flex-wrap:wrap;margin:6px 0 10px">
      <span v-if="question.perGroup" class="tag">Drawn for this group</span>
      <span v-if="question.onlyIn" class="tag">Only in: {{ question.onlyIn }}</span>
    </p>

    <!-- one line -->
    <input v-if="question.type === 'short'" type="text"
           :value="valueOf()" @input="setValue($event.target.value)">

    <!-- a paragraph -->
    <textarea v-else-if="question.type === 'long'" rows="4"
              :value="valueOf()" @input="setValue($event.target.value)"></textarea>

    <!-- a single word -->
    <input v-else-if="question.type === 'word'" type="text" class="one-word" maxlength="24"
           :value="valueOf()" @input="setValue($event.target.value.split(' ')[0])">

    <!-- one answer only -->
    <div v-else-if="question.type === 'choice'" class="pills">
      <button v-for="c in question.choices" :key="c" type="button"
              class="choice-pill" :class="{ active: valueOf() === c }"
              @click="setValue(valueOf() === c ? null : c)">{{ c }}</button>
    </div>

    <!-- several answers -->
    <div v-else-if="question.type === 'multi'" class="pills">
      <button v-for="c in question.choices" :key="c" type="button"
              class="choice-pill"
              :class="{ active: (valueOf() || []).includes(c) }"
              @click="toggleMulti(c)">{{ c }}</button>
    </div>

    <!-- 0 to 10 -->
    <div v-else-if="question.type === 'slider'" class="slider">
      <input type="range" :min="question.min ?? 0" :max="question.max ?? 10"
             :value="valueOf() ?? 5"
             @input="setValue(Number($event.target.value))">
      <div class="row spread">
        <span class="muted">{{ question.lowLabel }}</span>
        <span class="slider-value">{{ valueOf() ?? 5 }}</span>
        <span class="muted">{{ question.highLabel }}</span>
      </div>
    </div>

    <!-- five stars -->
    <div v-else-if="question.type === 'rating'" class="stars">
      <button v-for="n in 5" :key="n" type="button" class="star"
              :class="{ active: (valueOf() || 0) >= n }"
              @click="setValue(valueOf() === n ? 0 : n)">★</button>
    </div>

    <!-- up to three emojis -->
    <div v-else-if="question.type === 'emojis'">
      <p class="emoji-counter muted">
        {{ (valueOf() || []).length }} / 3 — {{ (valueOf() || []).join(' ') }}
      </p>
      <div class="emoji-palette">
        <button v-for="e in (state.config?.emoji_palette || [])" :key="e"
                type="button" class="emoji-chip"
                :class="{ chosen: (valueOf() || []).includes(e) }"
                @click="toggleEmoji(e)">{{ e }}</button>
      </div>
    </div>

    <!-- title + link -->
    <template v-else-if="question.type === 'music'">
      <input type="text" placeholder="Title and artist"
             :value="valueOf()" @input="setValue($event.target.value)">
      <input type="url" placeholder="Spotify or YouTube link" style="margin-top:8px"
             :value="draft[question.key + '_link']"
             @input="draft[question.key + '_link'] = $event.target.value">
    </template>

    <!-- photos and videos -->
    <template v-else-if="question.type === 'photos'">
      <label class="dropzone">
        <strong>Choose photos or videos</strong>
        <p class="muted">They will appear on your page this month.</p>
        <input type="file" accept="image/*,video/mp4" multiple
               @change="emit('add-photos', $event)">
      </label>
      <div v-if="media.length" class="thumbs">
        <div v-for="(m, i) in media" :key="i" class="thumb">
          <video v-if="m.type === 'video'" :src="m.url"></video>
          <img v-else :src="m.url" alt="">
          <button type="button" class="remove-link"
                  @click="emit('remove-media', i)">×</button>
        </div>
      </div>
    </template>

    <input v-else type="text" :value="valueOf()" @input="setValue($event.target.value)">
  </div>
</template>

<style scoped>
/* style.css styles ".dropzone" on a div. Here it is a label, which
   is inline by default: without this its 26px of padding spills
   over the hint text instead of pushing the layout. */
.dropzone { display: block; }
.dropzone p { margin: 4px 0 0; }
</style>
