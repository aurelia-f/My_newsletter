// ============================================================
//  Every model, and the associations between them.
//  This is the only place where relations are declared.
// ============================================================
const { sequelize } = require('../config/database');

const Account       = require('./Account');
const Group         = require('./Group');
const Member        = require('./Member');
const Issue         = require('./Issue');
const Entry         = require('./Entry');
const AskedQuestion = require('./AskedQuestion');
const Reaction      = require('./Reaction');
const Draft         = require('./Draft');
const Setting       = require('./Setting');
const Plan          = require('./Plan');
const Subscription  = require('./Subscription');
const Payment       = require('./Payment');
const Order         = require('./Order');
const Ad            = require('./Ad');
const AdStat        = require('./AdStat');
const IssueDeletionVote = require('./IssueDeletionVote');
const Ban = require('./Ban');
const AuthToken = require('./AuthToken');
const Mail = require('./Mail');

// --- Groups and members -------------------------------------
Account.hasMany(Group,   { foreignKey: 'created_by', as: 'createdGroups' });
Group.belongsTo(Account, { foreignKey: 'created_by', as: 'creator' });

Group.hasMany(Member,    { foreignKey: 'group_id', as: 'members', onDelete: 'CASCADE' });
Member.belongsTo(Group,  { foreignKey: 'group_id', as: 'group' });

Account.hasMany(Member,  { foreignKey: 'account_id', as: 'memberships' });
Member.belongsTo(Account,{ foreignKey: 'account_id', as: 'account' });

// --- Issues and entries -------------------------------------
Group.hasMany(Issue,     { foreignKey: 'group_id', as: 'issues', onDelete: 'CASCADE' });
Issue.belongsTo(Group,   { foreignKey: 'group_id', as: 'group' });

Issue.hasMany(Entry,     { foreignKey: 'issue_id', as: 'entries', onDelete: 'CASCADE' });
Entry.belongsTo(Issue,   { foreignKey: 'issue_id', as: 'issue' });

Account.hasMany(Entry,   { foreignKey: 'account_id', as: 'entries' });
Entry.belongsTo(Account, { foreignKey: 'account_id', as: 'author' });

Issue.hasMany(IssueDeletionVote,     { foreignKey: 'issue_id', as: 'deletionVotes', onDelete: 'CASCADE' });
IssueDeletionVote.belongsTo(Issue,   { foreignKey: 'issue_id', as: 'issue' });
IssueDeletionVote.belongsTo(Account, { foreignKey: 'account_id', as: 'voter' });
IssueDeletionVote.belongsTo(Account, { foreignKey: 'requested_by', as: 'requester' });

// --- Questions between friends ------------------------------
Issue.hasMany(AskedQuestion,    { foreignKey: 'issue_id', as: 'askedQuestions', onDelete: 'CASCADE' });
AskedQuestion.belongsTo(Issue,  { foreignKey: 'issue_id', as: 'issue' });
AskedQuestion.belongsTo(Account,{ foreignKey: 'author_id', as: 'author' });
AskedQuestion.belongsTo(Account,{ foreignKey: 'target_id', as: 'target' });

// --- Reactions ----------------------------------------------
Entry.hasMany(Reaction,     { foreignKey: 'entry_id', as: 'reactions', onDelete: 'CASCADE' });
Reaction.belongsTo(Entry,   { foreignKey: 'entry_id', as: 'entry' });
Reaction.belongsTo(Account, { foreignKey: 'account_id', as: 'author' });

// --- Drafts -------------------------------------------------
Account.hasMany(Draft,   { foreignKey: 'account_id', as: 'drafts' });
Draft.belongsTo(Account, { foreignKey: 'account_id', as: 'account' });

// --- Banned addresses ---------------------------------------
Ban.belongsTo(Account, { foreignKey: 'banned_by', as: 'bannedBy' });

// --- One-shot codes -----------------------------------------
Account.hasMany(AuthToken,     { foreignKey: 'account_id', as: 'authTokens', onDelete: 'CASCADE' });
AuthToken.belongsTo(Account,   { foreignKey: 'account_id', as: 'account' });

// --- The mail catcher ---------------------------------------
//  Deliberately tied to nothing: a mail is addressed to an e-mail
//  ADDRESS, which may belong to no account at all.

// --- One-shot codes -----------------------------------------
Account.hasMany(AuthToken,     { foreignKey: 'account_id', as: 'authTokens', onDelete: 'CASCADE' });
AuthToken.belongsTo(Account,   { foreignKey: 'account_id', as: 'account' });

// --- Making money -------------------------------------------
Account.hasMany(Subscription,   { foreignKey: 'account_id', as: 'subscriptions' });
Subscription.belongsTo(Account, { foreignKey: 'account_id', as: 'account' });

Account.hasMany(Payment,   { foreignKey: 'account_id', as: 'payments' });
Payment.belongsTo(Account, { foreignKey: 'account_id', as: 'account' });

Account.hasMany(Order,   { foreignKey: 'account_id', as: 'orders' });
Order.belongsTo(Account, { foreignKey: 'account_id', as: 'account' });
Order.belongsTo(Issue,   { foreignKey: 'issue_id', as: 'issue' });
Order.belongsTo(Group,   { foreignKey: 'group_id', as: 'group' });

Ad.hasMany(AdStat,     { foreignKey: 'ad_id', as: 'stats', onDelete: 'CASCADE' });
AdStat.belongsTo(Ad,   { foreignKey: 'ad_id', as: 'ad' });

module.exports = {
  sequelize,
  Account, Group, Member, Issue, Entry, AskedQuestion, Reaction,
  Draft, Setting, Plan, Subscription, Payment, Order, Ad, AdStat, IssueDeletionVote, Ban, AuthToken, Mail
};
