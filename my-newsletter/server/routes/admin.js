// ============================================================
//  The admin area: our own dashboard.
//
//  Locked by requireSiteAdmin: knowing the /admin address is not
//  enough, the account must carry site_role='admin' in the
//  database. Even by tampering with requests, you do not get in.
// ============================================================
const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const {
  Account, Group, Member, Issue, Entry, Subscription, Payment,
  Order, Ad, Plan, Setting, Ban, sequelize
} = require('../models');
const adServer = require('../services/ads');
const { wrap } = require('../middleware/errors');
const { requireLogin, requireSiteAdmin } = require('../middleware/permissions');

const router = express.Router();
router.use(requireLogin, requireSiteAdmin);

// --- GET /api/admin/dashboard -------------------------------
router.get('/dashboard', wrap(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  // --- People ---------------------------------------------
  const signups = await Account.count();
  const new30d = await Account.count({ where: { created_at: { [Op.gte]: thirtyDaysAgo } } });
  const groups = await Group.count();
  const memberships = await Member.count();
  const attached = await Member.count({ where: { account_id: { [Op.ne]: null } } });

  // --- Activity -------------------------------------------
  const issues = await Issue.count();
  const published = await Issue.count({ where: { status: 'published' } });
  const open = await Issue.count({ where: { status: 'open' } });
  const entriesSent = await Entry.count({ where: { sent: true } });

  // Response rate: pages sent / pages expected.
  const expectedRows = await sequelize.query(
    `SELECT COUNT(*) AS n
       FROM issues i
       JOIN members m ON m.group_id = i.group_id
      WHERE m.account_id IS NOT NULL`,
    { type: sequelize.QueryTypes.SELECT }
  );
  const expected = Number(expectedRows[0]?.n || 0);

  // --- Money ----------------------------------------------
  const subs = await Subscription.findAll({ where: { status: 'active' } });
  const mrr = subs.reduce((t, s) => t + s.monthly_price, 0);

  const perAddOn = {};
  for (const p of await Plan.findAll({ order: [['sort_order', 'ASC']] })) {
    perAddOn[p.code] = {
      name: p.name, price: p.monthly_price,
      subscribers: subs.filter(s => (s.add_ons || []).includes(p.code)).length
    };
  }

  const taken30d = await Payment.sum('amount', {
    where: { status: 'succeeded', created_at: { [Op.gte]: thirtyDaysAgo } }
  });
  const takenTotal = await Payment.sum('amount', { where: { status: 'succeeded' } });
  const declined = await Payment.count({ where: { status: 'declined' } });

  // --- Paper orders ---------------------------------------
  const toShip = await Order.count({ where: { status: { [Op.ne]: 'shipped' } } });
  const ordersTotal = await Order.count();

  res.json({
    people: {
      signups, new30d, groups, memberships, attached,
      pending_invitations: memberships - attached,
      average_per_group: groups ? Math.round((memberships / groups) * 10) / 10 : 0
    },
    activity: {
      issues, published, open,
      entries_sent: entriesSent,
      pages_expected: expected,
      response_rate: expected
        ? Math.round((entriesSent / expected) * 1000) / 10 : 0
    },
    money: {
      subscribers: subs.length,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      average_basket: subs.length ? Math.round((mrr / subs.length) * 100) / 100 : 0,
      full_bundles: subs.filter(s => (s.add_ons || []).length >= 3).length,
      per_add_on: perAddOn,
      taken_30d: Math.round((taken30d || 0) * 100) / 100,
      taken_total: Math.round((takenTotal || 0) * 100) / 100,
      declined_payments: declined,
      conversion_rate: signups
        ? Math.round((subs.length / signups) * 1000) / 10 : 0
    },
    orders: { to_ship: toShip, total: ordersTotal }
  });
}));

// --- GET /api/admin/signups ---------------------------------
//  Sign-ups day by day, for the chart.
router.get('/signups', wrap(async (req, res) => {
  const rows = await Account.findAll({
    attributes: [
      [fn('DATE', col('created_at')), 'day'],
      [fn('COUNT', col('id')), 'count']
    ],
    where: { created_at: { [Op.gte]: new Date(Date.now() - 90 * 86400000) } },
    group: [literal('DATE(created_at)')],
    order: [literal('day ASC')],
    raw: true
  });
  res.json(rows);
}));

// --- GET /api/admin/members ---------------------------------
router.get('/members', wrap(async (req, res) => {
  const search = String(req.query.q || '').trim();
  const where = search
    ? { [Op.or]: [
        { email:      { [Op.like]: `%${search}%` } },
        { first_name: { [Op.like]: `%${search}%` } }
      ] }
    : {};

  const accounts = await Account.findAll({
    where, order: [['created_at', 'DESC']], limit: 200
  });

    const bannedEmails = new Set(
    (await Ban.findAll({ attributes: ['email'] })).map(b => b.email)
  );

  const enriched = await Promise.all(accounts.map(async a => {
    const sub = await Subscription.findOne({
      where: { account_id: a.id, status: 'active' }
    });
    return {
      ...a.toPublic(),
      groups_created: await Group.count({ where: { created_by: a.id } }),
      memberships: await Member.count({ where: { account_id: a.id } }),
      banned: bannedEmails.has(a.email),
      subscription: sub ? { add_ons: sub.add_ons, price: sub.monthly_price } : null
    };
  }));
  res.json(enriched);
}));

// --- POST /api/admin/members/:id/ban ------------------------
//  Banning, at SITE level. keep_pages decides what happens to
//  the pages she has already sent:
//    true  → the account row stays, so the published issues keep
//            their pages. Signing in is blocked by the ban, which
//            sits on the e-mail address, not on the account.
//    false → the account is destroyed, and ON DELETE CASCADE
//            takes her pages, drafts and reactions with it.
router.post('/members/:id/ban', wrap(async (req, res) => {
  const { v4: uuid } = require('uuid');

  const account = await Account.findByPk(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found.' });
  if (account.site_role === 'admin') {
    return res.status(403).json({ error: 'A creator cannot be banned.' });
  }

  const keepPages = req.body.keep_pages !== false;
  const email = account.email.trim().toLowerCase();

  await Ban.destroy({ where: { email } });
  await Ban.create({
    id: uuid(), email, first_name: account.first_name,
    reason: String(req.body.reason || '').slice(0, 255) || null,
    kept_pages: keepPages, banned_by: req.account.id
  });

  // She leaves every group either way, invitations included.
  await Member.destroy({
    where: { [Op.or]: [{ account_id: account.id }, { email }] }
  });

  if (keepPages) {
    // Pages she had not sent yet are no use to anybody.
    await Entry.destroy({ where: { account_id: account.id, sent: false } });
  } else {
    await account.destroy();
  }

  res.json({ ok: true, kept_pages: keepPages, account_deleted: !keepPages });
}));

// --- GET /api/admin/bans ------------------------------------
router.get('/bans', wrap(async (req, res) => {
  res.json(await Ban.findAll({ order: [['created_at', 'DESC']] }));
}));

// --- DELETE /api/admin/bans/:id -----------------------------
//  Letting her back in. Her old pages do not come back if they
//  were erased.
router.delete('/bans/:id', wrap(async (req, res) => {
  await Ban.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// --- GET /api/admin/orders ----------------------------------
router.get('/orders', wrap(async (req, res) => {
  const where = req.query.status ? { status: req.query.status } : {};
  const orders = await Order.findAll({
    where,
    include: [
      { model: Account, as: 'account', attributes: ['id', 'first_name', 'email'] },
      { model: Group, as: 'group', attributes: ['id', 'name', 'icon'] },
      { model: Issue, as: 'issue', attributes: ['id', 'number', 'month'] }
    ],
    order: [['created_at', 'DESC']]
  });
  res.json(orders);
}));

// --- PATCH /api/admin/orders/:id ----------------------------
router.patch('/orders/:id', wrap(async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const status = req.body.status;
  if (!['paid', 'preparing', 'shipped'].includes(status)) {
    return res.status(400).json({ error: 'Unknown status.' });
  }
  await order.update({
    status,
    shipped_at: status === 'shipped' ? new Date() : null
  });
  res.json(order);
}));

// ============================================================
//  ADS
// ============================================================

// --- GET /api/admin/ads -------------------------------------
router.get('/ads', wrap(async (req, res) => {
  res.json({ ads: await adServer.report(), formats: Ad.FORMATS });
}));

// --- POST /api/admin/ads ------------------------------------
router.post('/ads', wrap(async (req, res) => {
  const { v4: uuid } = require('uuid');
  if (!Ad.SLOTS.includes(req.body.slot)) {
    return res.status(400).json({ error: 'Unknown slot.' });
  }
  const ad = await Ad.create({
    id: uuid(),
    title: String(req.body.title || 'Untitled').slice(0, 190),
    image_url: req.body.image_url,
    link: req.body.link || null,
    slot: req.body.slot,
    active: req.body.active !== false
  });
  res.status(201).json(ad);
}));

// --- PATCH /api/admin/ads/:id -------------------------------
router.patch('/ads/:id', wrap(async (req, res) => {
  const ad = await Ad.findByPk(req.params.id);
  if (!ad) return res.status(404).json({ error: 'Ad not found.' });

  const fields = {};
  for (const key of ['title', 'image_url', 'link', 'active', 'slot']) {
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  }
  await ad.update(fields);
  res.json(ad);
}));

// --- DELETE /api/admin/ads/:id ------------------------------
router.delete('/ads/:id', wrap(async (req, res) => {
  await Ad.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ============================================================
//  PRICES
// ============================================================

// --- GET /api/admin/prices ----------------------------------
router.get('/prices', wrap(async (req, res) => {
  res.json({
    plans: await Plan.findAll({ order: [['sort_order', 'ASC']] }),
    settings: await Setting.findAll()
  });
}));

// --- PATCH /api/admin/prices --------------------------------
//  Change a price without touching the code.
router.patch('/prices', wrap(async (req, res) => {
  for (const p of req.body.plans || []) {
    if (p.code && p.monthly_price !== undefined) {
      await Plan.update(
        { monthly_price: Number(p.monthly_price), active: p.active !== false },
        { where: { code: p.code } }
      );
    }
  }
  for (const [key, value] of Object.entries(req.body.settings || {})) {
    await Setting.upsert({ key, value: String(value), updated_at: new Date() });
  }
  res.json({ ok: true });
}));

module.exports = router;
