const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A paper order: a single issue, or the pack for a whole group.
// pack_contents is JSON so goodies can be added (sticker of the
// month, postcards…) without a database migration.
const Order = sequelize.define('Order', {
  id:            { type: DataTypes.CHAR(36), primaryKey: true },
  account_id:    { type: DataTypes.CHAR(36), allowNull: false },
  kind:          { type: DataTypes.ENUM('single_issue', 'group_pack'), allowNull: false },
  issue_id:      DataTypes.CHAR(36),
  group_id:      DataTypes.CHAR(36),
  copies:        { type: DataTypes.INTEGER, defaultValue: 1 },
  pack_contents: { type: DataTypes.JSON, defaultValue: [] },
  amount:        { type: DataTypes.DECIMAL(8, 2), allowNull: false,
                   get() { return Number(this.getDataValue('amount')); } },
  address:       { type: DataTypes.JSON, allowNull: false },
  status:        { type: DataTypes.ENUM('paid', 'preparing', 'shipped'),
                   defaultValue: 'paid' },
  created_at:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  shipped_at:    DataTypes.DATE
}, { tableName: 'orders' });

module.exports = Order;
