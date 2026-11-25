// ============================================================
//  MySQL connection with Sequelize (lecture CM5).
//  The mysql2 driver is installed separately: npm install mysql2
// ============================================================
require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    logging: false,
    define: { timestamps: false, freezeTableName: true },
    pool: { max: 10, min: 0, idle: 10000 }
  }
);

// Check the connection works when the server starts.
async function checkConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅  Connected to MySQL database "%s"', process.env.DB_NAME);
  } catch (error) {
    console.error('❌  Cannot connect:', error.message);
    throw error;
  }
}

module.exports = { sequelize, checkConnection };
