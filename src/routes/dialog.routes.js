const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const dialogService = require('../services/dialog.service')
const {
  createDialogValidation,
  updateDialogValidation,
  pinDialogValidation,
  sendMessageValidation,
  editMessageValidation,
  dialogIdParam
} = require('../middleware/validate')

router.use(authenticate)

// 对话列表（按时间分组）
router.get('/', async (req, res) => {
  const result = await dialogService.getDialogsList(req.user.id)
  res.json(result)
})

// 新建对话
router.post('/', createDialogValidation, async (req, res) => {
  const result = await dialogService.createDialog(req.user.id, req.body.title)
  res.status(result.statusCode || 201).json(result)
})

// 对话详情 / 重命名 / 删除
router.get('/:dialogId', dialogIdParam, async (req, res) => {
  const result = await dialogService.getDialogDetail(req.params.dialogId, req.user.id)
  res.status(result.statusCode || 200).json(result)
})

router.put('/:dialogId', dialogIdParam, updateDialogValidation, async (req, res) => {
  const result = await dialogService.renameDialog(req.params.dialogId, req.user.id, req.body.title)
  res.status(result.statusCode || 200).json(result)
})

router.put('/:dialogId/pin', dialogIdParam, pinDialogValidation, async (req, res) => {
  const result = await dialogService.setPinned(req.params.dialogId, req.user.id, req.body.is_pinned)
  res.status(result.statusCode || 200).json(result)
})

router.delete('/:dialogId', dialogIdParam, async (req, res) => {
  const result = await dialogService.deleteDialog(req.params.dialogId, req.user.id)
  res.status(204).send()
})

// 发送消息
router.post('/:dialogId/messages', dialogIdParam, sendMessageValidation, async (req, res) => {
  const result = await dialogService.sendMessage(
    req.params.dialogId, req.user.id, req.body.content, req.body.files, req.body.artifact_type
  )
  res.status(result.statusCode || 200).json(result)
})

// 发送消息（流式 / SSE）
router.post('/:dialogId/messages/stream', dialogIdParam, sendMessageValidation, async (req, res) => {
  const TAG = `[SSE-${Date.now()}]`
  console.log(`${TAG} ========== ROUTE ENTRY ==========`)

  // 禁用 TCP Nagle，让小包立即发出
  if (req.socket?.setNoDelay) req.socket.setNoDelay(true)

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  // 立即发送响应头（触发 200 状态码）
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  const sendEvent = (event, data) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    res.write(payload)
  }

  // 发送初始注释行确认连接
  res.write(': connected\n\n')

  try {
    console.log(`${TAG} Starting sendMessageStream...`)
    const stream = dialogService.sendMessageStream(
      req.params.dialogId, req.user.id, req.body.content, req.body.files, req.body.artifact_type
    )

    let fullContent = ''
    let chunkCount = 0

    for await (const chunk of stream) {
      if (!chunk) continue
      chunkCount++

      if (chunk.type === 'error') {
        sendEvent('error', { message: chunk.message || 'Unknown error' })
        break
      }
      if (chunk.type === 'done') {
        sendEvent('done', { id: chunk.id })
        console.log(`${TAG} DONE: ${chunkCount} chunks, ${fullContent.length} chars`)
        break
      }
      if (chunk.type === 'render'){
        sendEvent('render',{html:chunk.html})
      }
      if (chunk.text) {
        fullContent += chunk.text
        sendEvent('chunk', { text: chunk.text })
      }

      if (chunkCount % 20 === 0) {
        console.log(`${TAG} Progress: ${chunkCount} chunks sent, ${fullContent.length} chars`)
      }
    }

    console.log(`${TAG} Stream ended. Total: ${chunkCount} chunks`)
  } catch (e) {
    console.error(`${TAG} ERROR:`, e.message || e)
    try { sendEvent('error', { message: e.message || e.toString() }) } catch (_) {}
  }

  console.log(`${TAG} ========== ROUTE END ==========`)
  try { res.end() } catch (_) {}
})

// 编辑消息（注意：messageId在query或body中传递）
router.put('/:dialogId/messages/:messageId', dialogIdParam, editMessageValidation, async (req, res) => {
  const result = await dialogService.editMessage(
    req.params.dialogId, req.params.messageId, req.user.id, req.body.content
  )
  res.status(result.statusCode || 200).json(result)
})

// 重新生成消息
router.post('/:dialogId/messages/:messageId/regenerate', dialogIdParam, async (req, res) => {
  const result = await dialogService.regenerateMessage(
    req.params.dialogId, req.params.messageId, req.user.id
  )
  res.status(result.statusCode || 200).json(result)
})

// 消息分支版本
router.get('/:dialogId/messages/:messageId/branch', dialogIdParam, async (req, res) => {
  const result = await dialogService.getMessageBranches(
    req.params.dialogId, req.params.messageId, req.user.id
  )
  res.status(result.statusCode || 200).json(result)
})

module.exports = router
