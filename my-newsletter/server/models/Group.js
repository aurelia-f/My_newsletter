const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Group = sequelize.define('Group', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  name:       { type: DataTypes.STRING(120), allowNull: false },
  icon:       { type: DataTypes.STRING(16), defaultValue: '🎀' },
  color:      DataTypes.STRING(16),
  created_by: { type: DataTypes.CHAR(36), allowNull: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'groups' });

module.exports = Group;
