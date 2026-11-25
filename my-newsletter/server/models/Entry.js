const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One person's page in one issue.
const Entry = sequelize.define('Entry', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  issue_id:   { type: DataTypes.CHAR(36), allowNull: false },
  account_id: { type: DataTypes.CHAR(36), allowNull: false },
  content:    { type: DataTypes.JSON, defaultValue: {} },
  media:      { type: DataTypes.JSON, defaultValue: [] },
  layout:     DataTypes.JSON,
  sent:       { type: DataTypes.BOOLEAN, defaultValue: false },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'entries' });

module.exports = Entry;
