// ============================================================
//  Issues: open, publish, choose the rendering.
//
//  ANY member can OPEN an issue.
//  Only an admin can PUBLISH it: that is the gesture that makes
//  everyone's pages visible to the whole group.
// ============================================================
const express = require('express');
const { Op } = require('sequelize');
const { v4: uuid } = require('uuid');
const { Account, Issue, Group, Member, Entry, Reaction } = require('../models');
const { questionsForMonth } = require('../config/questions');
const { wrap } = require('../middleware/errors');
const {
  requireLogin, requireMember, requireGroupAdmin, byIssue
} = require('../middleware/permissions');

const router = express.Router();
router.use(requireLogin);

/** Puts a group's issues back in chronological order. */
async function renumber(groupId) {
  const issues = await Issue.findAll({
    where: { group_id: groupId }, order: [['month', 'ASC']]
  });
  for (const [i, issue] of issues.entries()) {
    if (issue.number !== i + 1) await issue.update({ number: i + 1 });
  }
}

/** The 1st of the month, shifted by `n` months, as 'YYYY-MM-01'. */
function shiftedMonth(n) {
  const d = new Date();
  const total = d.getFullYear() * 12 + d.getMonth() + n;
  const year = Math.floor(total / 12);
  const month = String((total % 12) + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

// --- GET /api/issues/open -----------------------------------
//  The open issues of all my groups, for the single questionnaire.
router.get('/open', wrap(async (req, res) => {
  const mine = (await Member.findAll({
    where: { account_id: req.account.id }, attributes: ['group_id']
  })).map(m => m.group_id);

  if (mine.length === 0) return res.json([]);

  const issues = await Issue.findAll({
    where: { group_id: mine, status: 'open' },
    include: [{ model: Group, as: 'group' }],
    order: [['month', 'DESC']]
  });

  // Have I already sent my page to this group?
  const withState = await Promise.all(issues.map(async issue => {
    const mineEntry = await Entry.findOne({
      where: { issue_id: issue.id, account_id: req.account.id }
    });
    return { ...issue.toJSON(), already_sent: !!(mineEntry && mineEntry.sent) };
  }));

  res.json(withState);
}));

// --- GET /api/issues/mine -----------------------------------
router.get('/mine', wrap(async (req, res) => {
  const mine = (await Member.findAll({
    where: { account_id: req.account.id }, attributes: ['group_id']
  })).map(m => m.group_id);

  if (mine.length === 0) return res.json([]);

  const issues = await Issue.findAll({
    where: { group_id: mine, status: 'published' },
    include: [{ model: Group, as: 'group' }],
    order: [['published_at', 'DESC']]
  });
  res.json(issues);
}));

// --- POST /api/issues ---------------------------------------
//  Open a month's issue. Any member may do this.
router.post('/', requireMember, wrap(async (req, res) => {
  const groupId = req.body.group_id;
  const month = String(req.body.month || '').slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Month should look like YYYY-MM-01.' });
  }

  // Only the current month or one of the three before it.
  // We compare STRINGS 'YYYY-MM-01' rather than Date objects:
  // otherwise, depending on the server's time zone, "2026-11-01"
  // read as UTC lands before the 1st of November built in local
  // time, and the current month gets refused.
  if (month < shiftedMonth(-3) || month > shiftedMonth(0)) {
    return res.status(400).json({ error: 'That month cannot be opened.' });
  }

  const existing = await Issue.findOne({ where: { group_id: groupId, month } });
  if (existing) return res.json(existing);

  const earlier = await Issue.count({
    where: { group_id: groupId, month: { [Op.lt]: month } }
  });

  // The questions are drawn HERE, then frozen: an old issue keeps
  // its original questions even if the bank changes.
  const issue = await Issue.create({
    id: uuid(), group_id: groupId, number: earlier + 1,
    month, status: 'open', questions: questionsForMonth(month)
  });

  await renumber(groupId);
  res.status(201).json(await Issue.findByPk(issue.id));
}));

// --- GET /api/issues/:id ------------------------------------
//  The issue, with its entries.
//  While it is OPEN each person sees only her own: the surprise
//  of publication day is preserved.
router.get('/:id', byIssue(requireMember), wrap(async (req, res) => {
  const issue = req.issue;
  const group = await Group.findByPk(issue.group_id);

  const where = issue.status === 'published'
    ? { issue_id: issue.id, sent: true }
    : { issue_id: issue.id, account_id: req.account.id };

  const entries = await Entry.findAll({
    where,
    include: [{ model: Account, as: 'author',
                attributes: ['id', 'first_name', 'avatar_url', 'motto',
                             'occupation', 'birthday'] }],
    order: [['updated_at', 'ASC']]
  });

  // Reactions only on a published issue.
  let reactions = [];
  if (issue.status === 'published' && entries.length) {
    reactions = await Reaction.findAll({
      where: { entry_id: entries.map(e => e.id) },
      include: [{ model: Account, as: 'author', attributes: ['id', 'first_name'] }]
    });
  }

  res.json({
    ...issue.toJSON(),
    group,
    my_role: req.membership.role,
    entries,
    reactions
  });
}));

// --- POST /api/issues/:id/publish ---------------------------
//  Group admins only.
router.post('/:id/publish', byIssue(requireGroupAdmin), wrap(async (req, res) => {
  const issue = req.issue;
  if (issue.status === 'published') {
    return res.status(409).json({ error: 'That issue is already published.' });
  }

  // An issue with no entries is not published: it would leave an
  // empty hole in the archive.
  const count = await Entry.count({ where: { issue_id: issue.id, sent: true } });
  if (count === 0) {
    return res.status(400).json({ error: 'Nobody has sent their page yet.' });
  }

  await issue.update({ status: 'published', published_at: new Date() });
  res.json(issue);
}));

// --- PATCH /api/issues/:id/render ---------------------------
//  Black and white, duotone, or colour.
//  The FIRST person to choose sets it for the whole group; after
//  that, only an admin can change it.
router.patch('/:id/render', byIssue(requireMember), wrap(async (req, res) => {
  const issue = req.issue;
  const render = req.body.render;

  if (!['bw', 'duo', 'color'].includes(render)) {
    return res.status(400).json({ error: 'Unknown rendering.' });
  }
  if (issue.render && req.membership.role !== 'admin') {
    return res.status(403).json({
      error: 'The rendering is already set. Only an admin can change it.'
    });
  }

  await issue.update({
    render,
    // In black and white the colour is meaningless, so we clear it.
    color: render === 'bw' ? null : (req.body.color || issue.color),
    rendered_at: new Date(), rendered_by: req.account.id
  });
  res.json(issue);
}));

// --- DELETE /api/issues/:id ---------------------------------
router.delete('/:id', byIssue(requireGroupAdmin), wrap(async (req, res) => {
  const groupId = req.issue.group_id;
  await req.issue.destroy();
  await renumber(groupId);
  res.json({ ok: true });
}));

module.exports = router;
module.exports.renumber = renumber;
module.exports.shiftedMonth = shiftedMonth;
