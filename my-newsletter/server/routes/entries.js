// ============================================================
//  The single draft, and sending it to the groups.
//
//  You do NOT fill in one questionnaire per group: you fill one in
//  once, then tick the groups to send it to. The server maps each
//  answer onto the question id of each issue (services/keys.js).
// ============================================================
const express = require('express');
const { Op } = require('sequelize');
const { v4: uuid } = require('uuid');
const {
  Draft, Issue, Group, Member, Entry, AskedQuestion
} = require('../models');
const { contentForIssue } = require('../services/keys');
const { questionsForMonth } = require('../config/questions');
const { wrap } = require('../middleware/errors');
const { requireLogin, byIssue, requireMember } = require('../middleware/permissions');
const { renumber } = require('./issues');

const router = express.Router();
router.use(requireLogin);

function firstOfMonth(month) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(month)) ? String(month).slice(0, 10) : null;
}

// --- GET /api/entries/draft/:month --------------------------
router.get('/draft/:month', wrap(async (req, res) => {
  const month = firstOfMonth(req.params.month);
  if (!month) return res.status(400).json({ error: 'Invalid month.' });

  const draft = await Draft.findOne({
    where: { account_id: req.account.id, month }
  });
  res.json(draft || { month, content: {}, media: [], layout: null });
}));

// --- PUT /api/entries/draft/:month --------------------------
//  Saved automatically while typing.
router.put('/draft/:month', wrap(async (req, res) => {
  const month = firstOfMonth(req.params.month);
  if (!month) return res.status(400).json({ error: 'Invalid month.' });

  const values = {
    content: req.body.content || {},
    media: req.body.media || [],
    updated_at: new Date()
  };
  if (req.body.layout !== undefined) values.layout = req.body.layout;

  const [draft, created] = await Draft.findOrCreate({
    where: { account_id: req.account.id, month },
    defaults: { id: uuid(), account_id: req.account.id, month, ...values }
  });
  if (!created) await draft.update(values);

  res.json(draft);
}));

// --- GET /api/entries/sent/:month ---------------------------
//  Which groups already have my page this month?
router.get('/sent/:month', wrap(async (req, res) => {
  const month = firstOfMonth(req.params.month);
  if (!month) return res.status(400).json({ error: 'Invalid month.' });

  const mine = (await Member.findAll({
    where: { account_id: req.account.id }, attributes: ['group_id']
  })).map(m => m.group_id);
  if (!mine.length) return res.json([]);

  const issues = await Issue.findAll({ where: { group_id: mine, month } });
  if (!issues.length) return res.json([]);

  const entries = await Entry.findAll({
    where: { issue_id: issues.map(i => i.id), account_id: req.account.id }
  });

  res.json(issues.map(issue => {
    const entry = entries.find(e => e.issue_id === issue.id);
    return {
      group_id: issue.group_id, issue_id: issue.id,
      sent: !!(entry && entry.sent),
      updated_at: entry ? entry.updated_at : null
    };
  }));
}));

// --- POST /api/entries/send ---------------------------------
//  Sends the month's draft to the groups ticked.
router.post('/send', wrap(async (req, res) => {
  const month = firstOfMonth(req.body.month);
  const groups = Array.isArray(req.body.groups) ? req.body.groups : [];

  if (!month) return res.status(400).json({ error: 'Invalid month.' });
  if (!groups.length) return res.status(400).json({ error: 'Tick at least one group.' });

  const draft = await Draft.findOne({
    where: { account_id: req.account.id, month }
  });
  if (!draft) return res.status(400).json({ error: 'There is no draft to send.' });

  const results = [];

  for (const groupId of groups) {
    // Membership is checked for EVERY group: we never trust the
    // list the browser sent.
    const membership = await Member.findOne({
      where: { group_id: groupId, account_id: req.account.id }
    });
    if (!membership) {
      results.push({ group_id: groupId, ok: false, reason: 'Not a member.' });
      continue;
    }

    // No issue open this month? Open one.
    let issue = await Issue.findOne({ where: { group_id: groupId, month } });
    if (!issue) {
      const earlier = await Issue.count({
        where: { group_id: groupId, month: { [Op.lt]: month } }
      });
      issue = await Issue.create({
        id: uuid(), group_id: groupId, number: earlier + 1,
        month, status: 'open', questions: questionsForMonth(month)
      });
      await renumber(groupId);
    }

    if (issue.status === 'published') {
      results.push({ group_id: groupId, ok: false, reason: 'Issue already published.' });
      continue;
    }

    const asked = await AskedQuestion.findAll({ where: { issue_id: issue.id } });
    const content = contentForIssue(issue.toJSON(), draft.content || {},
                                     asked.map(q => q.toJSON()));

    const values = {
      content, media: draft.media || [],
      layout: draft.layout, sent: true, updated_at: new Date()
    };

    const [entry, created] = await Entry.findOrCreate({
      where: { issue_id: issue.id, account_id: req.account.id },
      defaults: { id: uuid(), issue_id: issue.id, account_id: req.account.id, ...values }
    });
    if (!created) await entry.update(values);

    results.push({ group_id: groupId, ok: true, issue_id: issue.id });
  }

  res.json({ results });
}));

// --- GET /api/entries/issue/:id/mine ------------------------
router.get('/issue/:id/mine', byIssue(requireMember), wrap(async (req, res) => {
  const entry = await Entry.findOne({
    where: { issue_id: req.params.id, account_id: req.account.id }
  });
  res.json(entry || null);
}));

// --- PATCH /api/entries/:id/layout --------------------------
//  "Arrange my page how I like": only your own.
router.patch('/:id/layout', wrap(async (req, res) => {
  const entry = await Entry.findByPk(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Page not found.' });
  if (entry.account_id !== req.account.id) {
    return res.status(403).json({ error: 'You can only arrange your own page.' });
  }
  await entry.update({ layout: req.body.layout || null });
  res.json(entry);
}));

// --- DELETE /api/entries/issue/:id --------------------------
//  Pull your page out of an issue that is still open.
router.delete('/issue/:id', byIssue(requireMember), wrap(async (req, res) => {
  if (req.issue.status === 'published') {
    return res.status(403).json({ error: 'That issue is already published.' });
  }
  await Entry.destroy({
    where: { issue_id: req.params.id, account_id: req.account.id }
  });
  res.json({ ok: true });
}));

// --- GET /api/entries/issue/:id/count -----------------------
router.get('/issue/:id/count', byIssue(requireMember), wrap(async (req, res) => {
  const sent = await Entry.count({
    where: { issue_id: req.params.id, sent: true }
  });
  const expected = await Member.count({ where: { group_id: req.issue.group_id } });
  res.json({ sent, expected });
}));

module.exports = router;
