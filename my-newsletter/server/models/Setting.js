const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Key/value table: prices, free quota, discounts.
// Editable from the admin area without touching the code.
const Setting = sequelize.define('Setting', {
  key:        { type: DataTypes.STRING(80), primaryKey: true, field: 'key' },
  value:      { type: DataTypes.JSON, allowNull: false },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'settings' });

// Shortcut: read a setting and turn it into a number.
Setting.number = async function (key, fallback) {
  const row = await Setting.findByPk(key);
  if (!row) return fallback;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = Setting;
