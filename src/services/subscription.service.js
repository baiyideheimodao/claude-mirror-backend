const { adminPool } = require('../config/database')
const { successResponse, errorResponse } = require('../utils/helpers')

class SubscriptionService {
  /**
   * 获取套餐列表（包含剩余可用的兑换码数量）
   */
  async getPlansWithRedemptionCounts() {
    const [plans] = await adminPool.execute(
      `SELECT 
        p.id, p.title as name, p.subtitle as description, p.price_amount as price, 
        p.total_amount as credits_per_month, p.enabled as is_active, p.created_at,
        (SELECT COUNT(*) FROM redemptions r WHERE r.plan_id = p.id AND r.used_user_id = 0 AND r.deleted_at is Null) as available_codes
       FROM subscription_plans p
       WHERE p.enabled = 1
       ORDER BY p.sort_order ASC, p.id ASC`
    )
    return successResponse(plans)
  }

  /**
   * 创建支付订单并返回支付链接
   */
  async createPaymentOrder(userId, planId, reqIp = '') {
    // 获取套餐信息
    const [plans] = await adminPool.execute(
      'SELECT * FROM subscription_plans WHERE id = ? AND enabled = 1',
      [planId]
    )
    
    if (plans.length === 0) {
      return errorResponse('套餐不存在或已下架', 404)
    }
    
    const plan = plans[0]
    
    // 获取易支付配置
    const [options] = await adminPool.execute(
      "SELECT `value` FROM options WHERE `key` IN ('PayAddress', 'EpayId', 'EpayKey')"
    )
    
    const config = {}
    for (const row of options) {
      if (row.key === 'PayAddress') config.PayAddress = row.value
      if (row.key === 'EpayId') config.EpayId = row.value
      if (row.key === 'EpayKey') config.EpayKey = row.value
    }
    
    if (!config.PayAddress || !config.EpayId || !config.EpayKey) {
      return errorResponse('支付配置不完整，请联系管理员', 500)
    }
    
    // 生成订单号
    const orderId = `SUB${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    const notifyUrl = process.env.API_BASE_URL || 'http://localhost:3000/api/v1/subscription/pay-notify'
    const returnUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const now = Math.floor(Date.now() / 1000)
    
    // 保存支付订单
    await adminPool.execute(
      `INSERT INTO subscription_orders (user_id, plan_id, money, trade_no, status, create_time)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [userId, planId, plan.price_amount, orderId, now]
    )
    
    // 构建易支付签名
    const signStr = `pid=${config.EpayId}&type=1&out_trade_no=${orderId}&notify_url=${notifyUrl}&return_url=${returnUrl}&amount=${plan.price_amount}&subject=${encodeURIComponent(plan.title)}`
    const sign = this.md5(signStr + config.EpayKey)
    
    // 构建支付链接
    const payUrl = `${config.PayAddress}/mapi.php?${signStr}&sign=${sign}&sign_type=MD5`
    
    return successResponse({
      order_id: orderId,
      pay_url: payUrl,
      amount: plan.price_amount,
      plan_name: plan.title
    })
  }

  /**
   * 支付回调处理
   */
  async handlePayNotify(params) {
    const { out_trade_no, trade_no, trade_status } = params
    
    // 验证支付状态
    if (trade_status !== 'TRADE_SUCCESS' && trade_status !== 'TRADE_FINISHED') {
      return { success: false, message: '支付失败' }
    }
    
    // 获取订单信息
    const [orders] = await adminPool.execute(
      'SELECT * FROM subscription_orders WHERE trade_no = ?',
      [out_trade_no]
    )
    
    if (orders.length === 0) {
      return { success: false, message: '订单不存在' }
    }
    
    const order = orders[0]
    
    // 如果已处理过，直接返回
    if (order.status === 'Complete' || order.status === 'pending') {
      const now = Math.floor(Date.now() / 1000)
      // 更新订单状态
      await adminPool.execute(
        `UPDATE subscription_orders SET status = 'Complete', complete_time = ?, provider_payload = ? WHERE trade_no = ?`,
        [now, JSON.stringify(params), out_trade_no]
      )
      
      // 发放兑换码
      await this.grantRedemptionCode(order.user_id, order.plan_id, out_trade_no)
    }
    
    return { success: true, message: '支付成功' }
  }

  /**
   * 发放兑换码给用户
   */
  async grantRedemptionCode(userId, planId, tradeNo) {
    // 查找一个未使用的兑换码
    const [codes] = await adminPool.execute(
      `SELECT id, \`key\` as redemption_code, quota FROM redemptions 
       WHERE plan_id = ? AND used_user_id = 0 AND deleted_at is NUll
       ORDER BY created_time ASC LIMIT 1`,
      [planId]
    )
    
    if (codes.length === 0) {
      console.error(`没有可用的兑换码 for plan ${planId}`)
      return null
    }
    
    const code = codes[0]
    const now = Math.floor(Date.now() / 1000)
    
    // 标记兑换码已使用
    await adminPool.execute(
      `UPDATE redemptions SET used_user_id = ?, redeemed_time = ? WHERE id = ?`,
      [userId, now, code.id]
    )
    
    // 记录用户套餐订阅
    const [plans] = await adminPool.execute('SELECT * FROM subscription_plans WHERE id = ?', [planId])
    if (plans.length > 0) {
      const plan = plans[0]
      // 根据时长单位计算结束时间
      const durationSeconds = {
        'day': plan.duration_value * 86400,
        'week': plan.duration_value * 604800,
        'month': plan.duration_value * 2592000,  // 30天
        'year': plan.duration_value * 31536000   // 365天
      }
      const endTime = now + (durationSeconds[plan.duration_unit] || plan.duration_value * 2592000)

      await adminPool.execute(
        `INSERT INTO user_subscriptions (user_id, plan_id, amount_total, start_time, end_time, status, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'Active', 'order', ?, ?)`,
        [userId, planId, code.quota, now, endTime, now, now]
      )
    }
    
    return code.redemption_code
  }

  /**
   * 查询订单状态（用于支付后轮询）
   */
  async getOrderStatus(orderId) {
    const [orders] = await adminPool.execute(
      `SELECT so.*, p.title as plan_name, p.subtitle as plan_description, p.total_amount as credits
       FROM subscription_orders so
       JOIN subscription_plans p ON so.plan_id = p.id
       WHERE so.trade_no = ?`,
      [orderId]
    )
    
    if (orders.length === 0) {
      return errorResponse('订单不存在', 404)
    }
    
    const order = orders[0]
    
    // 获取发放的兑换码
    const [codes] = await adminPool.execute(
      `SELECT \`key\` as redemption_code FROM redemptions 
       WHERE plan_id = ? AND used_user_id = ? AND deleted_at IS NULL
       ORDER BY redeemed_time DESC LIMIT 1`,
      [order.plan_id, order.user_id]
    )
    
    return successResponse({
      order_id: order.trade_no,
      user_id: order.user_id,
      plan_id: order.plan_id,
      amount: order.money,
      status: order.status,
      plan_name: order.plan_name,
      plan_description: order.plan_description,
      credits: order.credits,
      redemption_code: codes.length > 0 ? codes[0].redemption_code : null
    })
  }

  /**
   * MD5 签名辅助函数
   */
  md5(str) {
    const crypto = require('crypto')
    return crypto.createHash('md5').update(str).digest('hex')
  }
}

module.exports = new SubscriptionService()
