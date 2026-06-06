const mysql = require('mysql2/promise');

let pool = null;

function buatPool() {
  const socketPath = process.env.CLOUD_SQL_CONNECTION_NAME
    ? `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`
    : null;

  const config = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kasir_roku',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true, // FIX: kembalikan DATE/DATETIME sebagai string, bukan Date object
    ...(socketPath
      ? { socketPath }
      : { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT) || 3306 })
  };

  return mysql.createPool(config);
}

function ambilPool() {
  if (!pool) {
    pool = buatPool();
  }
  return pool;
}

module.exports = { ambilPool };
