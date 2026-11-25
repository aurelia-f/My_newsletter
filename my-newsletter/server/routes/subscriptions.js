// ============================================================
//  Subscriptions: three add-ons, stacking and discounted.
//
//  The price is ALWAYS recomputed by the server (services/pricing).
//  The browser sends the add-ons wanted, never an amount.
// ============================================================
const express = require('express');
const { v4: uuid } = require('uuid');
const { Subscription, Group, Setting } = require('../models');
const pricing = require('../services/pricing');
const payment = require('../services/payment');
const { wrap } = require('../middleware/errors');
const { requireLogin } = require('../middleware/permissions');

const router = express.Router();

/** The same day, next month. */
function inAMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// --- GET /api/subscriptions/grid ----------------------------
//  Public: the prices page is visible without signing in.
router.get('/grid', wrap(async (req, res) => {
  res.json({
    ...await pricing.grid(),
    free_groups: await Setting.number('free_groups', 3),
    single_issue_price: await Setting.number('single_issue_price', 4.5),
    group_pack_price: await Setting.number('group_pack_price', 6.9)
  });
}));

// --- POST /api/subscriptions/quote --------------------------
//  "What would this cost me?" before paying.
router.post('/quote', wrap(async (req, res) => {
  res.json(await pricing.quote(req.body.add_ons));
}));

router.use(requireLogin);

// --- GET /api/subscriptions/mine ----------------------------
router.get('/mine', wrap(async (req, res) => {
  const sub = await Subscription.findOne({
    where: { account_id: req.account.id, status: 'active' }
  });
  const created = await Group.count({ where: { created_by: req.account.id } });
  const free = await Setting.number('free_groups', 3);

  res.json({
    subscription: sub,
    add_ons: sub ? sub.add_ons : [],
    quota: {
      free, used: created,
      unlimited: !!(sub && sub.add_ons.includes('unlimited_groups')),
      left: Math.max(0, free - created)
    }
  });
}));

// --- POST /api/subscriptions --------------------------------
//  Subscribe, or change add-ons. Payment is simulated.
router.post('/', wrap(async (req, res) => {
  const quote = await pricing.quote(req.body.add_ons);
  if (quote.add_ons.length === 0) {
    return res.status(400).json({ error: 'Choose at least one add-on.' });
  }

  const label = quote.full_bundle
    ? 'Full bundle (everything included)'
    : 'Subscription: ' + quote.detail.map(a => a.name).join(' + ');

  const receipt = await payment.charge(req.body.card, quote.price, label, req.account.id);

  // We cancel the previous subscription and open a new one, so the
  // history stays readable in the admin area.
  await Subscription.update(
    { status: 'cancelled', cancelled_at: new Date() },
    { where: { account_id: req.account.id, status: 'active' } }
  );

  const sub = await Subscription.create({
    id: uuid(), account_id: req.account.id,
    add_ons: quote.add_ons, monthly_price: quote.price,
    savings: quote.savings, status: 'active',
    renews_on: inAMonth()
  });

  res.status(201).json({ subscription: sub, quote, receipt });
}));

// --- DELETE /api/subscriptions/mine -------------------------
router.delete('/mine', wrap(async (req, res) => {
  const sub = await Subscription.findOne({
    where: { account_id: req.account.id, status: 'active' }
  });
  if (!sub) return res.status(404).json({ error: 'No subscription in progress.' });

  await sub.update({ status: 'cancelled', cancelled_at: new Date() });
  res.json({ ok: true });
}));

module.exports = router;
