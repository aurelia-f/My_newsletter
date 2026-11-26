const { v4: uuid } = require('uuid');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A message "sent" by the site. Nothing leaves the server: the
// row IS the mail, and /mailbox is the inbox. Mail.send() is the
// only door in, so the day a real SMTP service arrives, this one
// function changes and nothing else does.
const Mail = sequelize.define('Mail', {
  id:         { type: DataTypes.CHAR(36), primaryKey: true },
  to_email:   { type: DataTypes.STRING(190), allowNull: false },
  subject:    { type: DataTypes.STRING(190), allowNull: false },
  body:       { type: DataTypes.TEXT, allowNull: false },
  link:       DataTypes.STRING(500),
  read_at:    DataTypes.DATE,
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'mails' });

Mail.send = function ({ to, subject, body, link = null }) {
  return Mail.create({
    id: uuid(), to_email: String(to).trim().toLowerCase(),
    subject, body, link
  });
};

module.exports = Mail;