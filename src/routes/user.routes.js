const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const userService = require('../services/user.service')
const { paginationQuery, useRedemptionCodeValidation } = require('../middleware/validate')

// 所有用户路由需要认证
router.use(authenticate)

// Profile
router.get('/profile', async (req, res) => {
  const result = await userService.getProfile(req.user.id)
  res.status(result.statusCode || 200).json(result)
})

router.put('/profile', async (req, res) => {
  const result = await userService.updateProfile(req.user.id, req.body)
  res.status(result.statusCode || 200).json(result)
})

// 套餐
router.get('/plans', async (_req, res) => {
  const result = await userService.getPlans()
  res.json(result)
})

// 购买套餐
router.post('/plans/:planId/buy', async (req, res) => {
  const result = await userService.buyPlan(req.user.id, req.params.planId, req.body.payment_method)
  res.status(result.statusCode || 200).json(result)
})

// 兑换码
router.post('/redemption-codes/use', useRedemptionCodeValidation, async (req, res) => {
  const result = await userService.useRedemptionCode(req.user.id, req.body.code)
  res.status(result.statusCode || 200).json(result)
})

// 对话历史
router.get('/dialog-history', paginationQuery, async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const size = parseInt(req.query.size) || 20
  const result = await userService.getDialogHistory(req.user.id, page, size)
  res.json(result)
})

// 支付记录
router.get('/payment-records', async (req, res) => {
  const result = await userService.getPaymentRecords(req.user.id)
  res.json(result)
})

module.exports = router
