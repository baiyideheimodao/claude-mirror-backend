const { pool } = require('../config/database')
const { generateId, generateRedemptionCode, successResponse, errorResponse } = require('../utils/helpers')

class AdminService {
  /**
   * 获取用户列表（分页）
   */
  async getUsers(page = 1, size = 20, keyword = '') {
    const offset = (page - 1) * size
    let whereSql = ''
    let params = []

    if (keyword) {
      whereSql = 'WHERE username LIKE ? OR email LIKE ?'
      params = [`%${keyword}%`, `%${keyword}%`]
    }

    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM users ${whereSql}`, params)

    const [users] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.is_active, u.created_at, u.last_login,
              (SELECT COUNT(*) FROM dialogs d WHERE d.user_id = u.id AND d.is_deleted=0) as usage_count
       FROM users u ${whereSql} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    )

    return successResponse({ total, items: users })
  }

  /**
   * 启用/禁用用户
   */
  async toggleUserStatus(userId, isActive) {
    const [result] = await pool.execute(
      'UPDATE users SET is_active = ? WHERE id = ?', [+isActive, userId]
    )
    if (result.affectedRows === 0) return errorResponse('用户不存在', 404)
    return successResponse(null, isActive ? '用户已启用' : '用户已禁用')
  }

  /**
   * 创建套餐
   */
  async createPlan(planData) {
    const [result] = await pool.execute(
      'INSERT INTO plans (name, description, duration_days, hourly_limit, daily_limit, price) VALUES (?, ?, ?, ?, ?, ?)',
      [planData.name, planData.description, planData.duration_days, planData.hourly_limit, planData.daily_limit, planData.price]
    )

    const [[plan]] = await pool.execute('SELECT * FROM plans WHERE id = ?', [result.insertId])
    return successResponse(plan, '套餐创建成功', 201)
  }

  /**
   * 批量生成兑换码
   */
  async generateRedemptionCodes(planId, count, expiresAt) {
    const codes = []
    const createdBy = 'system' // 应从JWT获取管理员ID

    for (let i = 0; i < count; i++) {
      const code = generateRedemptionCode()
      await pool.execute(
        'INSERT INTO redemption_codes (code, plan_id, expires_at, created_by) VALUES (?, ?, ?, ?)',
        [code, planId, expiresAt, createdBy]
      )
      codes.push(code)
    }

    return successResponse({ codes, count }, `成功生成${count}个兑换码`, 201)
  }

  /**
   * 获取统计信息
   */
  async getStats(type, startDate, endDate) {
    let dateCondition = ''
    const params = []

    if (startDate && endDate) {
      dateCondition = 'WHERE date BETWEEN ? AND ?'
      params.push(startDate, endDate)
    }

    const [stats] = await pool.execute(
      `SELECT date, call_count, active_users, revenue, model_usage
       FROM stats ${dateCondition} ORDER BY date ASC`,
      params
    )

    return successResponse(stats)
  }
}

module.exports = new AdminService()
