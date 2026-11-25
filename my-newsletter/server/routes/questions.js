// ============================================================
//  Questions friends put to each other, and reactions.
// ============================================================
const express = require('express');
const { v4: uuid } = require('uuid');
const { Account, Issue, Member, Entry, Reaction, AskedQuestion } = require('../models');
const { wrap } = require('../middleware/errors');
const { requireLogin, requireMember, byIssue } = require('../middleware/permissions');

const router = express.Router();
router.use(requireLogin);

// --- GET /api/questions/issue/:id ---------------------------
router.get('/issue/:id', byIssue(requireMember), wrap(async (req, res) => {
  const asked = await AskedQuestion.findAll({
    where: { issue_id: req.params.id },
    include: [
      { model: Account, as: 'author', attributes: ['id', 'first_name'] },
      { model: Account, as: 'target', attributes: ['id', 'first_name'] }
    ],
    order: [['created_at', 'ASC']]
  });
  res.json(asked);
}));

// --- POST /api/questions ------------------------------------
//  Ask the whole group, or one person in particular.
router.post('/', wrap(async (req, res) => {
  const issue = await Issue.findByPk(req.body.issue_id);
  if (!issue) return res.status(404).json({ error: 'Issue not found.' });
  if (issue.status === 'published') {
    return res.status(400).json({ error: 'That issue is already published.' });
  }

  const membership = await Member.findOne({
    where: { group_id: issue.group_id, account_id: req.account.id }
  });
  if (!membership) return res.status(403).json({ error: 'You are not in this group.' });

  const text = String(req.body.text || '').trim();
  if (text.length < 3 || text.length > 300) {
    return res.status(400).json({ error: 'The question must be 3 to 300 characters.' });
  }

  // If the question is aimed at someone, she must be in the group.
  const targetId = req.body.target_id || null;
  if (targetId) {
    const target = await Member.findOne({
      where: { group_id: issue.group_id, account_id: targetId }
    });
    if (!target) return res.status(400).json({ error: 'That person is not in the group.' });
  }

  const question = await AskedQuestion.create({
    id: uuid(), issue_id: issue.id, author_id: req.account.id,
    target_id: targetId, text
  });

  res.status(201).json(await AskedQuestion.findByPk(question.id, {
    include: [
      { model: Account, as: 'author', attributes: ['id', 'first_name'] },
      { model: Account, as: 'target', attributes: ['id', 'first_name'] }
    ]
  }));
}));

// --- DELETE /api/questions/:id ------------------------------
//  Your own question, or any of them if you are a group admin.
router.delete('/:id', wrap(async (req, res) => {
  const question = await AskedQuestion.findByPk(req.params.id);
  if (!question) return res.status(404).json({ error: 'Question not found.' });

  const issue = await Issue.findByPk(question.issue_id);
  const membership = await Member.findOne({
    where: { group_id: issue.group_id, account_id: req.account.id }
  });
  if (!membership) return res.status(403).json({ error: 'Not allowed.' });

  if (question.author_id !== req.account.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'You can only remove your own questions.' });
  }
  await question.destroy();
  res.json({ ok: true });
}));

// --- GET /api/questions/for-me/:issueId ---------------------
//  The questions aimed at me personally.
router.get('/for-me/:issueId', wrap(async (req, res) => {
  const asked = await AskedQuestion.findAll({
    where: { issue_id: req.params.issueId, target_id: req.account.id },
    include: [{ model: Account, as: 'author', attributes: ['id', 'first_name'] }]
  });
  res.json(asked);
}));

// ============================================================
//  REACTIONS
// ============================================================

// --- PUT /api/questions/reactions/:entryId ------------------
//  One reaction per person per page: you change yours, you do not
//  stack them. And you do not react to your own page.
router.put('/reactions/:entryId', wrap(async (req, res) => {
  const entry = await Entry.findByPk(req.params.entryId);
  if (!entry) return res.status(404).json({ error: 'Page not found.' });

  if (entry.account_id === req.account.id) {
    return res.status(400).json({ error: 'You cannot react to your own page.' });
  }

  const issue = await Issue.findByPk(entry.issue_id);
  if (issue.status !== 'published') {
    return res.status(403).json({ error: 'That issue is not published yet.' });
  }

  const membership = await Member.findOne({
    where: { group_id: issue.group_id, account_id: req.account.id }
  });
  if (!membership) return res.status(403).json({ error: 'Not allowed.' });

  const emoji = req.body.emoji ? String(req.body.emoji).slice(0, 8) : null;
  const word = req.body.word ? String(req.body.word).slice(0, 140) : null;

  const [reaction, created] = await Reaction.findOrCreate({
    where: { entry_id: entry.id, account_id: req.account.id },
    defaults: { id: uuid(), entry_id: entry.id, account_id: req.account.id, emoji, word }
  });
  if (!created) await reaction.update({ emoji, word });

  res.json(reaction);
}));

// --- DELETE /api/questions/reactions/:entryId ---------------
router.delete('/reactions/:entryId', wrap(async (req, res) => {
  await Reaction.destroy({
    where: { entry_id: req.params.entryId, account_id: req.account.id }
  });
  res.json({ ok: true });
}));

module.exports = router;
