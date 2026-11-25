// ============================================================
//  Sign up, sign in, sign out.
//
//  The password is never stored in clear: bcrypt hashes it with a
//  cost of 12 (lecture CM5). The session is kept server-side; the
//  browser only receives an identifier in a cookie (lecture CM4,
//  "Cookies" and "Session").
// ============================================================
const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');
const { Account, Member } = require('../models');
const { wrap } = require('../middleware/errors');
const { requireLogin } = require('../middleware/permissions');

const router = express.Router();
const BCRYPT_COST = 12;

// --- POST /api/auth/signup ----------------------------------
router.post('/signup', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const firstName = String(req.body.first_name || '').trim() || email.split('@')[0];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'That e-mail address is not valid.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'The password needs at least 8 characters.' });
  }
  if (await Account.findOne({ where: { email } })) {
    return res.status(409).json({ error: 'An account already exists with that address.' });
  }

  // We store ONLY the hash.
  const hash = await bcrypt.hash(password, BCRYPT_COST);

  const account = await Account.create({
    id: uuid(), email, password: hash, first_name: firstName, holidays: []
  });

  // Invitations waiting at that address are attached automatically,
  // so the person finds her groups straight away.
  await Member.update(
    { account_id: account.id },
    { where: { email, account_id: null } }
  );

  req.session.accountId = account.id;
  res.status(201).json(account.toPublic());
}));

// --- POST /api/auth/login -----------------------------------
router.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const account = await Account.findOne({ where: { email } });

  // The same message either way: we do not reveal whether the
  // address exists, or the site becomes a directory of accounts.
  const fail = () => res.status(401).json({ error: 'Wrong address or password.' });
  if (!account) {
    await bcrypt.compare(password, '$2b$12$' + 'x'.repeat(53)); // constant time
    return fail();
  }

  const correct = await bcrypt.compare(password, account.password);
  if (!correct) return fail();

  // Regenerate the session on sign-in (against session fixation).
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Could not start a session.' });
    req.session.accountId = account.id;
    res.json(account.toPublic());
  });
}));

// --- POST /api/auth/logout ----------------------------------
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('newsletter.sid');
    res.json({ ok: true });
  });
});

// --- GET /api/auth/me ---------------------------------------
router.get('/me', requireLogin, wrap(async (req, res) => {
  res.json(req.account.toPublic());
}));

// --- PATCH /api/auth/password -------------------------------
router.patch('/password', requireLogin, wrap(async (req, res) => {
  const current = String(req.body.current || '');
  const next = String(req.body.next || '');

  if (next.length < 8) {
    return res.status(400).json({ error: 'The new password needs at least 8 characters.' });
  }
  if (!await bcrypt.compare(current, req.account.password)) {
    return res.status(401).json({ error: 'Current password is wrong.' });
  }

  req.account.password = await bcrypt.hash(next, BCRYPT_COST);
  await req.account.save();
  res.json({ ok: true });
}));

module.exports = router;
