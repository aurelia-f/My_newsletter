const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// SIMULATED payments: no real card is ever charged.
// We still keep the trace, so the admin dashboard has real figures.
const Payment = sequelize.define('Payment', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  account_id: { type: DataTypes.CHAR(36), allowNull: false },
  amount:     { type: DataTypes.DECIMAL(8, 2), allowNull: false,
                get() { return Number(this.getDataValue('amount')); } },
  purpose:    { type: DataTypes.STRING(190), allowNull: false },
  reference:  { type: DataTypes.STRING(40), allowNull: false },
  status:     { type: DataTypes.ENUM('succeeded', 'declined'), defaultValue: 'succeeded' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'payments' });

module.exports = Payment;
