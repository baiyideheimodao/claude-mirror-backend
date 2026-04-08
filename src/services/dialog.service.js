const { pool } = require('../config/database')
const { generateId, groupDialogsByDate, successResponse, errorResponse } = require('../utils/helpers')

class DialogService {
  /**
   * 获取对话列表（按时间分组）
   */
  async getDialogsList(userId) {
    const [dialogs] = await pool.execute(
      'SELECT id, title, created_at, updated_at, last_message_at, is_pinned \
       FROM dialogs WHERE user_id = ? AND is_deleted = 0 \
       ORDER BY is_pinned DESC, last_message_at DESC',
      [userId]
    )
    return successResponse(groupDialogsByDate(dialogs))
  }

  /**
   * 创建对话
   */
  async createDialog(userId, title) {
    const id = generateId()
    const now = new Date()
    await pool.execute(
      'INSERT INTO dialogs (id, user_id, title, last_message_at) VALUES (?, ?, ?, ?)',
      [id, userId, title || '新对话', now]
    )
    const [[row]] = await pool.execute('SELECT * FROM dialogs WHERE id = ?', [id])
    return successResponse(row, '创建成功', 201)
  }

  /**
   * 获取对话详情（含消息）
   */
  async getDialogDetail(dialogId, userId) {
    const [dialogs] = await pool.execute(
      'SELECT * FROM dialogs WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [dialogId, userId]
    )
    if (dialogs.length === 0) return errorResponse('对话不存在', 404)

    const [messages] = await pool.execute(
      'SELECT * FROM dialog_messages WHERE dialog_id = ? ORDER BY timestamp ASC',
      [dialogId]
    )

    return successResponse({ ...dialogs[0], messages })
  }

  /**
   * 重命名对话
   */
  async renameDialog(dialogId, userId, title) {
    await pool.execute(
      'UPDATE dialogs SET title = ?, updated_at = NOW() WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [title, dialogId, userId]
    )
    return successResponse(null, '重命名成功')
  }

  /**
   * 删除对话（软删除）
   */
  async deleteDialog(dialogId, userId) {
    const [result] = await pool.execute(
      'UPDATE dialogs SET is_deleted = 1 WHERE id = ? AND user_id = ?',
      [dialogId, userId]
    )
    if (result.affectedRows === 0) return errorResponse('对话不存在', 404)
    return successResponse(null, null, 204)
  }

  /**
   * 发送消息
   */
  async sendMessage(dialogId, userId, content, files = []) {
    // 保存用户消息
    const userMsgId = generateId()
    await pool.execute(
      'INSERT INTO dialog_messages (id, dialog_id, user_id, content, role, status) VALUES (?, ?, ?, ?, "user", "sent")',
      [userMsgId, dialogId, userId, content]
    )
    // 更新对话时间
    await pool.execute(
      'UPDATE dialogs SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
      [dialogId]
    )

    // TODO: 调用AI模型生成回复，此处模拟AI回复
    const aiMsgId = generateId()
    const aiContent = '这是AI的模拟回复。实际部署时将调用Claude API。'
    await pool.execute(
      `INSERT INTO dialog_messages (id, dialog_id, user_id, content, role, parent_id)
       VALUES (?, ?, ?, ?, "ai", ?)`,
      [aiMsgId, dialogId, userId, aiContent, userMsgId]
    )

    return successResponse({
      user_message: { id: userMsgId, content, role: 'user' },
      ai_message: { id: aiMsgId, content: aiContent, role: 'ai' }
    })
  }

  /**
   * 编辑消息
   */
  async editMessage(dialogId, messageId, userId, content) {
    const [result] = await pool.execute(
      'UPDATE dialog_messages SET content = ? WHERE id = ? AND dialog_id = ? AND user_id = ?',
      [content, messageId, dialogId, userId]
    )
    if (result.affectedRows === 0) return errorResponse('消息不存在', 404)
    return successResponse(null, '编辑成功')
  }

  /**
   * 重新生成消息
   */
  async regenerateMessage(dialogId, messageId, userId) {
    const [[msg]] = await pool.execute(
      'SELECT * FROM dialog_messages WHERE id = ? AND dialog_id = ? AND user_id = ?',
      [messageId, dialogId, userId]
    )
    if (!msg) return errorResponse('消息不存在', 404)

    const newVersion = msg.version + 1
    const newMsgId = generateId()
    const aiContent = '这是重新生成的AI回复。'

    await pool.execute(
      `INSERT INTO dialog_messages (id, dialog_id, user_id, content, role, parent_id, version)
       VALUES (?, ?, ?, ?, "ai", ?, ?)`,
      [newMsgId, dialogId, userId, aiContent, msg.parent_id, newVersion]
    )

    return successResponse({ id: newMsgId, content: aiContent, role: 'ai', version: newVersion })
  }

  /**
   * 获取消息分支版本
   */
  async getMessageBranches(dialogId, messageId, userId) {
    const [parentMsg] = await pool.execute(
      'SELECT id FROM dialog_messages WHERE id = ? AND dialog_id = ?',
      [messageId, dialogId]
    )
    if (parentMsg.length === 0) return errorResponse('消息不存在', 404)

    const [branches] = await pool.execute(
      'SELECT id, content, role, version, timestamp, status FROM dialog_messages WHERE parent_id = ? ORDER BY version ASC',
      [messageId]
    )
    return successResponse(branches)
  }
}

module.exports = new DialogService()
