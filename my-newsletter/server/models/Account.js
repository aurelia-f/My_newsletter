const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A registered person. The password is NEVER stored in clear:
// we keep only its bcrypt hash (lecture CM5, "Authentication").
const Account = sequelize.define('Account', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  email:      { type: DataTypes.STRING(190), allowNull: false, unique: true,
                validate: { isEmail: true } },
  password:   { type: DataTypes.STRING(255), allowNull: false },
  first_name: DataTypes.STRING(80),
  avatar_url: DataTypes.STRING(500),
  birthday:   DataTypes.DATEONLY,
  bio:        DataTypes.TEXT,
  city:       DataTypes.STRING(120),
  occupation: DataTypes.STRING(160),
  children:   DataTypes.STRING(255),
  pets:       DataTypes.STRING(255),
  fun_fact:   DataTypes.TEXT,
  motto:      DataTypes.STRING(255),
  holidays:   { type: DataTypes.JSON, defaultValue: [] },
  tutorial_seen: { type: DataTypes.BOOLEAN, defaultValue: false },
  site_role:  { type: DataTypes.ENUM('member', 'admin'), defaultValue: 'member' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'accounts' });

// What we are allowed to send to the browser: never the hash.
Account.prototype.toPublic = function () {
  const { password, ...rest } = this.toJSON();
  return rest;
};

module.exports = Account;
