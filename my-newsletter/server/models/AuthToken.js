const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

// A one-shot code, for a forgotten password or a change of
// address. What goes in the database is the SHA-256 of the code,
// never the code: even reading the table, you cannot use it.
const AuthToken = sequelize.define('AuthToken', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  account_id: { type: DataTypes.CHAR(36), allowNull: false },
  purpose:    { type: DataTypes.ENUM('password_reset', 'email_change'), allowNull: false },
  token_hash: { type: DataTypes.CHAR(64), allowNull: false },
  new_email:  DataTypes.STRING(190),
  expires_at: { type: DataTypes.DATE, allowNull: false },
  used_at:    DataTypes.DATE,
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'auth_tokens' });

AuthToken.hashOf = raw =>
  crypto.createHash('sha256').update(String(raw)).digest('hex');

// Draws a code, stores its hash, hands the code back ONCE.
AuthToken.issue = async function (accountId, purpose, minutes, extra = {}) {
  const raw = crypto.randomBytes(24).toString('hex');
  const row = await AuthToken.create({
    id: uuid(), account_id: accountId, purpose,
    token_hash: AuthToken.hashOf(raw),
    expires_at: new Date(Date.now() + minutes * 60000),
    ...extra
  });
  return { raw, row };
};

// Finds a code that is for the right purpose, unused, and still
// in date. Returns null otherwise: the caller never learns which
// of the three went wrong.
AuthToken.consume = async function (raw, purpose) {
  if (!raw) return null;
  return AuthToken.findOne({
    where: {
      token_hash: AuthToken.hashOf(raw), purpose, used_at: null,
      expires_at: { [Op.gt]: new Date() }
    }
  });
};

module.exports = AuthToken;