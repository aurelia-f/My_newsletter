<!-- ============================================================
     The creator area: our own dashboard.

     Access is locked twice: by the Vue Router guard (convenience)
     and, above all, by the requireSiteAdmin middleware on the
     server, which is the real security.
     ============================================================ -->
<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { admin } from '../api/client';
import { euros, shortDate } from '../api/dates';
import Loading from '../components/Loading.vue';
import Notice from '../components/Notice.vue';

const loading = ref(true);
const tab = ref('figures');
const error = ref('');
const info = ref('');

const board = ref(null);
const signups = ref([]);
const members = ref([]);
const orders = ref([]);
const adsPanel = ref({ ads: [], formats: {} });
const prices = ref({ plans: [], settings: [] });

const search = ref('');
const newAd = ref({ title: '', image_url: '', link: '', slot: 'home_banner' });

const TABS = [
  { key: 'figures', name: 'Figures' },
  { key: 'members', name: 'Members' },
  { key: 'orders',  name: 'Orders' },
  { key: 'ads',     name: 'Adverts' },
  { key: 'prices',  name: 'Prices' }
];

const STATUS_LABELS = {
  paid: 'Paid', preparing: 'Being prepared', shipped: 'Shipped'
};

const maxSignups = computed(() =>
  Math.max(1, ...signups.value.map(s => Number(s.count))));

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const [b, s, m, o, a, p] = await Promise.all([
      admin.dashboard(), admin.signups(), admin.members(),
      admin.orders(), admin.ads(), admin.prices()
    ]);
    board.value = b; signups.value = s; members.value = m;
    orders.value = o; adsPanel.value = a; prices.value = p;
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}

async function runSearch() {
  try { members.value = await admin.members(search.value); }
  catch (e) { error.value = e.message; }
}

async function changeStatus(id, status) {
  try {
    await admin.updateOrder(id, status);
    orders.value = await admin.orders();
    board.value = await admin.dashboard();
    info.value = 'Order updated.';
  } catch (e) { error.value = e.message; }
}

async function toggleAd(a) {
  try {
    await admin.updateAd(a.id, { active: !a.active });
    adsPanel.value = await admin.ads();
  } catch (e) { error.value = e.message; }
}

async function removeAd(a) {
  if (!confirm(`Delete "${a.title}"?`)) return;
  try { await admin.removeAd(a.id); adsPanel.value = await admin.ads(); }
  catch (e) { error.value = e.message; }
}

async function addAd() {
  error.value = '';
  try {
    await admin.createAd(newAd.value);
    newAd.value = { title: '', image_url: '', link: '', slot: 'home_banner' };
    adsPanel.value = await admin.ads();
    info.value = 'Advert added.';
  } catch (e) { error.value = e.message; }
}

async function savePrices() {
  error.value = ''; info.value = '';
  try {
    const settings = {};
    for (const s of prices.value.settings) settings[s.key] = s.value;
    await admin.savePrices({ plans: prices.value.plans, settings });
    info.value = 'Prices saved.';
  } catch (e) { error.value = e.message; }
}
</script>

<template>
  <Loading v-if="loading" />

  <div v-else class="page">
    <RouterLink class="back-link" to="/groups">← My groups</RouterLink>
    <h1>Creators' area</h1>
    <p class="muted" style="margin:4px 0 22px">
      Everything happening on the site, and everything it brings in.
    </p>

    <Notice :text="error" kind="error" />
    <Notice :text="info" kind="ok" />

    <div class="tabs" role="tablist">
      <button v-for="t in TABS" :key="t.key" class="tab"
              :class="{ active: tab === t.key }" role="tab" @click="tab = t.key">
        {{ t.name }}
      </button>
    </div>

    <!-- ===== FIGURES ===== -->
    <section v-if="tab === 'figures'" class="panel">
      <h2 class="section-title">The money</h2>
      <div class="grid">
        <div class="card">
          <span class="eyebrow">Monthly recurring revenue</span>
          <h3 style="font-size:1.9rem;margin:4px 0">{{ euros(board.money.mrr) }}</h3>
          <p class="muted" style="margin:0">that is {{ euros(board.money.arr) }} a year</p>
        </div>
        <div class="card">
          <span class="eyebrow">Subscribers</span>
          <h3 style="font-size:1.9rem;margin:4px 0">{{ board.money.subscribers }}</h3>
          <p class="muted" style="margin:0">{{ board.money.conversion_rate }} % of sign-ups</p>
        </div>
        <div class="card">
          <span class="eyebrow">Average basket</span>
          <h3 style="font-size:1.9rem;margin:4px 0">{{ euros(board.money.average_basket) }}</h3>
          <p class="muted" style="margin:0">{{ board.money.full_bundles }} full bundle(s)</p>
        </div>
        <div class="card">
          <span class="eyebrow">Taken in 30 days</span>
          <h3 style="font-size:1.9rem;margin:4px 0">{{ euros(board.money.taken_30d) }}</h3>
          <p class="muted" style="margin:0">{{ euros(board.money.taken_total) }} since the start</p>
        </div>
      </div>

      <h3 class="section-title">By add-on</h3>
      <div class="stack">
        <div v-for="(a, code) in board.money.per_add_on" :key="code" class="card group-row">
          <div class="row spread">
            <span>{{ a.name }} <span class="muted">— {{ euros(a.price) }}/mo</span></span>
            <strong>{{ a.subscribers }} subscriber{{ a.subscribers > 1 ? 's' : '' }}</strong>
          </div>
        </div>
      </div>

      <h2 class="section-title">The people</h2>
      <div class="grid">
        <div class="card">
          <span class="eyebrow">Signed up</span>
          <h3 style="font-size:1.9rem;margin:4px 0">{{ board.people.signups }}</h3>
          <p class="muted" style="margin:0">+{{ board.people.new30d }} in 30 days</p>
        </div>
        <div class="card">
          <span class="eyebrow">Groups</span>
          <h3 style="font-size:1.9rem;margin:4px 0">{{ board.people.groups }}</h3>
          <p class="muted" style="margin:0">{{ board.people.average_per_group }} people on average</p>
        </div>
        <div class="card">
          <span class="eyebrow">Invitations pending</span>
          <h3 style="font-size:1.9rem;margin:4px 0">{{ board.people.pending_invitations }}</h3>
          <p class="muted" style="margin:0">not signed up yet</p>
        </div>
        <div class="card">
          <span class="eyebrow">Response rate</span>
          <h3 style="font-size:1.9rem;margin:4px 0">{{ board.activity.response_rate }} %</h3>
          <p class="muted" style="margin:0">
            {{ board.activity.entries_sent }} pages out of {{ board.activity.pages_expected }}
          </p>
        </div>
      </div>

      <h2 class="section-title">Activity</h2>
      <div class="grid">
        <div class="card">
          <span class="eyebrow">Issues published</span>
          <h3 style="font-size:1.9rem;margin:4px 0">{{ board.activity.published }}</h3>
          <p class="muted" style="margin:0">{{ board.activity.open }} in progress</p>
        </div>
        <div class="card">
          <span class="eyebrow">Orders to ship</span>
          <h3 style="font-size:1.9rem;margin:4px 0">{{ board.orders.to_ship }}</h3>
          <p class="muted" style="margin:0">{{ board.orders.total }} in total</p>
        </div>
      </div>

      <!-- Sign-ups, day by day -->
      <h3 class="section-title">Sign-ups</h3>
      <div v-if="signups.length" class="card">
        <div class="row" style="gap:3px;align-items:flex-end;height:120px;overflow-x:auto">
          <div v-for="s in signups" :key="s.day"
               :title="`${s.day}: ${s.count}`"
               :style="{
                 height: Math.max(4, (Number(s.count) / maxSignups) * 110) + 'px',
                 width: '14px', flex: '0 0 14px', borderRadius: '3px 3px 0 0',
                 background: 'var(--group, #c38f8f)'
               }"></div>
        </div>
        <p class="muted" style="margin:10px 0 0">
          Over the last 90 days. Busiest day: {{ maxSignups }}.
        </p>
      </div>
      <p v-else class="muted">Not enough data yet.</p>
    </section>

    <!-- ===== MEMBERS ===== -->
    <section v-else-if="tab === 'members'" class="panel">
      <form class="row" style="gap:10px;margin-bottom:16px" @submit.prevent="runSearch">
        <input type="search" v-model="search" placeholder="First name or e-mail address"
               style="flex:1">
        <button class="btn small" type="submit">Search</button>
      </form>

      <div class="stack">
        <div v-for="m in members" :key="m.id" class="card member-row">
          <div class="row spread">
            <div>
              <strong>{{ m.first_name || m.email.split('@')[0] }}</strong>
              <span v-if="m.site_role === 'admin'" class="tag" style="margin-left:8px">
                Creator
              </span>
              <p class="muted" style="margin:2px 0 0;font-size:.85rem">
                {{ m.email }} · joined {{ shortDate(m.created_at) }}
                · {{ m.groups_created }} group(s) created
                · {{ m.memberships }} membership(s)
              </p>
            </div>
            <span v-if="m.subscription" class="tag">
              {{ euros(m.subscription.price) }}/mo
            </span>
            <span v-else class="muted">free</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== ORDERS ===== -->
    <section v-else-if="tab === 'orders'" class="panel">
      <div class="stack">
        <div v-for="o in orders" :key="o.id" class="card group-row">
          <div class="row spread" style="align-items:flex-start;gap:14px">
            <div style="min-width:0">
              <strong>
                {{ o.kind === 'group_pack'
                   ? 'Pack "' + (o.group?.name || '?') + '"'
                   : 'Issue ' + (o.issue?.number || '?') }}
              </strong>
              <p class="muted" style="margin:4px 0 0;font-size:.85rem">
                {{ o.account?.first_name }} ({{ o.account?.email }})
                · {{ shortDate(o.created_at) }}
                · {{ o.copies }} copies · {{ euros(o.amount) }}
              </p>
              <p class="muted" style="margin:6px 0 0;font-size:.85rem">
                {{ o.address?.name }}, {{ o.address?.line1 }},
                {{ o.address?.postcode }} {{ o.address?.city }}, {{ o.address?.country }}
              </p>
              <ul class="role-list" style="margin-top:8px">
                <li v-for="(a, i) in (o.pack_contents || [])" :key="i">
                  {{ a.item }}<template v-if="a.quantity > 1"> × {{ a.quantity }}</template>
                </li>
              </ul>
            </div>
            <div style="text-align:right">
              <span class="tag">{{ STATUS_LABELS[o.status] }}</span>
              <div class="row" style="gap:6px;margin-top:10px;justify-content:flex-end">
                <button v-if="o.status === 'paid'" class="btn small outline" type="button"
                        @click="changeStatus(o.id, 'preparing')">Being prepared</button>
                <button v-if="o.status !== 'shipped'" class="btn small" type="button"
                        @click="changeStatus(o.id, 'shipped')">Mark shipped</button>
              </div>
            </div>
          </div>
        </div>
        <p v-if="!orders.length" class="muted">No orders yet.</p>
      </div>
    </section>

    <!-- ===== ADVERTS ===== -->
    <section v-else-if="tab === 'ads'" class="panel">
      <p class="muted" style="margin:0 0 16px">
        Six slots. Subscribers to "No advertising" see none of them:
        the filter runs on the server.
      </p>

      <div class="stack">
        <div v-for="a in adsPanel.ads" :key="a.id" class="card group-row">
          <div class="row spread" style="align-items:flex-start;gap:14px">
            <div class="row" style="gap:12px;align-items:flex-start;min-width:0">
              <img :src="a.image_url" alt="" style="width:90px;border-radius:8px">
              <div style="min-width:0">
                <strong>{{ a.title }}</strong>
                <p class="muted" style="margin:4px 0 0;font-size:.85rem">
                  {{ a.format?.name }} — {{ a.format?.width }} × {{ a.format?.height }} px
                </p>
                <p class="muted" style="margin:4px 0 0;font-size:.85rem">
                  30 days: {{ a.month.impressions }} views, {{ a.month.clicks }} clicks
                  ({{ a.month.rate }} %) · total: {{ a.total.impressions }} views
                </p>
              </div>
            </div>
            <div style="text-align:right">
              <span class="tag">{{ a.active ? 'Live' : 'Paused' }}</span>
              <div class="row" style="gap:6px;margin-top:10px;justify-content:flex-end">
                <button class="btn small outline" type="button" @click="toggleAd(a)">
                  {{ a.active ? 'Pause' : 'Go live' }}
                </button>
                <button class="btn small outline" type="button" @click="removeAd(a)">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <h3>Add an advert</h3>
        <form @submit.prevent="addAd">
          <label class="field">
            <span class="label">Title</span>
            <input type="text" v-model="newAd.title" required>
          </label>
          <label class="field">
            <span class="label">Image address</span>
            <span class="hint">For example /ads/my-advert.png</span>
            <input type="text" v-model="newAd.image_url" required>
          </label>
          <label class="field">
            <span class="label">Link on click</span>
            <input type="url" v-model="newAd.link" placeholder="https://…">
          </label>
          <label class="field">
            <span class="label">Slot</span>
            <select v-model="newAd.slot">
              <option v-for="(f, code) in adsPanel.formats" :key="code" :value="code">
                {{ f.name }} — {{ f.width }} × {{ f.height }}
              </option>
            </select>
          </label>
          <button class="btn" type="submit">Add it</button>
        </form>
      </div>
    </section>

    <!-- ===== PRICES ===== -->
    <section v-else-if="tab === 'prices'" class="panel">
      <p class="muted" style="margin:0 0 16px">
        Prices live in the database, not in the code: you change them here.
      </p>

      <form class="card" @submit.prevent="savePrices">
        <h3>The add-ons</h3>
        <div v-for="p in prices.plans" :key="p.code" class="row"
             style="gap:12px;align-items:flex-end;margin-bottom:12px">
          <label class="field" style="flex:1;margin:0">
            <span class="label">{{ p.name }}</span>
            <input type="number" step="0.01" min="0" v-model.number="p.monthly_price">
          </label>
          <label class="row" style="gap:6px;align-items:center;padding-bottom:12px">
            <input type="checkbox" v-model="p.active"> live
          </label>
        </div>

        <h3 style="margin-top:20px">The settings</h3>
        <label v-for="s in prices.settings" :key="s.key" class="field">
          <span class="label">{{ s.key.replace(/_/g, ' ') }}</span>
          <input type="text" v-model="s.value">
        </label>

        <button class="btn" type="submit">Save</button>
      </form>
    </section>
  </div>
</template>
