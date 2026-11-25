// ============================================================
//  Client-side routing (the course: "Vue Router").
//
//  Before, each screen was a separate HTML file. This is a Single
//  Page Application: one page, and the router swaps the component
//  in. The addresses keep the same spirit (/groups/:id) so the
//  back button works and every issue has a shareable link.
// ============================================================
import { createRouter, createWebHistory } from 'vue-router';
import { state, initialise } from '../api/state';

const routes = [
  { path: '/',            name: 'login',   component: () => import('../views/Login.vue'),
    meta: { public: true } },
  { path: '/signup',      name: 'signup',  component: () => import('../views/Signup.vue'),
    meta: { public: true } },
  { path: '/plans',       name: 'plans',   component: () => import('../views/Plans.vue'),
    meta: { public: true } },

  { path: '/groups',      name: 'groups',  component: () => import('../views/Groups.vue') },
  { path: '/groups/:id',  name: 'group',   component: () => import('../views/Group.vue'), props: true },
  { path: '/profile',     name: 'profile', component: () => import('../views/Profile.vue') },
  { path: '/write/:month?', name: 'write', component: () => import('../views/Questionnaire.vue'), props: true },
  { path: '/issues',      name: 'issues',  component: () => import('../views/Issues.vue') },
  { path: '/issues/:id',  name: 'issue',   component: () => import('../views/Issue.vue'), props: true },
  { path: '/shop',        name: 'shop',    component: () => import('../views/Shop.vue') },
  { path: '/admin',       name: 'admin',   component: () => import('../views/Admin.vue'),
    meta: { siteAdmin: true } },

  { path: '/:rest(.*)',   redirect: '/groups' }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
});

// ------------------------------------------------------------
//  The navigation guard.
//  It replaces the old `requireSession()` that every page called:
//  one rule, in one place, for every private page.
//
//  ⚠️ This guard is a CONVENIENCE, not security: it stops an empty
//  page being shown. The real protection is server-side, in the
//  Express middleware. Nothing sensitive passes through here.
// ------------------------------------------------------------
router.beforeEach(async (to) => {
  if (!state.ready) await initialise();

  if (!to.meta.public && !state.account) {
    return { name: 'login', query: { next: to.fullPath } };
  }
  if (to.meta.siteAdmin && state.account?.site_role !== 'admin') {
    return { name: 'groups' };
  }
  // Already signed in: the login page has no reason to show.
  if (state.account && (to.name === 'login' || to.name === 'signup')) {
    return { name: 'groups' };
  }
  return true;
});

export default router;
