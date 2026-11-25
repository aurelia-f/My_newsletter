const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A question put by a friend, to the whole group or to one person.
const AskedQuestion = sequelize.define('AskedQuestion', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  issue_id:   { type: DataTypes.CHAR(36), allowNull: false },
  author_id:  { type: DataTypes.CHAR(36), allowNull: false },
  target_id:  DataTypes.CHAR(36),
  text:       { type: DataTypes.STRING(300), allowNull: false,
                validate: { len: [3, 300] } },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'asked_questions' });

module.exports = AskedQuestion;
