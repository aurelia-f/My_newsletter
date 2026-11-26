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
const { Op } = require('sequelize');
const { Account, Member, Ban, AuthToken, Mail } = require('../models');
const { wrap } = require('../middleware/errors');
const { requireLogin } = require('../middleware/permissions');

const router = express.Router();
const BCRYPT_COST = 12;
const RESET_MINUTES = 15;   // a forgotten password
const EMAIL_MINUTES = 30;   // a change of address

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
    if (await Ban.isBanned(email)) {
    return res.status(403).json({ error: 'That address cannot be used on this site.' });
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

  // Checked AFTER the password, on purpose: otherwise the site
  // would tell anybody which addresses are banned.
  if (await Ban.isBanned(email)) {
    return res.status(403).json({ error: 'This account has been closed.' });
  }

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

// --- POST /api/auth/forgot ----------------------------------
//  A forgotten password. No mail service here, so the code comes
//  back in the answer and the page shows it: it stands in for the
//  e-mail. Three codes an hour at most, so the route cannot be
//  hammered.
router.post('/forgot', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const account = await Account.findOne({ where: { email } });

  if (!account) return res.json({ ok: true, token: null });

  const recent = await AuthToken.count({
    where: {
      account_id: account.id, purpose: 'password_reset',
      created_at: { [Op.gte]: new Date(Date.now() - 3600000) }
    }
  });
  if (recent >= 3) {
    return res.status(429).json({ error: 'Too many codes asked for. Try again in an hour.' });
  }

    const { raw } = await AuthToken.issue(account.id, 'password_reset', RESET_MINUTES);

  // The token goes in the LINK, inside the mail. Whoever asked
  // never sees it: she has to open the mailbox of that address.
  await Mail.send({
    to: email,
    subject: 'Your new password',
    body: `Hello ${account.first_name || ''},\n\n`
        + 'Somebody asked for a new password on My Newsletter. '
        + 'Follow the link below to choose one. It works once, and '
        + `it stops working in ${RESET_MINUTES} minutes.\n\n`
        + 'If it was not you, you can forget this message: nothing '
        + 'has changed on your account.',
    link: '/link/' + raw
  });

  res.json({ ok: true, sent_to: email });
}));

// --- POST /api/auth/reset -----------------------------------
//  The code plus the new password. No session needed: that is
//  the whole point, she cannot sign in.
router.post('/reset', wrap(async (req, res) => {
  const password = String(req.body.password || '');
  if (password.length < 8) {
    return res.status(400).json({ error: 'The password needs at least 8 characters.' });
  }

  const token = await AuthToken.consume(req.body.token, 'password_reset');
  if (!token) {
    return res.status(400).json({ error: 'That code is wrong, already used, or out of date.' });
  }

  const account = await Account.findByPk(token.account_id);
  if (!account) return res.status(404).json({ error: 'Account not found.' });

  account.password = await bcrypt.hash(password, BCRYPT_COST);
  await account.save();
  await token.update({ used_at: new Date() });

  res.json({ ok: true });
}));

// --- POST /api/auth/email -----------------------------------
//  Asking to change address. Works for a member and for the
//  creator of the site alike: what counts is being signed in and
//  knowing the current password.
router.post('/email', requireLogin, wrap(async (req, res) => {
  const newEmail = String(req.body.new_email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
    return res.status(400).json({ error: 'That e-mail address is not valid.' });
  }
  if (newEmail === req.account.email) {
    return res.status(400).json({ error: 'That is already your address.' });
  }
  if (!await bcrypt.compare(password, req.account.password)) {
    return res.status(401).json({ error: 'Your password is wrong.' });
  }
  if (await Account.findOne({ where: { email: newEmail } })) {
    return res.status(409).json({ error: 'An account already exists with that address.' });
  }
  if (await Ban.isBanned(newEmail)) {
    return res.status(403).json({ error: 'That address cannot be used on this site.' });
  }

    const { raw } = await AuthToken.issue(
    req.account.id, 'email_change', EMAIL_MINUTES, { new_email: newEmail }
  );

  // Sent to the NEW address: that is what proves she can read it.
  await Mail.send({
    to: newEmail,
    subject: 'Confirm your new address',
    body: `Hello ${req.account.first_name || ''},\n\n`
        + 'You asked to use this address on My Newsletter. Follow '
        + 'the link below to confirm it. It works once, and it '
        + `stops working in ${EMAIL_MINUTES} minutes.`,
    link: '/link/' + raw
  });

  res.json({ ok: true, sent_to: newEmail });
}));

// --- POST /api/auth/email/confirm ---------------------------
//  The address is checked for a second time here: between asking
//  and confirming, somebody else could have taken it.
router.post('/email/confirm', requireLogin, wrap(async (req, res) => {
  const token = await AuthToken.consume(req.body.token, 'email_change');
  if (!token || token.account_id !== req.account.id) {
    return res.status(400).json({ error: 'That code is wrong, already used, or out of date.' });
  }
  if (await Account.findOne({ where: { email: token.new_email } })) {
    return res.status(409).json({ error: 'An account already exists with that address.' });
  }

  req.account.email = token.new_email;
  await req.account.save();
  await token.update({ used_at: new Date() });

  // Her memberships follow the address: that is what the groups
  // match on, so without this she would leave her own groups.
  await Member.update(
    { email: token.new_email },
    { where: { account_id: req.account.id } }
  );

  res.json(req.account.toPublic());
}));

// --- GET /api/auth/token/:token -----------------------------
//  What is this link for? Lets one single page handle both
//  journeys. Reads the token without spending it: it is only
//  marked used once the password or the address really changes.
router.get('/token/:token', wrap(async (req, res) => {
  const token = await AuthToken.consume(req.params.token, 'password_reset')
             || await AuthToken.consume(req.params.token, 'email_change');

  if (!token) {
    return res.status(404).json({ error: 'That link is wrong, already used, or out of date.' });
  }

  res.json({
    purpose: token.purpose,
    new_email: token.new_email || null,
    expires_at: token.expires_at
  });
}));

module.exports = router;
