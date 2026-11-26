-- ============================================================
--  My Newsletter — MySQL schema
--  TI510M/TI610M Advanced Web Programming
--
--  Run once:
--      mysql -u root -p < server/sql/schema.sql
--
--  Ported from the original PostgreSQL schema. Main differences:
--    - uuid        -> CHAR(36)   (generated in Node, uuid v4)
--    - jsonb       -> JSON
--    - timestamptz -> DATETIME
--    - text[]      -> JSON array
--    - PostgreSQL row-level security has no MySQL equivalent, so
--      those rules are re-implemented in the Express middleware
--      (server/middleware/permissions.js).
-- ============================================================

-- This file is UTF-8: say so before anything else, or the accents
-- in the data inserted below arrive mangled.
SET NAMES utf8mb4;

DROP DATABASE IF EXISTS my_newsletter;
CREATE DATABASE my_newsletter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE my_newsletter;

-- ------------------------------------------------------------
-- 1. ACCOUNTS
--    Replaces Supabase's "profiles" + "auth.users".
--    The password is stored as a bcrypt hash: never in clear.
-- ------------------------------------------------------------
CREATE TABLE accounts (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  email       VARCHAR(190) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,          -- bcrypt hash, cost 12
  first_name  VARCHAR(80),
  avatar_url  VARCHAR(500),
  birthday    DATE,
  bio         TEXT,
  city        VARCHAR(120),
  occupation  VARCHAR(160),
  children    VARCHAR(255),
  pets        VARCHAR(255),
  fun_fact    TEXT,
  motto       VARCHAR(255),
  holidays    JSON,
  tutorial_seen BOOLEAN    NOT NULL DEFAULT FALSE,
  site_role   ENUM('member','admin') NOT NULL DEFAULT 'member',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_accounts_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. GROUPS
--    `groups` is a reserved word in MySQL 8 (window functions),
--    so it is written between backticks everywhere. Sequelize
--    quotes identifiers on its own.
-- ------------------------------------------------------------
CREATE TABLE `groups` (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  icon       VARCHAR(16)  DEFAULT '🎀',
  color      VARCHAR(16),
  created_by CHAR(36)     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_groups_creator FOREIGN KEY (created_by)
    REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. MEMBERS
--    You can invite someone by e-mail BEFORE they have an account:
--    account_id stays NULL, then fills in when they sign up.
-- ------------------------------------------------------------
CREATE TABLE members (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  group_id   CHAR(36)     NOT NULL,
  email      VARCHAR(190) NOT NULL,
  first_name VARCHAR(80),
  account_id CHAR(36),
  role       ENUM('member','admin') NOT NULL DEFAULT 'member',
  joined_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_members_group FOREIGN KEY (group_id)
    REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE SET NULL,
  UNIQUE KEY uq_member (group_id, email),
  INDEX idx_members_account (account_id),
  INDEX idx_members_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. ISSUES
--    One monthly issue per group. The questions drawn are frozen
--    as JSON when the issue opens, so an old issue keeps the
--    questions it was written against.
-- ------------------------------------------------------------
CREATE TABLE issues (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  group_id     CHAR(36) NOT NULL,
  number       INT      NOT NULL,
  month        DATE     NOT NULL,
  title        VARCHAR(190),
  status       ENUM('open','published') NOT NULL DEFAULT 'open',
  questions    JSON,
  color        VARCHAR(16),
  render       ENUM('bw','duo','color'),
  rendered_at  DATETIME,
  rendered_by  CHAR(36),
  published_at DATETIME,
  CONSTRAINT fk_issues_group FOREIGN KEY (group_id)
    REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_issues_rendered_by FOREIGN KEY (rendered_by)
    REFERENCES accounts(id) ON DELETE SET NULL,
  UNIQUE KEY uq_issue_month (group_id, month)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. ENTRIES — one person's page in one issue
-- ------------------------------------------------------------
CREATE TABLE entries (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  issue_id   CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  content    JSON,
  media      JSON,
  layout     JSON,
  sent       BOOLEAN  NOT NULL DEFAULT FALSE,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_entries_issue FOREIGN KEY (issue_id)
    REFERENCES issues(id) ON DELETE CASCADE,
  CONSTRAINT fk_entries_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_entry (issue_id, account_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. ASKED QUESTIONS — questions friends put to each other
-- ------------------------------------------------------------
CREATE TABLE asked_questions (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  issue_id    CHAR(36)     NOT NULL,
  author_id   CHAR(36)     NOT NULL,
  target_id   CHAR(36),
  text        VARCHAR(300) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_aq_issue FOREIGN KEY (issue_id)
    REFERENCES issues(id) ON DELETE CASCADE,
  CONSTRAINT fk_aq_author FOREIGN KEY (author_id)
    REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_aq_target FOREIGN KEY (target_id)
    REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. REACTIONS
-- ------------------------------------------------------------
CREATE TABLE reactions (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  entry_id   CHAR(36)     NOT NULL,
  account_id CHAR(36)     NOT NULL,
  emoji      VARCHAR(16),
  word       VARCHAR(140),
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reactions_entry FOREIGN KEY (entry_id)
    REFERENCES entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_reactions_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_reaction (entry_id, account_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8. DRAFTS — the single form, shared across every group
-- ------------------------------------------------------------
CREATE TABLE drafts (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  account_id CHAR(36) NOT NULL,
  month      DATE     NOT NULL,
  content    JSON,
  media      JSON,
  layout     JSON,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_drafts_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_draft (account_id, month)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 9. SETTINGS (key / value)
-- ------------------------------------------------------------
CREATE TABLE settings (
  `key`      VARCHAR(80) NOT NULL PRIMARY KEY,
  value      JSON        NOT NULL,
  updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
--  MAKING MONEY
-- ============================================================

-- ------------------------------------------------------------
-- 10. PLANS — the three add-ons sold separately
-- ------------------------------------------------------------
CREATE TABLE plans (
  code          VARCHAR(40)  NOT NULL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  description   VARCHAR(255),
  monthly_price DECIMAL(6,2) NOT NULL,
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order    INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 11. SUBSCRIPTIONS
--     add_ons = JSON array of plan codes.
--     The price is always recomputed server-side, with discounts.
-- ------------------------------------------------------------
CREATE TABLE subscriptions (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  account_id    CHAR(36)     NOT NULL,
  add_ons       JSON         NOT NULL,
  monthly_price DECIMAL(6,2) NOT NULL,
  savings       DECIMAL(6,2) NOT NULL DEFAULT 0,
  months        INT          NOT NULL DEFAULT 1,
  total_paid    DECIMAL(8,2) NOT NULL DEFAULT 0,
  status        ENUM('active','cancelled') NOT NULL DEFAULT 'active',
  started_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  renews_on     DATE,
  cancelled_at  DATETIME,
  CONSTRAINT fk_subs_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_subs_account (account_id, status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 12. PAYMENTS (simulated)
-- ------------------------------------------------------------
CREATE TABLE payments (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  account_id CHAR(36)     NOT NULL,
  amount     DECIMAL(8,2) NOT NULL,
  purpose    VARCHAR(190) NOT NULL,
  reference  VARCHAR(40)  NOT NULL,
  status     ENUM('succeeded','declined') NOT NULL DEFAULT 'succeeded',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_payments_date (created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 13. PAPER ORDERS
--     kind = a single issue, or the pack for a whole group.
--     pack_contents stays JSON: goodies can be added without
--     touching the code or the schema.
-- ------------------------------------------------------------
CREATE TABLE orders (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  account_id    CHAR(36)     NOT NULL,
  kind          ENUM('single_issue','group_pack') NOT NULL,
  issue_id      CHAR(36),
  group_id      CHAR(36),
  copies        INT          NOT NULL DEFAULT 1,
  pack_contents JSON,
  amount        DECIMAL(8,2) NOT NULL,
  address       JSON         NOT NULL,
  status        ENUM('paid','preparing','shipped') NOT NULL DEFAULT 'paid',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  shipped_at    DATETIME,
  CONSTRAINT fk_orders_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_issue FOREIGN KEY (issue_id)
    REFERENCES issues(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_group FOREIGN KEY (group_id)
    REFERENCES `groups`(id) ON DELETE SET NULL,
  INDEX idx_orders_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 14. ADS
--     Six slots. Subscribers to "no_ads" never receive any:
--     the filter runs server-side.
-- ------------------------------------------------------------
CREATE TABLE ads (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  title       VARCHAR(190) NOT NULL,
  image_url   VARCHAR(500) NOT NULL,
  link        VARCHAR(500),
  slot        ENUM('home_banner','groups_box','questionnaire_strip',
                   'paper_full_page','paper_footer','issues_square') NOT NULL,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  impressions INT          NOT NULL DEFAULT 0,
  clicks      INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ads_slot (slot, active)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 15. AD STATS (aggregated per day, for the admin dashboard)
-- ------------------------------------------------------------
CREATE TABLE ad_stats (
  ad_id       CHAR(36) NOT NULL,
  day         DATE     NOT NULL,
  impressions INT      NOT NULL DEFAULT 0,
  clicks      INT      NOT NULL DEFAULT 0,
  PRIMARY KEY (ad_id, day),
  CONSTRAINT fk_adstats_ad FOREIGN KEY (ad_id)
    REFERENCES ads(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 16. SESSIONS (used by express-mysql-session)
--     The module creates it on its own; written out here so the
--     schema is complete and readable.
-- ------------------------------------------------------------
CREATE TABLE sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires    INT UNSIGNED NOT NULL,
  data       MEDIUMTEXT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 17. ISSUE DELETION VOTES
--     Supprimer un numéro depuis la page du groupe. Une admin du
--     groupe supprime directement. N'importe qui d'autre doit
--     demander : une ligne par personne qui accepte, et le numéro
--     ne part que quand toutes ont accepté. La ligne de la
--     demandeuse est écrite avec la demande : demander = accepter.
-- ------------------------------------------------------------
CREATE TABLE issue_deletion_votes (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  issue_id     CHAR(36) NOT NULL,
  requested_by CHAR(36) NOT NULL,
  account_id   CHAR(36) NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_idv_issue FOREIGN KEY (issue_id)
    REFERENCES issues(id) ON DELETE CASCADE,
  CONSTRAINT fk_idv_requested_by FOREIGN KEY (requested_by)
    REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_idv_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_deletion_vote (issue_id, account_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 18. BANS
--     Bannir se fait au niveau du SITE, sur l'adresse e-mail et
--     non sur le compte : le compte peut avoir été détruit, et
--     c'est l'adresse qu'il faut empêcher de revenir. Contrôlée
--     à l'inscription et à la connexion.
--     kept_pages garde la trace de ce qu'on a décidé de faire de
--     ses pages au moment du bannissement.
-- ------------------------------------------------------------
CREATE TABLE bans (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  email      VARCHAR(190) NOT NULL UNIQUE,
  first_name VARCHAR(80),
  reason     VARCHAR(255),
  kept_pages BOOLEAN      NOT NULL DEFAULT TRUE,
  banned_by  CHAR(36),
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bans_banned_by FOREIGN KEY (banned_by)
    REFERENCES accounts(id) ON DELETE SET NULL,
  INDEX idx_bans_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 19. AUTH TOKENS
--     Forgotten password and change of e-mail address. There is
--     no mail service on this site, so the code is shown on
--     screen: it stands in for the e-mail you would receive.
--     The token itself is NEVER stored, only its SHA-256 hash —
--     same idea as bcrypt on the passwords. Single use
--     (used_at) and dated (expires_at).
-- ------------------------------------------------------------
CREATE TABLE auth_tokens (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  account_id CHAR(36) NOT NULL,
  purpose    ENUM('password_reset','email_change') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  new_email  VARCHAR(190),
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_account FOREIGN KEY (account_id)
    REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_tokens_hash (token_hash),
  INDEX idx_tokens_account (account_id, purpose)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 20. MAILS — the local mail catcher
--     This site sends no real mail. Instead, every message is
--     written here and read in /mailbox, exactly as MailHog or
--     Mailtrap do in development. The token travels in the link,
--     never on the screen of whoever asked for it.
--     Going live means one thing: handing these rows to an SMTP
--     service instead of storing them.
-- ------------------------------------------------------------
CREATE TABLE mails (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  to_email   VARCHAR(190) NOT NULL,
  subject    VARCHAR(190) NOT NULL,
  body       TEXT         NOT NULL,
  link       VARCHAR(500),
  read_at    DATETIME,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mails_to (to_email, created_at)
) ENGINE=InnoDB;

-- ============================================================
--  STARTING DATA
-- ============================================================

INSERT INTO plans (code, name, description, monthly_price, sort_order) VALUES
  ('unlimited_groups', 'Unlimited groups',
   'Past the 3 free groups, create as many as you like.', 2.99, 1),
  ('no_ads', 'No advertising',
   'No ads at all, neither on the site nor in the newspaper.', 1.99, 2),
  ('by_post', 'Newsletter by post',
   'Every issue printed on real newsprint, in your letterbox.', 4.99, 3);

INSERT INTO settings (`key`, value) VALUES
  ('two_add_on_discount', '0.20'),
  ('full_bundle_price',   '7.99'),
  ('free_groups',         '3'),
  ('single_issue_price',  '4.50'),
  ('group_pack_price',    '6.90');
