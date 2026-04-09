const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const express = require('express')
const cors = require('cors')
const fs = require('fs')

const app = express()
const PORT = process.env.PORT || 3000

// ========== 中间件 ==========
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 确保上传目录存在
const uploadDir = process.env.UPLOAD_DIR || './uploads'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
app.use('/uploads', express.static(path.resolve(uploadDir)))

// ========== 路由注册 ==========
app.use('/api/v1/auth', require('./routes/auth.routes'))
app.use('/api/v1/user', require('./routes/user.routes'))
app.use('/api/v1/dialogs', require('./routes/dialog.routes'))
app.use('/api/v1/files', require('./routes/file.routes'))
app.use('/api/v1/artifacts', require('./routes/artifact.routes'))
app.use('/api/v1/agent', require('./routes/agent.routes'))
app.use('/api/v1/models', require('./routes/model.routes'))
app.use('/api/v1/projects', require('./routes/project.routes'))
app.use('/api/v1/admin', require('./routes/admin.routes'))

// ========== 健康检查 ==========
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Claude Mirror API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// ========== API文档首页 ==========
app.get('/', (_req, res) => {
  res.json({
    name: 'Claude Mirror Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth/*',
      user: '/api/v1/user/*',
      dialogs: '/api/v1/dialogs/*',
      files: '/api/v1/files/*',
      artifacts: '/api/v1/artifacts/*',
      agent: '/api/v1/agent/*',
      models: '/api/v1/models/*',
      projects: '/api/v1/projects/*',
      admin: '/api/v1/admin/*'
    },
    docs: 'See api.yml for full documentation'
  })
})

// ========== 404处理 ==========
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    statusCode: 404,
    timestamp: new Date().toISOString()
  })
})

// ========== 全局错误处理 ==========
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.stack || err)
  
  if (err.name === 'MulterError') {
    let message = '文件上传失败'
    if (err.code === 'LIMIT_FILE_SIZE') message = '文件大小超出限制(10MB)'
    return res.status(400).json({ success: false, error: message })
  }

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || '服务器内部错误',
    statusCode: err.statusCode || 500,
    timestamp: new Date().toISOString()
  })
})

// ========== 启动服务 ==========
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   Claude Mirror Backend API          ║
║   http://localhost:${PORT}              ║
╚══════════════════════════════════════╝
  `)
})
