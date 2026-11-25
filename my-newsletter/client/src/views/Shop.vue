<!-- ============================================================
     The paper shop: order a single issue, or the "real newsprint"
     pack for a whole group.
     ============================================================ -->
<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { shop, issues, groups as apiGroups } from '../api/client';
import { euros, monthInWords, shortDate } from '../api/dates';
import Loading from '../components/Loading.vue';
import Notice from '../components/Notice.vue';
import CardPayment from '../components/CardPayment.vue';
import EmptyState from '../components/EmptyState.vue';

const loading = ref(true);
const prices = ref(null);
const published = ref([]);
const myAdminGroups = ref([]);
const orders = ref([]);
const error = ref('');
const info = ref('');
const busy = ref(false);

const tab = ref('issue');
const chosenIssue = ref('');
const copies = ref(1);
const chosenGroup = ref('');
const atPayment = ref(false);

const address = ref({ name: '', line1: '', line2: '', postcode: '', city: '', country: '' });

const currentGroup = computed(() =>
  myAdminGroups.value.find(g => g.id === chosenGroup.value));

const amount = computed(() => {
  if (!prices.value) return 0;
  if (tab.value === 'issue') {
    return Math.round(prices.value.single_issue * copies.value * 100) / 100;
  }
  const n = currentGroup.value?.member_count || 0;
  return Math.round(prices.value.group_pack * n * 100) / 100;
});

const addressComplete = computed(() =>
  ['name', 'line1', 'postcode', 'city', 'country']
    .every(f => String(address.value[f] || '').trim().length > 0));

const readyToOrder = computed(() => {
  if (!addressComplete.value) return false;
  return tab.value === 'issue' ? !!chosenIssue.value : !!chosenGroup.value;
});

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const [p, pub, mine, o] = await Promise.all([
      shop.prices(),
      issues.mine(),
      apiGroups.mine(),
      shop.myOrders()
    ]);
    prices.value = p;
    published.value = pub;
    myAdminGroups.value = mine.i_run;
    orders.value = o;
    if (pub.length) chosenIssue.value = pub[0].id;
    if (mine.i_run.length) chosenGroup.value = mine.i_run[0].id;
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}

async function pay(card) {
  error.value = ''; info.value = '';
  busy.value = true;
  try {
    if (tab.value === 'issue') {
      await shop.issue({
        issue_id: chosenIssue.value,
        copies: copies.value,
        address: address.value, card
      });
      info.value = 'Order placed. Your issue is going to the printer.';
    } else {
      await shop.groupPack({
        group_id: chosenGroup.value,
        address: address.value, card
      });
      info.value = 'Pack ordered. Everyone in the group will get theirs.';
    }
    atPayment.value = false;
    orders.value = await shop.myOrders();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

const STATUS_LABELS = {
  paid: 'Paid', preparing: 'Being prepared', shipped: 'Shipped'
};
</script>

<template>
  <Loading v-if="loading" />

  <div v-else class="page narrow">
    <RouterLink class="back-link" to="/groups">← My groups</RouterLink>

    <div class="cover">
      <img class="logo" src="/logo.png" alt="">
      <span class="kicker">Shop</span>
      <h1>On real paper</h1>
      <p class="month">A newspaper you keep, dog-ear and read again.</p>
    </div>

    <Notice :text="error" kind="error" />
    <Notice :text="info" kind="ok" />

    <div class="tabs" role="tablist">
      <button class="tab" :class="{ active: tab === 'issue' }"
              role="tab" @click="tab = 'issue'; atPayment = false">
        One issue
      </button>
      <button class="tab" :class="{ active: tab === 'pack' }"
              role="tab" @click="tab = 'pack'; atPayment = false">
        The group pack
      </button>
    </div>

    <!-- A single issue -->
    <div v-if="tab === 'issue'" class="card">
      <h3>Order an issue</h3>
      <p class="muted" style="margin:6px 0 16px">
        {{ euros(prices.single_issue) }} a copy, printed on real newsprint.
      </p>

      <EmptyState v-if="!published.length" icon="icon:newspaper-00"
            title="No published issue"
            detail="You need a published issue before you can order it." />

      <template v-else>
        <label class="field">
          <span class="label">Which issue?</span>
          <select v-model="chosenIssue">
            <option v-for="i in published" :key="i.id" :value="i.id">
              {{ i.group?.name }} — issue {{ i.number }}, {{ monthInWords(i.month) }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="label">How many copies?</span>
          <input type="number" v-model.number="copies" min="1" max="20">
        </label>
      </template>
    </div>

    <!-- The group pack -->
    <div v-else class="card">
      <h3>The group pack</h3>
      <p class="muted" style="margin:6px 0 12px">
        {{ euros(prices.group_pack) }} per person. The newspaper goes
        straight into each person's letterbox, with:
      </p>
      <ul class="role-list">
        <li v-for="(a, i) in prices.pack_contents" :key="i">
          {{ a.item }}<template v-if="a.quantity > 1"> × {{ a.quantity }}</template>
        </li>
      </ul>

      <EmptyState v-if="!myAdminGroups.length" icon="icon:flower-00"
            title="You do not run any group"
            detail="The pack commits the whole group, so it is for admins only." />

      <label v-else class="field" style="margin-top:14px">
        <span class="label">For which group?</span>
        <select v-model="chosenGroup">
          <option v-for="g in myAdminGroups" :key="g.id" :value="g.id">
            {{ g.name }} ({{ g.member_count }} people)
          </option>
        </select>
      </label>
    </div>

    <!-- The address -->
    <div class="card" style="margin-top:16px">
      <h3>Where should it go?</h3>
      <label class="field">
        <span class="label">Full name</span>
        <input type="text" v-model="address.name" autocomplete="name">
      </label>
      <label class="field">
        <span class="label">Address</span>
        <input type="text" v-model="address.line1" autocomplete="address-line1">
      </label>
      <label class="field">
        <span class="label">Second line</span>
        <input type="text" v-model="address.line2" autocomplete="address-line2">
      </label>
      <div class="row" style="gap:12px">
        <label class="field" style="flex:0 0 40%">
          <span class="label">Postcode</span>
          <input type="text" v-model="address.postcode" autocomplete="postal-code">
        </label>
        <label class="field" style="flex:1">
          <span class="label">Town</span>
          <input type="text" v-model="address.city" autocomplete="address-level2">
        </label>
      </div>
      <label class="field">
        <span class="label">Country</span>
        <input type="text" v-model="address.country" autocomplete="country-name">
      </label>
    </div>

    <!-- The total -->
    <div class="card card-send" style="margin-top:16px">
      <div class="row spread" style="font-size:1.2rem">
        <strong>Total</strong>
        <strong>{{ euros(amount) }}</strong>
      </div>
      <button v-if="!atPayment" class="btn wide" type="button" style="margin-top:14px"
              :disabled="!readyToOrder || amount <= 0" @click="atPayment = true">
        Go to payment
      </button>
      <p v-if="!addressComplete" class="muted" style="margin:10px 0 0">
        Fill in the address to carry on.
      </p>
    </div>

    <div v-if="atPayment" style="margin-top:16px">
      <CardPayment :amount="amount" :busy="busy"
                   label="Your paper order"
                   @pay="pay" @cancel="atPayment = false" />
    </div>

    <!-- My orders -->
    <template v-if="orders.length">
      <div class="divider">· · ·</div>
      <h2 class="section-title">My orders</h2>
      <div class="stack">
        <div v-for="o in orders" :key="o.id" class="card group-row">
          <div class="row spread">
            <div>
              <strong>
                {{ o.kind === 'group_pack'
                   ? (o.group?.name || 'Group') + ' pack'
                   : 'Issue ' + (o.issue?.number || '') }}
              </strong>
              <p class="muted" style="margin:2px 0 0;font-size:.85rem">
                {{ shortDate(o.created_at) }} · {{ o.copies }} copy/copies
                · {{ euros(o.amount) }}
              </p>
            </div>
            <span class="tag">{{ STATUS_LABELS[o.status] }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
