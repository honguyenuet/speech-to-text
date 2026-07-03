require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'golden_voice',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Lỗi kết nối PostgreSQL:', err.message);
  } else {
    console.log('Đã kết nối PostgreSQL thành công');
    release();
  }
});

module.exports = pool;
