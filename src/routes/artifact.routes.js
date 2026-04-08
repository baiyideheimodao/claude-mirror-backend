const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const artifactService = require('../services/artifact.service')
const { createArtifactValidation } = require('../middleware/validate')

router.use(authenticate)

// 创建Artifact
router.post('/', createArtifactValidation, async (req, res) => {
  const result = await artifactService.createArtifact(
    req.user.id, req.body.dialog_id, req.body.type, req.body.content, req.body.language
  )
  res.status(result.statusCode || 201).json(result)
})

// 渲染Artifact
router.get('/:artifactId/render', async (req, res) => {
  const result = await artifactService.renderArtifact(req.params.artifactId, req.user.id)
  if (!result.success) return res.status(result.statusCode || 404).json(result)

  // 根据类型返回不同格式
  const artifact = result.data
  if (artifact.type === 'mermaid') {
    res.setHeader('Content-Type', 'image/svg+xml').send(artifact.content)
  } else if (artifact.type === 'web' || artifact.type === 'doc') {
    res.setHeader('Content-Type', 'text/html').send(artifact.rendered_content)
  } else {
    res.json(result)
  }
})

module.exports = router
