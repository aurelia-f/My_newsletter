// ============================================================
//  The HTTP client: every exchange with the Node API.
//
//  Replaces the old db.js, which talked straight to Supabase.
//  The browser never touches the database now: it goes through
//  JSON routes, and the server decides everything.
//
//  credentials:'include' sends the session cookie on every
//  request: that is what keeps us signed in.
// ============================================================

const BASE = '/api';

async function request(method, path, body) {
  const options = { method, credentials: 'include', headers: {} };

  if (body instanceof FormData) {
    options.body = body;                        // multipart: no manual Content-Type
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(BASE + path, options);

  let data = null;
  try { data = await response.json(); } catch { /* 204, or an empty body */ }

  if (!response.ok) {
    const error = new Error(data?.error || 'Something went wrong.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get:    (path)       => request('GET', path),
  post:   (path, body) => request('POST', path, body),
  put:    (path, body) => request('PUT', path, body),
  patch:  (path, body) => request('PATCH', path, body),
  delete: (path)       => request('DELETE', path)
};

// ---- Shortcuts by area, to keep the views readable ----

export const auth = {
  signup:   (d) => api.post('/auth/signup', d),
  login:    (d) => api.post('/auth/login', d),
  logout:   ()  => api.post('/auth/logout'),
  me:       ()  => api.get('/auth/me'),
  password: (d) => api.patch('/auth/password', d)
};

export const profiles = {
  me:       ()   => api.get('/profiles/me'),
  updateMe: (d)  => api.patch('/profiles/me', d),
  card:     (id) => api.get('/profiles/' + id),
  uploadMedia: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/profiles/media', form);
  }
};

export const groups = {
  mine:       ()          => api.get('/groups'),
  create:     (d)         => api.post('/groups', d),
  one:        (id)        => api.get('/groups/' + id),
  update:     (id, d)     => api.patch('/groups/' + id, d),
  remove:     (id)        => api.delete('/groups/' + id),
  invite:     (id, d)     => api.post(`/groups/${id}/members`, d),
  changeRole: (id, m, r)  => api.patch(`/groups/${id}/members/${m}`, { role: r }),
  removeMember: (id, m)   => api.delete(`/groups/${id}/members/${m}`)
};

export const issues = {
  open:    ()       => api.get('/issues/open'),
  mine:    ()       => api.get('/issues/mine'),
  create:  (d)      => api.post('/issues', d),
  one:     (id)     => api.get('/issues/' + id),
  publish: (id)     => api.post(`/issues/${id}/publish`),
  render:  (id, d)  => api.patch(`/issues/${id}/render`, d),
  remove:  (id)     => api.delete('/issues/' + id)
};

export const entries = {
  draft:       (month)     => api.get('/entries/draft/' + month),
  saveDraft:   (month, d)  => api.put('/entries/draft/' + month, d),
  sentTo:      (month)     => api.get('/entries/sent/' + month),
  send:        (d)         => api.post('/entries/send', d),
  mine:        (id)        => api.get(`/entries/issue/${id}/mine`),
  saveLayout:  (id, l)     => api.patch(`/entries/${id}/layout`, { layout: l }),
  withdraw:    (id)        => api.delete('/entries/issue/' + id),
  count:       (id)        => api.get(`/entries/issue/${id}/count`)
};

export const questions = {
  forIssue:       (id)      => api.get('/questions/issue/' + id),
  ask:            (d)       => api.post('/questions', d),
  remove:         (id)      => api.delete('/questions/' + id),
  forMe:          (id)      => api.get('/questions/for-me/' + id),
  react:          (eid, d)  => api.put('/questions/reactions/' + eid, d),
  removeReaction: (eid)     => api.delete('/questions/reactions/' + eid)
};

export const subscriptions = {
  grid:      ()   => api.get('/subscriptions/grid'),
  quote:     (a, m) => api.post('/subscriptions/quote', { add_ons: a, months: m }),
  mine:      ()   => api.get('/subscriptions/mine'),
  subscribe: (d)  => api.post('/subscriptions', d),
  cancel:    ()   => api.delete('/subscriptions/mine')
};

export const shop = {
  prices:    ()   => api.get('/shop/prices'),
  myOrders:  ()   => api.get('/shop/my-orders'),
  issue:     (d)  => api.post('/shop/issue', d),
  groupPack: (d)  => api.post('/shop/group-pack', d)
};

export const ads = {
  forSlot: (slot) => api.get('/ads/' + slot),
  click:   (id)   => api.post(`/ads/${id}/click`)
};

export const admin = {
  dashboard:   ()        => api.get('/admin/dashboard'),
  signups:     ()        => api.get('/admin/signups'),
  members:     (q = '')  => api.get('/admin/members?q=' + encodeURIComponent(q)),
  orders:      (s = '')  => api.get('/admin/orders' + (s ? '?status=' + s : '')),
  updateOrder: (id, s)   => api.patch('/admin/orders/' + id, { status: s }),
  ads:         ()        => api.get('/admin/ads'),
  createAd:    (d)       => api.post('/admin/ads', d),
  updateAd:    (id, d)   => api.patch('/admin/ads/' + id, d),
  removeAd:    (id)      => api.delete('/admin/ads/' + id),
  prices:      ()        => api.get('/admin/prices'),
  savePrices:  (d)       => api.patch('/admin/prices', d)
};
