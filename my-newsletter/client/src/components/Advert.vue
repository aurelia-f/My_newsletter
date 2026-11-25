<!-- ============================================================
     One advertising slot.

     The component asks the server for an ad for its slot. If the
     person subscribes to "no ads", the server answers null and
     nothing shows: the decision is not taken here.

     The six slots:
       home_banner           970 × 250
       groups_box            300 × 250
       questionnaire_strip   728 × 90
       paper_full_page      1240 × 1754 (A4)
       paper_footer          900 × 150
       issues_square         300 × 300
     ============================================================ -->
<script setup>
import { ref, onMounted } from 'vue';
import { ads } from '../api/client';

// The prop is called `place`, not `slot`: `slot` is a reserved
// attribute in Vue and would be swallowed by the compiler.
const props = defineProps({
  place: { type: String, required: true }
});

const ad = ref(null);

onMounted(async () => {
  try { ad.value = await ads.forSlot(props.place); } catch { ad.value = null; }
});

async function click() {
  if (!ad.value) return;
  try {
    const r = await ads.click(ad.value.id);
    if (r.link) window.open(r.link, '_blank', 'noopener');
  } catch { /* a lost click is not a problem */ }
}
</script>

<template>
  <aside v-if="ad" class="advert" :class="'advert-' + place">
    <span class="advert-label">Advertisement</span>
    <a href="#" @click.prevent="click">
      <img :src="ad.image_url" :alt="ad.title" loading="lazy">
    </a>
  </aside>
</template>

<style scoped>
/* Styles belonging to the ad server: the original style.css is
   not modified, everything is here and only here. */
.advert {
  position: relative;
  margin: 22px 0;
  text-align: center;
}
.advert img {
  max-width: 100%;
  height: auto;
  border-radius: 14px;
  display: block;
  margin: 0 auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, .06);
}
.advert-label {
  display: block;
  font-size: .62rem;
  letter-spacing: .14em;
  text-transform: uppercase;
  opacity: .45;
  margin-bottom: 5px;
}
.advert-paper_full_page img { border-radius: 0; }
.advert-paper_full_page, .advert-paper_footer { margin: 0; }

@media print {
  /* Ads on the site do not print; the ones inside the newspaper
     do: that is the whole point of paper. */
  .advert-home_banner, .advert-groups_box,
  .advert-questionnaire_strip, .advert-issues_square { display: none; }
}
</style>
