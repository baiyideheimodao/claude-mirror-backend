const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const { authenticate, requireAdmin } = require('../middleware/auth')
const projectService = require('../services/project.service')
const { createProjectValidation } = require('../middleware/validate')
const fs = require('fs')

const upload = multer({
  dest: './uploads/',
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, true)
})

router.use(authenticate)

// 创建项目
router.post('/', createProjectValidation, async (req, res) => {
  const result = await projectService.createProject(
    req.user.id, req.body.name, req.body.description, req.body.icon
  )
  res.status(result.statusCode || 201).json(result)
})

// 上传知识库
router.post('/:projectId/knowledge-base', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: '请选择文件' })

  // 先保存文件记录到files表，再关联知识库
  // 简化处理：直接使用file_id
  const result = await projectService.uploadKnowledgeBase(req.params.projectId, req.user.id, req.file.filename)
  res.status(result.statusCode || 200).json(result)
})

// 设置System Prompt
router.put('/:projectId/system-prompt', async (req, res) => {
  const result = await projectService.setSystemPrompt(
    req.params.projectId, req.user.id, req.body.system_prompt
  )
  res.status(result.statusCode || 200).json(result)
})

module.exports = router
