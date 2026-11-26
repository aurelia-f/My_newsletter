// ============================================================
//  The local mailbox.
//
//  ⚠️ Wide open on purpose, like MailHog and every other mail
//  catcher: it is a development tool, and it is what lets anyone
//  follow the password-reset journey without a mail service.
//  It has no business on a live site, and it would not be
//  deployed with one.
// ============================================================
const express = require('express');
const { Mail } = require('../models');
const { wrap } = require('../middleware/errors');

const router = express.Router();

// --- GET /api/mails?email=... -------------------------------
router.get('/', wrap(async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.json([]);

  res.json(await Mail.findAll({
    where: { to_email: email }, order: [['created_at', 'DESC']], limit: 50
  }));
}));

// --- PATCH /api/mails/:id/read ------------------------------
router.patch('/:id/read', wrap(async (req, res) => {
  const mail = await Mail.findByPk(req.params.id);
  if (!mail) return res.status(404).json({ error: 'Mail not found.' });
  if (!mail.read_at) await mail.update({ read_at: new Date() });
  res.json(mail);
}));

// --- DELETE /api/mails/:id ----------------------------------
router.delete('/:id', wrap(async (req, res) => {
  await Mail.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

module.exports = router;