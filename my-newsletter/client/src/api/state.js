// ============================================================
//  The state shared across the application.
//
//  The course does not ask for Pinia: a reactive object is
//  enough, and it reads better. `account` is the signed-in
//  person, `config` the questionnaire settings from the server.
// ============================================================
import { reactive } from 'vue';
import { auth, api, subscriptions } from './client';

export const state = reactive({
  account: null,
  config: null,
  subscription: { add_ons: [], quota: null },
  ready: false
});

/** On start-up: who is signed in, and what are the settings? */
export async function initialise() {
  try { state.config = await api.get('/config'); } catch { state.config = null; }
  try { state.account = await auth.me(); } catch { state.account = null; }
  if (state.account) await refreshSubscription();
  state.ready = true;
}

export async function refreshSubscription() {
  try {
    const r = await subscriptions.mine();
    state.subscription = { add_ons: r.add_ons || [], quota: r.quota,
                           subscription: r.subscription };
  } catch {
    state.subscription = { add_ons: [], quota: null };
  }
}

export async function signIn(credentials) {
  state.account = await auth.login(credentials);
  await refreshSubscription();
  return state.account;
}

export async function signUp(details) {
  state.account = await auth.signup(details);
  await refreshSubscription();
  return state.account;
}

export async function signOut() {
  await auth.logout();
  state.account = null;
  state.subscription = { add_ons: [], quota: null };
}

/** Have we paid for this add-on? Hides ads, unlocks the quota… */
export function hasAddOn(code) {
  return (state.subscription.add_ons || []).includes(code);
}
