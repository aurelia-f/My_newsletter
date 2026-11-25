// ============================================================
//  The paper shop.
//
//  Two products:
//    1. a single issue ordered for yourself;
//    2. the "real newsprint" pack for a whole group, with a
//       business card, the sticker of the month and two blank
//       postcards, posted to each person's letterbox.
//
//  The pack contents are JSON: a goodie can be added without
//  touching the schema or the code.
// ============================================================
const express = require('express');
const { v4: uuid } = require('uuid');
const { Order, Issue, Group, Member, Setting } = require('../models');
const payment = require('../services/payment');
const { wrap } = require('../middleware/errors');
const { requireLogin } = require('../middleware/permissions');

const router = express.Router();
router.use(requireLogin);

// What the group pack holds, per person.
const PACK_CONTENTS = [
  { item: 'The issue printed on real newsprint', quantity: 1 },
  { item: 'My Newsletter business card', quantity: 1 },
  { item: 'Sticker of the month', quantity: 1 },
  { item: 'Blank postcard', quantity: 2 }
];

/** Checks the delivery address is complete. */
function validAddress(a) {
  return a && ['name', 'line1', 'postcode', 'city', 'country']
    .every(f => String(a[f] || '').trim().length > 0);
}

// --- GET /api/shop/prices -----------------------------------
router.get('/prices', wrap(async (req, res) => {
  res.json({
    single_issue: await Setting.number('single_issue_price', 4.5),
    group_pack: await Setting.number('group_pack_price', 6.9),
    pack_contents: PACK_CONTENTS
  });
}));

// --- GET /api/shop/my-orders --------------------------------
router.get('/my-orders', wrap(async (req, res) => {
  const orders = await Order.findAll({
    where: { account_id: req.account.id },
    include: [
      { model: Issue, as: 'issue', attributes: ['id', 'number', 'month'] },
      { model: Group, as: 'group', attributes: ['id', 'name', 'icon'] }
    ],
    order: [['created_at', 'DESC']]
  });
  res.json(orders);
}));

// --- POST /api/shop/issue -----------------------------------
//  Order a published issue, one copy at a time.
router.post('/issue', wrap(async (req, res) => {
  const issue = await Issue.findByPk(req.body.issue_id);
  if (!issue) return res.status(404).json({ error: 'Issue not found.' });
  if (issue.status !== 'published') {
    return res.status(400).json({ error: 'You can only order a published issue.' });
  }

  // You only order the newspaper of a group you belong to.
  const membership = await Member.findOne({
    where: { group_id: issue.group_id, account_id: req.account.id }
  });
  if (!membership) return res.status(403).json({ error: 'That issue is not available to you.' });

  if (!validAddress(req.body.address)) {
    return res.status(400).json({ error: 'The delivery address is incomplete.' });
  }

  const copies = Math.max(1, Math.min(20, Number(req.body.copies) || 1));
  const unitPrice = await Setting.number('single_issue_price', 4.5);
  const amount = Math.round(unitPrice * copies * 100) / 100;

  const receipt = await payment.charge(
    req.body.card, amount,
    `Issue ${issue.number} on paper (x${copies})`, req.account.id
  );

  const order = await Order.create({
    id: uuid(), account_id: req.account.id, kind: 'single_issue',
    issue_id: issue.id, group_id: issue.group_id,
    copies, pack_contents: [PACK_CONTENTS[0]],
    amount, address: req.body.address, status: 'paid'
  });

  res.status(201).json({ order, receipt });
}));

// --- POST /api/shop/group-pack ------------------------------
//  The pack for a whole group: one posting per person.
//  Admins only, since it commits everybody.
router.post('/group-pack', wrap(async (req, res) => {
  const membership = await Member.findOne({
    where: { group_id: req.body.group_id, account_id: req.account.id, role: 'admin' }
  });
  if (!membership) {
    return res.status(403).json({ error: 'Group admins only.' });
  }

  if (!validAddress(req.body.address)) {
    return res.status(400).json({ error: 'The billing address is incomplete.' });
  }

  const memberCount = await Member.count({ where: { group_id: req.body.group_id } });
  const perPerson = await Setting.number('group_pack_price', 6.9);
  const amount = Math.round(perPerson * memberCount * 100) / 100;

  const group = await Group.findByPk(req.body.group_id);
  const receipt = await payment.charge(
    req.body.card, amount,
    `Paper pack "${group.name}" (${memberCount} people)`, req.account.id
  );

  const order = await Order.create({
    id: uuid(), account_id: req.account.id, kind: 'group_pack',
    group_id: group.id, issue_id: req.body.issue_id || null,
    copies: memberCount, pack_contents: PACK_CONTENTS,
    amount, address: req.body.address, status: 'paid'
  });

  res.status(201).json({ order, receipt, per_person: perPerson });
}));

module.exports = router;
module.exports.PACK_CONTENTS = PACK_CONTENTS;
