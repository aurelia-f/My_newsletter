const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Someone can be invited BEFORE they have an account: account_id
// stays null, then fills in on its own when they sign up.
const Member = sequelize.define('Member', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  group_id:   { type: DataTypes.CHAR(36), allowNull: false },
  email:      { type: DataTypes.STRING(190), allowNull: false },
  first_name: DataTypes.STRING(80),
  account_id: DataTypes.CHAR(36),
  role:       { type: DataTypes.ENUM('member', 'admin'), defaultValue: 'member' },
  joined_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'members' });

module.exports = Member;
