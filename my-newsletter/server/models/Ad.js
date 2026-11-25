const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// The six advertising slots on the site.
const SLOTS = [
  'home_banner',          //  970 x 250
  'groups_box',           //  300 x 250
  'questionnaire_strip',  //  728 x 90
  'paper_full_page',      // 1240 x 1754 (A4)
  'paper_footer',         //  900 x 150
  'issues_square'         //  300 x 300
];

const Ad = sequelize.define('Ad', {
  id:          { type: DataTypes.CHAR(36), primaryKey: true },
  title:       { type: DataTypes.STRING(190), allowNull: false },
  image_url:   { type: DataTypes.STRING(500), allowNull: false },
  link:        DataTypes.STRING(500),
  slot:        { type: DataTypes.ENUM(...SLOTS), allowNull: false },
  active:      { type: DataTypes.BOOLEAN, defaultValue: true },
  impressions: { type: DataTypes.INTEGER, defaultValue: 0 },
  clicks:      { type: DataTypes.INTEGER, defaultValue: 0 },
  created_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'ads' });

Ad.SLOTS = SLOTS;

// The sizes expected, shown in the admin area.
Ad.FORMATS = {
  home_banner:         { width:  970, height:  250, name: 'Home banner' },
  groups_box:          { width:  300, height:  250, name: '"My groups" box' },
  questionnaire_strip: { width:  728, height:   90, name: 'Questionnaire strip' },
  paper_full_page:     { width: 1240, height: 1754, name: 'Newspaper full page' },
  paper_footer:        { width:  900, height:  150, name: 'Newspaper footer' },
  issues_square:       { width:  300, height:  300, name: '"My issues" square' }
};

module.exports = Ad;
