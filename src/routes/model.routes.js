const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const modelService = require('../services/model.service')

router.use(authenticate)

// 模型列表
router.get('/', async (_req, res) => {
  const result = await modelService.getModels()
  res.json(result)
})

// 切换模型
router.post('/:modelId/switch', async (req, res) => {
  const result = await modelService.switchModel(
    req.params.modelId, req.body.dialog_id, req.user.id
  )
  res.status(result.statusCode || 200).json(result)
})

module.exports = router
