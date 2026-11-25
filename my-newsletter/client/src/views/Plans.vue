<!-- ============================================================
     The plans.

     Three add-ons, stacking and discounted:
       · 1 add-on  → full price
       · 2 add-ons → −20 %
       · all 3     → the flat "Full bundle" price

     The price shown ALWAYS comes from the server: we send the
     add-ons ticked, it returns the price. The browser computes
     nothing, or anyone could subscribe for €0.
     ============================================================ -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { subscriptions } from '../api/client';
import { state, refreshSubscription } from '../api/state';
import { euros, shortDate } from '../api/dates';
import Loading from '../components/Loading.vue';
import Notice from '../components/Notice.vue';
import CardPayment from '../components/CardPayment.vue';

const loading = ref(true);
const grid = ref(null);
const mine = ref(null);
const chosen = ref([]);
const months = ref(1);
const PERIODS = [
  { n: 1,  label: '1 month',  note: '' },
  { n: 6,  label: '6 months', note: '−10 %' },
  { n: 12, label: '1 year',   note: '−20 %' }
];
const quote = ref(null);
const error = ref('');
const info = ref('');
const atPayment = ref(false);
const busy = ref(false);

const signedIn = computed(() => !!state.account);
const currentAddOns = computed(() => mine.value?.subscription?.add_ons || []);

const changed = computed(() => {
  const a = [...chosen.value].sort().join(',');
  const b = [...currentAddOns.value].sort().join(',');
  return a !== b;
});

onMounted(async () => {
  try {
    grid.value = await subscriptions.grid();
    if (signedIn.value) {
      mine.value = await subscriptions.mine();
      chosen.value = [...(mine.value.subscription?.add_ons || [])];
    }
    await recompute();
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
});

watch([chosen, months], recompute, { deep: true });

async function recompute() {
  try { quote.value = await subscriptions.quote(chosen.value, months.value); }
  catch { quote.value = null; }
}

function toggle(code) {
  const i = chosen.value.indexOf(code);
  if (i >= 0) chosen.value.splice(i, 1);
  else chosen.value.push(code);
}

async function pay(card) {
  error.value = ''; info.value = '';
  busy.value = true;
  try {
    await subscriptions.subscribe({ add_ons: chosen.value, months: months.value, card });
    await refreshSubscription();
    mine.value = await subscriptions.mine();
    atPayment.value = false;
    info.value = 'All done, your subscription is active.';
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function cancel() {
  if (!confirm('Cancel your subscription?')) return;
  try {
    await subscriptions.cancel();
    await refreshSubscription();
    mine.value = await subscriptions.mine();
    chosen.value = [];
    info.value = 'Subscription cancelled.';
  } catch (e) { error.value = e.message; }
}
</script>

<template>
  <Loading v-if="loading" />

  <div v-else class="page narrow">
    <RouterLink v-if="signedIn" class="back-link" to="/groups">← My groups</RouterLink>
    <RouterLink v-else class="back-link" to="/">← Sign in</RouterLink>

    <div class="cover">
      <img class="logo" src="/logo.png" alt="">
      <span class="kicker">Plans</span>
      <h1>Three add-ons, à la carte</h1>
      <p class="month">The more you take, the cheaper each one gets.</p>
    </div>

    <Notice :text="error" kind="error" />
    <Notice :text="info" kind="ok" />

    <!-- The current subscription -->
    <div v-if="mine?.subscription" class="card card-questionnaire">
      <span class="eyebrow">Your subscription</span>
      <h2 style="margin:2px 0 8px;font-size:1.4rem">
        {{ euros(mine.subscription.monthly_price) }} a month
        <span v-if="mine.subscription.months > 1" class="muted" style="font-size:.9rem">
          · paid {{ mine.subscription.months }} months up front
        </span>
      </h2>
      <p class="muted" style="margin:0 0 8px">
        {{ currentAddOns.length }} add-on{{ currentAddOns.length > 1 ? 's' : '' }}
        <template v-if="mine.subscription.savings > 0">
          · saving you {{ euros(mine.subscription.savings) }} a month
        </template>
      </p>
      <p v-if="mine.subscription.renews_on" class="muted" style="margin:0">
        Next payment: {{ shortDate(mine.subscription.renews_on) }}
      </p>
      <button class="btn outline small" type="button" style="margin-top:12px" @click="cancel">
        Cancel my subscription
      </button>
    </div>

    <!-- The group quota -->
    <p v-if="mine?.quota" class="muted" style="margin:16px 0">
      <template v-if="mine.quota.unlimited">
        You have unlimited groups. {{ mine.quota.used }} created so far.
      </template>
      <template v-else>
        {{ mine.quota.used }} group(s) created out of {{ mine.quota.free }} free.
      </template>
    </p>

    <!-- The add-ons -->
    <h2 class="section-title">Choose your add-ons</h2>

    <div class="stack">
      <label v-for="a in grid.add_ons" :key="a.code"
             class="card group-row" style="cursor:pointer;display:block">
        <div class="row spread" style="align-items:flex-start;gap:14px">
          <div class="row" style="gap:12px;align-items:flex-start;min-width:0">
            <input type="checkbox" :checked="chosen.includes(a.code)"
                   @change="toggle(a.code)" style="margin-top:5px">
            <div style="min-width:0">
              <strong>{{ a.name }}</strong>
              <p class="muted" style="margin:4px 0 0">{{ a.description }}</p>
            </div>
          </div>
          <span class="tag">{{ euros(a.monthly_price) }}/mo</span>
        </div>
      </label>
    </div>

        <!-- How long you pay for up front -->
    <div class="card" style="margin-top:18px">
      <h3>How long?</h3>
      <p class="muted" style="margin:6px 0 12px">
        Pay several months up front and it costs less.
      </p>
      <div class="pills">
        <button v-for="p in PERIODS" :key="p.n" type="button"
                class="choice-pill" :class="{ active: months === p.n }"
                @click="months = p.n">
          {{ p.label }}<template v-if="p.note"> · {{ p.note }}</template>
        </button>
      </div>
      <label class="field" style="margin-top:14px">
        <span class="label">Or choose your own number of months (1 to 24)</span>
        <input type="number" min="1" max="24" v-model.number="months">
      </label>
    </div> 

    <!-- The total, worked out by the server -->
    <div v-if="quote && quote.add_ons.length" class="card card-send" style="margin-top:18px">
      <h3>Your total</h3>
      <div class="stack" style="margin:12px 0">
        <div v-for="d in quote.detail" :key="d.code" class="row spread">
          <span>{{ d.name }}</span>
          <span class="muted">{{ euros(d.price_alone) }}</span>
        </div>
      </div>

      <div v-if="quote.savings > 0" class="row spread" style="margin-bottom:6px">
        <span class="muted">Bought separately</span>
        <span class="muted"><s>{{ euros(quote.full) }}</s></span>
      </div>

      <div class="row spread">
        <span class="muted">{{ quote.full_bundle ? 'Full bundle' : 'Per month' }}</span>
        <span class="muted">{{ euros(quote.price) }}/mo</span>
      </div>

      <div v-if="quote.period_discount > 0" class="row spread" style="margin-top:6px">
        <span class="muted">{{ quote.months }} months up front</span>
        <span class="muted">
          <s>{{ euros(quote.total_before_discount) }}</s>
          · −{{ Math.round(quote.period_discount * 100) }} %
        </span>
      </div>

      <div class="row spread" style="font-size:1.25rem;margin-top:8px">
        <strong>To pay now</strong>
        <strong>{{ euros(quote.total) }}</strong>
      </div>

      <p v-if="quote.period_savings > 0" class="muted" style="margin:8px 0 0">
        Paying {{ quote.months }} months at once saves you
        <strong>{{ euros(quote.period_savings) }}</strong>.
      </p>

      <p v-if="quote.savings > 0" class="muted" style="margin:8px 0 0">
        You save <strong>{{ euros(quote.savings) }}</strong> every month
        compared with buying the add-ons separately.
      </p>

      <template v-if="signedIn">
        <button v-if="!atPayment" class="btn wide" type="button" style="margin-top:16px"
                :disabled="!changed" @click="atPayment = true">
          {{ changed ? 'Go to payment' : 'That is already your subscription' }}
        </button>
      </template>
      <RouterLink v-else class="btn wide" to="/signup" style="margin-top:16px">
        Create my account to subscribe
      </RouterLink>
    </div>

    <!-- Payment -->
    <div v-if="atPayment && quote" style="margin-top:18px">
      <CardPayment :amount="quote.total" :busy="busy"
              :label="quote.months === 1
                ? 'Your monthly subscription'
                : 'Your subscription · ' + quote.months + ' months up front'"
              @pay="pay" @cancel="atPayment = false" />
    </div>

    <!-- The combinations -->
    <div class="divider">· · ·</div>
    <h2 class="section-title">The combinations</h2>
    <p class="muted" style="margin:0 0 14px">
      Two add-ons together cost 20 % less than separately.
      All three together is the flat rate, cheaper still.
    </p>

    <div class="stack">
      <div v-for="(d, i) in grid.pairs" :key="i" class="card group-row">
        <div class="row spread">
          <span>{{ d.detail.map(x => x.name).join(' + ') }}</span>
          <span>
            <s class="muted">{{ euros(d.full) }}</s>
            <strong style="margin-left:8px">{{ euros(d.price) }}</strong>
          </span>
        </div>
      </div>

      <div class="card group-row" style="border-width:2px">
        <div class="row spread">
          <span><strong>Full bundle</strong> — all three add-ons</span>
          <span>
            <s class="muted">{{ euros(grid.bundle.full) }}</s>
            <strong style="margin-left:8px">{{ euros(grid.bundle.price) }}</strong>
          </span>
        </div>
      </div>
    </div>

    <!-- Paper -->
    <div class="card" style="margin-top:18px">
      <h3>And on real paper?</h3>
      <p class="muted" style="margin:8px 0 12px">
        A single issue: <strong>{{ euros(grid.single_issue_price) }}</strong>.<br>
        The pack for a whole group, with a business card, the sticker of
        the month and two blank postcards:
        <strong>{{ euros(grid.group_pack_price) }}</strong> per person.
      </p>
      <RouterLink v-if="signedIn" class="btn outline" to="/shop">Go to the shop</RouterLink>
    </div>
  </div>
</template>
