const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../middleware/auth')
const adminService = require('../services/admin.service')
const { generateRedemptionCodesValidation, createPlanValidation } = require('../middleware/validate')
const { paginationQuery } = require('../middleware/validate')

router.use(authenticate)
router.use(requireAdmin)

// 用户管理
router.get('/users', paginationQuery, async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const size = parseInt(req.query.size) || 20
  const result = await adminService.getUsers(page, size, req.query.keyword)
  res.json(result)
})

router.put('/users/:userId/toggle', async (req, res) => {
  const result = await adminService.toggleUserStatus(req.params.userId, req.body.is_active)
  res.status(result.statusCode || 200).json(result)
})

// 套餐管理
router.post('/plans', createPlanValidation, async (req, res) => {
  const result = await adminService.createPlan(req.body)
  res.status(result.statusCode || 201).json(result)
})

// 兑换码管理
router.post('/redemption-codes/generate', generateRedemptionCodesValidation, async (req, res) => {
  const result = await adminService.generateRedemptionCodes(
    req.body.plan_id, req.body.count, req.body.expires_at
  )
  res.status(result.statusCode || 201).json(result)
})

// 统计信息
router.get('/stats', async (req, res) => {
  const result = await adminService.getStats(
    req.query.type, req.query.start_date, req.query.end_date
  )
  res.json(result)
})

module.exports = router
