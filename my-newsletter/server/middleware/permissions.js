// ============================================================
//  The access guards.
//
//  With Supabase, PostgreSQL row-level security stopped you from
//  reading a group you do not belong to. MySQL has no RLS, so
//  those rules live HERE, in Express middleware, and run BEFORE
//  any query reaches the database.
//
//  The rule is unchanged: you only see the groups you belong to,
//  and only an admin publishes an issue.
// ============================================================
const { Member, Group, Issue, Subscription, Setting } = require('../models');

/** You must be signed in: the session carries the account id. */
function requireLogin(req, res, next) {
  if (!req.session || !req.session.accountId) {
    return res.status(401).json({ error: 'You need to be signed in.' });
  }
  next();
}

/** You must be a SITE admin (one of us, the creators). */
function requireSiteAdmin(req, res, next) {
  if (!req.account || req.account.site_role !== 'admin') {
    return res.status(403).json({ error: 'This area is for the team only.' });
  }
  next();
}

/**
 * You must belong to the group in question.
 * The group is looked for in the URL, then in the request body.
 * The membership found is left on req.membership for what follows.
 */
async function requireMember(req, res, next) {
  const groupId = req.params.groupId || req.params.id || req.body.group_id;
  if (!groupId) return res.status(400).json({ error: 'Missing group.' });

  const membership = await Member.findOne({
    where: { group_id: groupId, account_id: req.session.accountId }
  });
  if (!membership) {
    return res.status(403).json({ error: 'You are not in this group.' });
  }
  req.membership = membership;
  req.groupId = groupId;
  next();
}

/** You must be a GROUP admin (its creator, or a co-admin). */
async function requireGroupAdmin(req, res, next) {
  const groupId = req.params.groupId || req.params.id || req.body.group_id;
  if (!groupId) return res.status(400).json({ error: 'Missing group.' });

  const membership = await Member.findOne({
    where: { group_id: groupId, account_id: req.session.accountId, role: 'admin' }
  });
  if (!membership) {
    return res.status(403).json({ error: 'Only group admins can do that.' });
  }
  req.membership = membership;
  req.groupId = groupId;
  next();
}

/**
 * Same thing, but the group is worked out from the issue.
 * Used by the /api/issues/:id/... routes.
 */
function byIssue(middleware) {
  return async (req, res, next) => {
    const issue = await Issue.findByPk(req.params.id || req.params.issueId);
    if (!issue) return res.status(404).json({ error: 'Issue not found.' });
    req.issue = issue;
    req.params.groupId = issue.group_id;
    return middleware(req, res, next);
  };
}

/**
 * The free quota: three groups created.
 * Past that you need the "unlimited_groups" add-on.
 * Locked here, not just in the interface: even by tampering with
 * the request, you do not get a fourth group without subscribing.
 */
async function groupQuota(req, res, next) {
  const free = await Setting.number('free_groups', 3);
  const alreadyCreated = await Group.count({
    where: { created_by: req.session.accountId }
  });

  if (alreadyCreated < free) return next();

  const unlimited = await Subscription.hasAddOn(req.session.accountId, 'unlimited_groups');
  if (unlimited) return next();

  return res.status(402).json({
    error: `You have used your ${free} free groups.`,
    quota: { free, alreadyCreated },
    required_add_on: 'unlimited_groups'
  });
}

module.exports = {
  requireLogin, requireSiteAdmin, requireMember,
  requireGroupAdmin, byIssue, groupQuota
};
