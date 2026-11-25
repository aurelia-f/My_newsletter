const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One reaction per person per page: you change yours, you do not
// stack them up (unique constraint in the database).
const Reaction = sequelize.define('Reaction', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  entry_id:   { type: DataTypes.CHAR(36), allowNull: false },
  account_id: { type: DataTypes.CHAR(36), allowNull: false },
  emoji:      DataTypes.STRING(16),
  word:       DataTypes.STRING(140),
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'reactions' });

module.exports = Reaction;
