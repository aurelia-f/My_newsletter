const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A subscription is a list of add-ons bundled together.
// The price is ALWAYS recomputed server-side (services/pricing.js):
// the browser does not get to decide what someone pays.
const Subscription = sequelize.define('Subscription', {
  id:            { type: DataTypes.CHAR(36), primaryKey: true },
  account_id:    { type: DataTypes.CHAR(36), allowNull: false },
  add_ons:       { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  monthly_price: { type: DataTypes.DECIMAL(6, 2), allowNull: false,
                   get() { return Number(this.getDataValue('monthly_price')); } },
  savings:       { type: DataTypes.DECIMAL(6, 2), defaultValue: 0,
                   get() { return Number(this.getDataValue('savings')); } },
                     months:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  total_paid:    { type: DataTypes.DECIMAL(8, 2), defaultValue: 0,
                   get() { return Number(this.getDataValue('total_paid')); } },
  status:        { type: DataTypes.ENUM('active', 'cancelled'), defaultValue: 'active' },
  started_at:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  renews_on:     DataTypes.DATEONLY,
  cancelled_at:  DataTypes.DATE
}, { tableName: 'subscriptions' });

// Does this account have the add-on we are asking about?
Subscription.hasAddOn = async function (accountId, code) {
  const sub = await Subscription.findOne({
    where: { account_id: accountId, status: 'active' }
  });
  return !!sub && Array.isArray(sub.add_ons) && sub.add_ons.includes(code);
};

module.exports = Subscription;
