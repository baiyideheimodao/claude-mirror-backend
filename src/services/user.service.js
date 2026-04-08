const { pool } = require('../config/database')
const { generateId, successResponse, errorResponse } = require('../utils/helpers')

class UserService {
  /**
   * 获取用户Profile
   */
  async getProfile(userId) {
    const [rows] = await pool.execute(
      'SELECT username, email, avatar FROM users WHERE id = ? AND is_active = 1',
      [userId]
    )
    if (rows.length === 0) return errorResponse('用户不存在', 404)
    return successResponse(rows[0])
  }

  /**
   * 更新用户Profile
   */
  async updateProfile(userId, data) {
    const allowedFields = ['username', 'avatar']
    const updates = []
    const values = []
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(data[field])
      }
    }
    if (updates.length === 0) return errorResponse('没有需要更新的字段')

    values.push(userId)
    await pool.execute(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values)
    return successResponse(null, '更新成功')
  }

  /**
   * 获取可用套餐列表
   */
  async getPlans() {
    const [rows] = await pool.execute(
      'SELECT * FROM plans ORDER BY price ASC'
    )
    return successResponse(rows)
  }

  /**
   * 购买套餐
   */
  async buyPlan(userId, planId, paymentMethod) {
    const [plans] = await pool.execute('SELECT * FROM plans WHERE id = ?', [planId])
    if (plans.length === 0) return errorResponse('套餐不存在', 404)

    const plan = plans[0]
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    await pool.execute(
      `INSERT INTO payment_records (user_id, plan_id, amount, payment_method, transaction_id, status)
       VALUES (?, ?, ?, ?, ?, 'success')`,
      [userId, planId, plan.price, paymentMethod || 'alipay', transactionId]
    )

    return successResponse({
      plan,
      transaction_id: transactionId,
      status: 'success'
    }, '购买成功')
  }

  /**
   * 使用兑换码
   */
  async useRedemptionCode(userId, code) {
    const now = new Date()
    const [codes] = await pool.execute(
      'SELECT * FROM redemption_codes WHERE code = ? AND used_by IS NULL AND expires_at > ?',
      [code, now]
    )
    if (codes.length === 0) return errorResponse('兑换码无效或已过期')

    const rc = codes[0]
    await pool.execute(
      'UPDATE redemption_codes SET used_by = ?, used_at = NOW() WHERE id = ?',
      [userId, rc.id]
    )

    return successResponse({ code, plan_id: rc.plan_id }, '兑换成功')
  }

  /**
   * 获取对话历史（30天内）
   */
  async getDialogHistory(userId, page = 1, size = 20) {
    const offset = (page - 1) * size
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)

    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) as total FROM dialogs WHERE user_id = ? AND is_deleted = 0 AND last_message_at >= ?',
      [userId, thirtyDaysAgo]
    )

    const [items] = await pool.execute(
      'SELECT id, title, created_at, updated_at, last_message_at, is_pinned \
       FROM dialogs WHERE user_id = ? AND is_deleted = 0 AND last_message_at >= ? \
       ORDER BY is_pinned DESC, last_message_at DESC LIMIT ? OFFSET ?',
      [userId, thirtyDaysAgo, size, offset]
    )

    return successResponse({ total, items })
  }

  /**
   * 获取支付记录
   */
  async getPaymentRecords(userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM payment_records WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    )
    return successResponse(rows)
  }
}

module.exports = new UserService()
