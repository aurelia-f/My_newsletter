const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A monthly issue. The questions drawn are frozen as JSON when the
// issue opens: an old issue keeps the questions it was written
// against, even if the question bank changes later.
const Issue = sequelize.define('Issue', {
  id:           { type: DataTypes.CHAR(36), primaryKey: true },
  group_id:     { type: DataTypes.CHAR(36), allowNull: false },
  number:       { type: DataTypes.INTEGER, allowNull: false },
  month:        { type: DataTypes.DATEONLY, allowNull: false },
  title:        DataTypes.STRING(190),
  status:       { type: DataTypes.ENUM('open', 'published'), defaultValue: 'open' },
  questions:    { type: DataTypes.JSON, defaultValue: [] },
  color:        DataTypes.STRING(16),
  render:       DataTypes.ENUM('bw', 'duo', 'color'),
  rendered_at:  DataTypes.DATE,
  rendered_by:  DataTypes.CHAR(36),
  published_at: DataTypes.DATE
}, { tableName: 'issues' });

module.exports = Issue;
