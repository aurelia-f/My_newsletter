// ============================================================
//  Groups: create, invite, manage roles.
//
//  The free quota of 3 groups is enforced by the groupQuota
//  middleware, not by the interface.
// ============================================================
const express = require('express');
const { v4: uuid } = require('uuid');
const { Account, Group, Member, Issue } = require('../models');
const { wrap } = require('../middleware/errors');
const {
  requireLogin, requireMember, requireGroupAdmin, groupQuota
} = require('../middleware/permissions');

const router = express.Router();
router.use(requireLogin);

// --- GET /api/groups ----------------------------------------
//  My groups, split into "I run" and "I take part".
router.get('/', wrap(async (req, res) => {
  const memberships = await Member.findAll({
    where: { account_id: req.account.id },
    include: [{ model: Group, as: 'group' }]
  });

  const groups = await Promise.all(memberships.map(async m => {
    const memberCount = await Member.count({ where: { group_id: m.group_id } });
    const open = await Issue.findOne({
      where: { group_id: m.group_id, status: 'open' },
      order: [['month', 'DESC']]
    });
    return {
      ...m.group.toJSON(),
      my_role: m.role,
      member_count: memberCount,
      open_issue: open ? open.toJSON() : null
    };
  }));

  res.json({
    i_run:       groups.filter(g => g.my_role === 'admin'),
    i_take_part: groups.filter(g => g.my_role !== 'admin')
  });
}));

// --- POST /api/groups ---------------------------------------
router.post('/', groupQuota, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (name.length < 2) {
    return res.status(400).json({ error: 'Give your group a name.' });
  }

  const group = await Group.create({
    id: uuid(), name,
    icon: req.body.icon || '🎀',
    color: req.body.color || null,
    created_by: req.account.id
  });

  // The creator is a member and an admin from the start.
  await Member.create({
    id: uuid(), group_id: group.id,
    email: req.account.email, first_name: req.account.first_name,
    account_id: req.account.id, role: 'admin'
  });

  res.status(201).json(group);
}));

// --- GET /api/groups/:id ------------------------------------
router.get('/:id', requireMember, wrap(async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  const members = await Member.findAll({
    where: { group_id: req.params.id },
    include: [{ model: Account, as: 'account',
                attributes: ['id', 'first_name', 'avatar_url', 'motto', 'occupation'] }],
    order: [['joined_at', 'ASC']]
  });
  const issues = await Issue.findAll({
    where: { group_id: req.params.id }, order: [['month', 'DESC']]
  });

  res.json({
    ...group.toJSON(),
    my_role: req.membership.role,
    i_am_the_creator: group.created_by === req.account.id,
    members, issues
  });
}));

// --- PATCH /api/groups/:id ----------------------------------
router.patch('/:id', requireGroupAdmin, wrap(async (req, res) => {
  const fields = {};
  for (const key of ['name', 'icon', 'color']) {
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  }
  await Group.update(fields, { where: { id: req.params.id } });
  res.json(await Group.findByPk(req.params.id));
}));

// --- DELETE /api/groups/:id ---------------------------------
//  Only the creator deletes the group, not the co-admins.
router.delete('/:id', requireGroupAdmin, wrap(async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (group.created_by !== req.account.id) {
    return res.status(403).json({ error: 'Only the creator can delete the group.' });
  }
  await group.destroy();
  res.json({ ok: true });
}));

// --- POST /api/groups/:id/members ---------------------------
//  You invite by e-mail, even if the person has no account yet.
router.post('/:id/members', requireGroupAdmin, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const firstName = String(req.body.first_name || '').trim() || email.split('@')[0];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'That e-mail address is not valid.' });
  }
  if (await Member.findOne({ where: { group_id: req.params.id, email } })) {
    return res.status(409).json({ error: 'That person is already in the group.' });
  }

  // If she already has an account, attach her right away.
  const account = await Account.findOne({ where: { email } });

  const member = await Member.create({
    id: uuid(), group_id: req.params.id, email, first_name: firstName,
    account_id: account ? account.id : null, role: 'member'
  });
  res.status(201).json(member);
}));

// --- PATCH /api/groups/:id/members/:memberId ----------------
router.patch('/:id/members/:memberId', requireGroupAdmin, wrap(async (req, res) => {
  const member = await Member.findByPk(req.params.memberId);
  if (!member || member.group_id !== req.params.id) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  const group = await Group.findByPk(req.params.id);
  // The creator keeps her role whatever happens: enforced here,
  // not only in the interface.
  if (member.account_id === group.created_by) {
    return res.status(403).json({ error: "The creator's role cannot be changed." });
  }

  const role = req.body.role;
  if (!['member', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Unknown role.' });
  }
  await member.update({ role });
  res.json(member);
}));

// --- DELETE /api/groups/:id/members/:memberId ---------------
router.delete('/:id/members/:memberId', requireGroupAdmin, wrap(async (req, res) => {
  const member = await Member.findByPk(req.params.memberId);
  if (!member || member.group_id !== req.params.id) {
    return res.status(404).json({ error: 'Member not found.' });
  }
  const group = await Group.findByPk(req.params.id);
  if (member.account_id === group.created_by) {
    return res.status(403).json({ error: 'The creator cannot be removed.' });
  }
  await member.destroy();
  res.json({ ok: true });
}));

module.exports = router;
