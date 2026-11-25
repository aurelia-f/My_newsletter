const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Impressions and clicks per day, for the admin charts.
const AdStat = sequelize.define('AdStat', {
  ad_id:       { type: DataTypes.CHAR(36), primaryKey: true },
  day:         { type: DataTypes.DATEONLY, primaryKey: true },
  impressions: { type: DataTypes.INTEGER, defaultValue: 0 },
  clicks:      { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'ad_stats' });

module.exports = AdStat;
