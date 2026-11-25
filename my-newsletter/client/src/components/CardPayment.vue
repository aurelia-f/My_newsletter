<!-- ============================================================
     The card payment form.

     ⚠️ Payment is SIMULATED: no bank is contacted, no money is
     taken. We say so plainly on screen rather than pretending.

     Card that works   : 4242 4242 4242 4242
     Card that declines: 4000 0000 0000 0002
     ============================================================ -->
<script setup>
import { ref, computed } from 'vue';
import { euros } from '../api/dates';

const props = defineProps({
  amount: { type: Number, required: true },
  label: { type: String, default: 'Payment' },
  busy: { type: Boolean, default: false }
});
const emit = defineEmits(['pay', 'cancel']);

const number = ref('4242 4242 4242 4242');
const expiry = ref('12/28');
const cvc = ref('123');
const name = ref('');

const readyToPay = computed(() =>
  number.value.replace(/\s/g, '').length >= 13 &&
  /^\d{2}\/\d{2}$/.test(expiry.value) &&
  /^\d{3,4}$/.test(cvc.value));

function formatNumber(e) {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 19);
  number.value = digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(e) {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
  expiry.value = digits.length > 2
    ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
}

function submit() {
  emit('pay', {
    number: number.value.replace(/\s/g, ''),
    expiry: expiry.value,
    cvc: cvc.value,
    name: name.value
  });
}
</script>

<template>
  <form class="card" @submit.prevent="submit">
    <h3>{{ label }}</h3>
    <p class="muted" style="margin:6px 0 4px">
      Amount: <strong>{{ euros(amount) }}</strong>
    </p>

    <div class="message" style="margin:12px 0">
      Demonstration payment — no card is actually charged.
      Test card: <code>4242 4242 4242 4242</code>.
      To see a decline: <code>4000 0000 0000 0002</code>.
    </div>

    <label class="field">
      <span class="label">Name on the card</span>
      <input type="text" v-model="name" placeholder="A. Martin" autocomplete="cc-name">
    </label>

    <label class="field">
      <span class="label">Card number</span>
      <input type="text" :value="number" @input="formatNumber"
             inputmode="numeric" placeholder="4242 4242 4242 4242" autocomplete="cc-number">
    </label>

    <div class="row" style="gap:12px">
      <label class="field" style="flex:1">
        <span class="label">Expiry</span>
        <input type="text" :value="expiry" @input="formatExpiry"
               inputmode="numeric" placeholder="MM/YY" autocomplete="cc-exp">
      </label>
      <label class="field" style="flex:1">
        <span class="label">Security code</span>
        <input type="text" v-model="cvc" inputmode="numeric" maxlength="4"
               placeholder="123" autocomplete="cc-csc">
      </label>
    </div>

    <div class="row" style="gap:10px;margin-top:8px">
      <button class="btn" type="submit" :disabled="!readyToPay || busy">
        {{ busy ? 'Paying…' : `Pay ${euros(amount)}` }}
      </button>
      <button class="btn outline" type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
