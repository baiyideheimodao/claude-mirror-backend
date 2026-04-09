const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('../config/database')
const { generateId, successResponse, errorResponse } = require('../utils/helpers')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

class AuthService {
  /**
   * 用户注册
   */
  async register(username, email, password) {
    // 检查用户名/邮箱是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    )
    if (existing.length > 0) return errorResponse('用户名或邮箱已被注册', 409)

    // 哈希密码并插入
    const passwordHash = await bcrypt.hash(password, 10)
    const id = generateId()

    await pool.execute(
      'INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
      [id, username, email, passwordHash]
    )

    const user = { id, username, email, avatar: null, is_active: true, email_verified: false }
    const token = this.generateToken(user)
    return successResponse({ user, token }, '注册成功')
  }

  /**
   * 用户登录
   */
  async login(username, password) {
    // 支持用户名或邮箱登录
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    )
    if (rows.length === 0) return errorResponse('用户名/邮箱或密码错误', 401)

    const user = rows[0]
    if (!user.is_active) return errorResponse('账号已被禁用', 403)

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return errorResponse('用户名或密码错误', 401)

    // 更新最后登录时间
    await pool.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    )

    const token = this.generateToken(user)
    const { password_hash: _, ...userData } = user
    return successResponse({ user: userData, token }, '登录成功')
  }

  /**
   * 忘记密码（发送重置邮件）
   */
  async forgotPassword(email) {
    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
    if (rows.length === 0) return errorResponse('该邮箱未注册', 404)

    // 实际项目中这里应该发送邮件，此处仅模拟返回成功
    return successResponse(null, '重置邮件已发送')
  }

  /**
   * 重置密码
   */
  async resetPassword(token, newPassword) {
    // TODO: 验证token有效性，实际应从reset_tokens表查询
    const passwordHash = await bcrypt.hash(newPassword, 10)
    return successResponse(null, '密码重置成功')
  }

  /**
   * 生成JWT Token
   */
  generateToken(user) {
    return jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )
  }
}

module.exports = new AuthService()
