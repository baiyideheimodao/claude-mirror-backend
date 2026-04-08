const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const agentService = require('../services/agent.service')
const { generateCodeValidation, debugCodeValidation, createProjectValidation } = require('../middleware/validate')

router.use(authenticate)

// 代码生成
router.post('/code/generate', generateCodeValidation, async (req, res) => {
  const result = await agentService.generateCode(
    req.body.language, req.body.requirement, req.body.context_files
  )
  res.json(result)
})

// Bug调试
router.post('/code/debug', debugCodeValidation, async (req, res) => {
  const result = await agentService.debugCode(req.body.code, req.body.error_message)
  res.json(result)
})

// 创建项目骨架
router.post('/project/create', createProjectValidation, async (req, res) => {
  const result = await agentService.createProjectSkeleton(
    req.body.project_name, req.body.requirement
  )
  res.json(result)
})

module.exports = router
