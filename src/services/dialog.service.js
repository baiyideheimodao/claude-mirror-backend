const { pool } = require('../config/database')
const { generateId, groupDialogsByDate, successResponse, errorResponse } = require('../utils/helpers')
const aiService = require('./ai.service')

const AI_SYSTEM_PROMPT = '你是 Claude，一个由 Anthropic 开发的 AI 助手。你善于分析问题、提供详细解答，并始终以友好、专业的方式与用户交流。'

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

    // 获取对话历史用于上下文
    const [history] = await pool.execute(
      'SELECT role, content FROM dialog_messages WHERE dialog_id = ? ORDER BY timestamp ASC',
      [dialogId]
    )

    // 构建消息列表（限制最近 20 条避免 token 过多）
    const recentHistory = history.slice(-20)
    const chatMessages = recentHistory.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }))

    // 调用 AI 生成回复
    let aiContent
    try {
      aiContent = await aiService.chat(chatMessages, {
        system: AI_SYSTEM_PROMPT,
        max_tokens: 4096
      })
    } catch (e) {
      aiContent = `抱歉，AI 回复生成失败：${e.message}，请稍后重试。`
    }

    const aiMsgId = generateId()
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

    // 获取对话历史（到此消息为止）
    const [history] = await pool.execute(
      'SELECT role, content FROM dialog_messages WHERE dialog_id = ? AND timestamp < ? ORDER BY timestamp ASC',
      [dialogId, msg.timestamp]
    )

    const recentHistory = history.slice(-20)
    const chatMessages = recentHistory.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }))

    // 如果原始消息是 AI 的，且有其 parent_id 对应的用户消息，追加到上下文
    if (msg.role === 'ai' && msg.parent_id) {
      const [[parentMsg]] = await pool.execute(
        'SELECT content FROM dialog_messages WHERE id = ?',
        [msg.parent_id]
      )
      if (parentMsg) {
        chatMessages.push({ role: 'user', content: parentMsg.content })
      }
    }

    // 调用 AI 重新生成
    let aiContent
    try {
      aiContent = await aiService.chat(chatMessages, {
        system: AI_SYSTEM_PROMPT,
        max_tokens: 4096,
        temperature: 0.8 // 重新生成时温度稍高以获得不同回复
      })
    } catch (e) {
      aiContent = `抱歉，AI 回复重新生成失败：${e.message}，请稍后重试。`
    }

    const newVersion = msg.version + 1
    const newMsgId = generateId()

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
