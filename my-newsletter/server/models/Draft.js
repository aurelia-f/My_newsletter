const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// The month's single form: private, shared across every group.
const Draft = sequelize.define('Draft', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  account_id: { type: DataTypes.CHAR(36), allowNull: false },
  month:      { type: DataTypes.DATEONLY, allowNull: false },
  content:    { type: DataTypes.JSON, defaultValue: {} },
  media:      { type: DataTypes.JSON, defaultValue: [] },
  layout:     DataTypes.JSON,
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'drafts' });

module.exports = Draft;
