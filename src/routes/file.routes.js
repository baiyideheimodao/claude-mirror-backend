const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { fileService, uploadMiddleware } = require('../services/file.service')

router.use(authenticate)

// 文件上传
router.post('/upload', uploadMiddleware, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请选择文件' })
  }
  const result = await fileService.uploadFile(req.file, req.user.id, req.body.dialog_id)
  res.status(result.statusCode || 200).json(result)
})

module.exports = router
