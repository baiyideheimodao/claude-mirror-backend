const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const dialogService = require('../services/dialog.service')
const {
  createDialogValidation,
  updateDialogValidation,
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
