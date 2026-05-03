const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const subscriptionService = require('../services/subscription.service')
const { adminPool } = require('../config/database')

// 获取套餐列表（包含剩余兑换码数量）
router.get('/plans', async (_req, res) => {
  const result = await subscriptionService.getPlansWithRedemptionCounts()
  res.json(result)
})

// 获取站点设置（logo等）
router.get('/site-settings', async (_req, res) => {
  try {
    const [rows] = await adminPool.execute(
      "SELECT `key`, `value` FROM options WHERE `key` IN ('logo', 'SiteName', 'SiteDescription')"
    )
    
    const settings = {}
    const defaults = {
      logo: '',
      SiteName: 'Claude Mirror',
      SiteDescription: ''
    }
    
    for (const row of rows) {
      settings[row.key] = row.value
    }
    
    // 如果 logo 为空，使用默认空字符串（前端会用默认 logo）
    if (!settings.logo) {
      settings.logo = ''
    }
    
    res.json({ success: true, data: { ...defaults, ...settings } })
  } catch (err) {
    console.error('获取站点设置失败:', err.message)
    res.json({ success: true, data: { logo: '', SiteName: 'Claude Mirror', SiteDescription: '' } })
  }
})

// 创建支付订单
router.post('/create-order', authenticate, async (req, res) => {
  const { plan_id } = req.body
  if (!plan_id) {
    return res.status(400).json({ success: false, message: '缺少 plan_id 参数' })
  }
  const result = await subscriptionService.createPaymentOrder(req.user.id, plan_id, req.ip)
  res.status(result.statusCode || 200).json(result)
})

// 支付回调（易支付异步通知）
router.post('/pay-notify', async (req, res) => {
  const result = await subscriptionService.handlePayNotify(req.body)
  if (result.success) {
    res.send('success')
  } else {
    res.send('fail')
  }
})

// 查询订单状态（用于支付后轮询获取兑换码）
router.get('/order-status/:orderId', authenticate, async (req, res) => {
  const result = await subscriptionService.getOrderStatus(req.params.orderId)
  res.status(result.statusCode || 200).json(result)
})

module.exports = router
