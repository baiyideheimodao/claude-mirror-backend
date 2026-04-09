const mysql = require('mysql2/promise')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'claude',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
})

// 测试连接
pool.getConnection()
  .then(conn => {
    console.log('[MySQL] 数据库连接成功:', process.env.DB_NAME)
    conn.release()
  })
  .catch(err => {
    console.error('[MySQL] 数据库连接失败:', err.message)
  })

module.exports = { pool }
