const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// The three add-ons on sale: unlimited groups, no ads, by post.
const Plan = sequelize.define('Plan', {
  code:          { type: DataTypes.STRING(40), primaryKey: true },
  name:          { type: DataTypes.STRING(120), allowNull: false },
  description:   DataTypes.STRING(255),
  monthly_price: { type: DataTypes.DECIMAL(6, 2), allowNull: false,
                   get() { return Number(this.getDataValue('monthly_price')); } },
  active:        { type: DataTypes.BOOLEAN, defaultValue: true },
  sort_order:    { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'plans' });

module.exports = Plan;
