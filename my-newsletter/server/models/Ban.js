const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A banned e-mail address. We ban the ADDRESS, not the account:
// the account may well have been destroyed, and what has to be
// stopped is the address coming back.
const Ban = sequelize.define('Ban', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  email:      { type: DataTypes.STRING(190), allowNull: false, unique: true },
  first_name: DataTypes.STRING(80),
  reason:     DataTypes.STRING(255),
  kept_pages: { type: DataTypes.BOOLEAN, defaultValue: true },
  banned_by:  DataTypes.CHAR(36),
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'bans' });

// Asked at sign-up and at sign-in.
Ban.isBanned = async function (email) {
  if (!email) return false;
  const found = await Ban.findOne({
    where: { email: String(email).trim().toLowerCase() }
  });
  return !!found;
};

module.exports = Ban;