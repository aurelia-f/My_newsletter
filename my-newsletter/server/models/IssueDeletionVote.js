const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One row per person who agrees to delete an issue. The person who
// asked gets a row too, written with the request: asking is agreeing.
// The issue is destroyed only once every member of the group who has
// an account has a row here.
const IssueDeletionVote = sequelize.define('IssueDeletionVote', {
  id:           { type: DataTypes.CHAR(36), primaryKey: true },
  issue_id:     { type: DataTypes.CHAR(36), allowNull: false },
  requested_by: { type: DataTypes.CHAR(36), allowNull: false },
  account_id:   { type: DataTypes.CHAR(36), allowNull: false },
  created_at:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'issue_deletion_votes' });

module.exports = IssueDeletionVote;