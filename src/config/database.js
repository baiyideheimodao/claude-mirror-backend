const mysql = require('mysql2/promise')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

// 主库连接池（默认库）
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

// Admin 库连接池（套餐、options 等表）
const adminPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_ADMIN_NAME || 'claude_admin',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
})

// 测试主库连接
pool.getConnection()
  .then(conn => {
    console.log('[MySQL] 数据库连接成功:', process.env.DB_NAME)
    conn.release()
  })
  .catch(err => {
    console.error('[MySQL] 数据库连接失败:', err.message)
  })

// 测试Admin库连接
adminPool.getConnection()
  .then(conn => {
    console.log('[MySQL] Admin库连接成功:', process.env.DB_ADMIN_NAME || 'claude_admin')
    conn.release()
  })
  .catch(err => {
    console.error('[MySQL] Admin库连接失败:', err.message)
  })

module.exports = { pool, adminPool }
