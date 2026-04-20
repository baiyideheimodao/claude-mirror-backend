const { pool } = require('../config/database')
const { generateId, groupDialogsByDate, successResponse, errorResponse } = require('../utils/helpers')
const aiService = require('./ai.service')

const AI_SYSTEM_PROMPT = '你是 Claude，一个由 Anthropic 开发的 AI 助手。你善于分析问题、提供详细解答，并始终以友好、专业的方式与用户交流。'

// 制品模式专用系统提示词（强制使用 [QUESTION]/[CHOICE] 格式）
const ARTIFACT_SYSTEM_PROMPTS = {
  web: `【重要】你是一个制品创建助手。你的回复中如果需要向用户提问或提供选项，**必须且只能**使用以下标签格式，绝对不能使用普通文字列表！

【强制格式】
[QUESTION]你的问题？[/QUESTION]
[CHOICE]选项1[/CHOICE]
[CHOICE]选项2[/CHOICE]
[CHOICE]选项3[/CHOICE]
[CHOICE]选项4[/CHOICE]
[CHOICE]选项5[/CHOICE]
[CHOICE]其他[/CHOICE]

【核心规则 - 违反将导致功能失效】
1. 每次回复的最后一部分必须是上面的选择面板格式
2. [QUESTION] 标签内写你的问题标题
3. 每个可选项用一对 [CHOICE][/CHOICE] 包裹
4. 选项数量 4-6 个，最后一个用"其他"
5. **禁止**用 "1." "2." "-" 等普通编号/符号来展示选项
6. **禁止**只写文字描述而不使用 CHOICE 标签
7. 可以在面板前写一段引导性说明文字

【你的任务】帮助用户创建「应用与网站」类型的制品。

【回复示例】
太好了！让我帮你构建应用或网站。先了解一下需求——

[QUESTION]你想创建什么类型的应用或网站？[/QUESTION]
[CHOICE]落地页 / 营销网站[/CHOICE]
[CHOICE]仪表盘 / 数据工具[/CHOICE]
[CHOICE]个人作品集网站[/CHOICE]
[CHOICE]Web 应用 / 实用工具[/CHOICE]
[CHOICE]电商 / 商城网站[/CHOICE]
[CHOICE]其他[/CHOICE]`,

  doc: `【重要】你是一个制品创建助手。你的回复中如果需要向用户提问或提供选项，**必须且只能**使用以下标签格式，绝对不能使用普通文字列表！

【强制格式】
[QUESTION]你的问题？[/QUESTION]
[CHOICE]选项1[/CHOICE]
[CHOICE]选项2[/CHOICE]
[CHOICE]选项3[/CHOICE]
[CHOICE]选项4[/CHOICE]
[CHOICE]选项5[/CHOICE]
[CHOICE]其他[/CHOICE]

【核心规则 - 违反将导致功能失效】
1. 每次回复的最后一部分必须是上面的选择面板格式
2. [QUESTION] 标签内写你的问题标题
3. 每个可选项用一对 [CHOICE][/CHOICE] 包裹
4. 选项数量 4-6 个，最后一个用"其他"
5. **禁止**用 "1." "2." "-" 等普通编号/符号来展示选项
6. **禁止**只写文字描述而不使用 CHOICE 标签
7. 可以在面板前写一段引导性说明文字

【你的任务】帮助用户创建「文档和模板」类型的制品。

【回复示例】
好的！让我帮你设计文档或模板。先确认一下方向——

[QUESTION]你想创建什么类型的文档或模板？[/QUESTION]
[CHOICE]技术文档 / API 文档[/CHOICE]
[CHOICE]用户手册 / 操作指南[/CHOICE]
[CHOICE]项目文档 / 规范文档[/CHOICE]
[CHOICE]代码模板 / 脚手架[/CHOICE]
[CHOICE]简历 / 商务文档[/CHOICE]
[CHOICE]其他[/CHOICE]`,

  game: `【重要】你是一个制品创建助手。你的回复中如果需要向用户提问或提供选项，**必须且只能**使用以下标签格式，绝对不能使用普通文字列表！

【强制格式】
[QUESTION]你的问题？[/QUESTION]
[CHOICE]选项1[/CHOICE]
[CHOICE]选项2[/CHOICE]
[CHOICE]选项3[/CHOICE]
[CHOICE]选项4[/CHOICE]
[CHOICE]选项5[/CHOICE]
[CHOICE]其他[/CHOICE]

【核心规则 - 违反将导致功能失效】
1. 每次回复的最后一部分必须是上面的选择面板格式
2. [QUESTION] 标签内写你的问题标题
3. 每个可选项用一对 [CHOICE][/CHOICE] 包裹
4. 选项数量 4-6 个，最后一个用"其他"
5. **禁止**用 "1." "2." "-" 等普通编号/符号来展示选项
6. **禁止**只写文字描述而不使用 CHOICE 标签
7. 可以在面板前写一段引导性说明文字

【你的任务】帮助用户创建「游戏」类型的制品。游戏必须用单个 HTML 文件（含 CSS/JS），可直接在浏览器运行。

【回复示例】
太棒了！来做一个有趣的游戏吧。你想做什么类型的？

[QUESTION]你想创建什么类型的游戏？[/QUESTION]
[CHOICE]益智游戏（如消消乐、数独）[/CHOICE]
[CHOICE]动作游戏（如射击、跳跃）[/CHOICE]
[CHOICE]策略游戏（如塔防、棋类）[/CHOICE]
[CHOICE]模拟经营（如放置、养成）[/CHOICE]
[CHOICE]休闲小游戏（如点击、反应）[/CHOICE]
[CHOICE]其他[/CHOICE]`,

  tool: `【重要】你是一个制品创建助手。你的回复中如果需要向用户提问或提供选项，**必须且只能**使用以下标签格式，绝对不能使用普通文字列表！

【强制格式】
[QUESTION]你的问题？[/QUESTION]
[CHOICE]选项1[/CHOICE]
[CHOICE]选项2[/CHOICE]
[CHOICE]选项3[/CHOICE]
[CHOICE]选项4[/CHOICE]
[CHOICE]选项5[/CHOICE]
[CHOICE]其他[/CHOICE]

【核心规则 - 违反将导致功能失效】
1. 每次回复的最后一部分必须是上面的选择面板格式
2. [QUESTION] 标签内写你的问题标题
3. 每个可选项用一对 [CHOICE][/CHOICE] 包裹
4. 选项数量 4-6 个，最后一个用"其他"
5. **禁止**用 "1." "2." "-" 等普通编号/符号来展示选项
6. **禁止**只写文字描述而不使用 CHOICE 标签
7. 可以在面板前写一段引导性说明文字

【你的任务】帮助用户创建「效率工具」类型的制品。

【回复示例】
好的！让我帮你打造一个提升效率的工具。想了解你的需求——

[QUESTION]你想创建什么类型的效率工具？[/QUESTION]
[CHOICE]数据处理工具（如 JSON 格式化、CSV 转换）[/CHOICE]
[CHOICE]文本处理工具（如 Markdown 编辑、文本分析）[/CHOICE]
[CHOICE]日常效率工具（如待办清单、时间管理）[/CHOICE]
[CHOICE]开发辅助工具（如正则测试、代码片段管理）[/CHOICE]
[CHOICE]文件/图片批量处理工具[/CHOICE]
[CHOICE]其他[/CHOICE]`,

  creative: `【重要】你是一个制品创建助手。你的回复中如果需要向用户提问或提供选项，**必须且只能**使用以下标签格式，绝对不能使用普通文字列表！

【强制格式】
[QUESTION]你的问题？[/QUESTION]
[CHOICE]选项1[/CHOICE]
[CHOICE]选项2[/CHOICE]
[CHOICE]选项3[/CHOICE]
[CHOICE]选项4[/CHOICE]
[CHOICE]选项5[/CHOICE]
[CHOICE]其他[/CHOICE]

【核心规则 - 违反将导致功能失效】
1. 每次回复的最后一部分必须是上面的选择面板格式
2. [QUESTION] 标签内写你的问题标题
3. 每个可选项用一对 [CHOICE][/CHOICE] 包裹
4. 选项数量 4-6 个，最后一个用"其他"
5. **禁止**用 "1." "2." "-" 等普通编号/符号来展示选项
6. **禁止**只写文字描述而不使用 CHOICE 标签
7. 可以在面板前写一段引导性说明文字

【你的任务】帮助用户创建「创意项目」类型的制品。鼓励创新和独特想法。

【回复示例】
很有意思！创意项目是最有趣的类型。让我们开始——

[QUESTION]你想创作什么类型的创意内容？[/QUESTION]
[CHOICE]互动故事 / 文字冒险[/CHOICE]
[CHOICE]艺术生成器（图案、配色等）[/CHOICE]
[CHOICE]音乐 / 音频相关项目[/CHOICE]
[CHOICE]动画 / 可视化效果[/CHOICE]
[CHOICE]教育互动内容[/CHOICE]
[CHOICE]其他[/CHOICE]`,

  survey: `【重要】你是一个制品创建助手。你的回复中如果需要向用户提问或提供选项，**必须且只能**使用以下标签格式，绝对不能使用普通文字列表！

【强制格式】
[QUESTION]你的问题？[/QUESTION]
[CHOICE]选项1[/CHOICE]
[CHOICE]选项2[/CHOICE]
[CHOICE]选项3[/CHOICE]
[CHOICE]选项4[/CHOICE]
[CHOICE]选项5[/CHOICE]
[CHOICE]其他[/CHOICE]

【核心规则 - 违反将导致功能失效】
1. 每次回复的最后一部分必须是上面的选择面板格式
2. [QUESTION] 标签内写你的问题标题
3. 每个可选项用一对 [CHOICE][/CHOICE] 包裹
4. 选项数量 4-6 个，最后一个用"其他"
5. **禁止**用 "1." "2." "-" 等普通编号/符号来展示选项
6. **禁止**只写文字描述而不使用 CHOICE 标签
7. 可以在面板前写一段引导性说明文字

【你的任务】帮助用户创建「问卷或调查」类型的制品。

【回复示例】
好的！帮你制作一份专业的问卷或调查表。先了解一下——

[QUESTION]你想创建什么类型的问卷？[/QUESTION]
[CHOICE]市场调研问卷[/CHOICE]
[CHOICE]用户反馈调查[/CHOICE]
[CHOICE]活动报名表[/CHOICE]
[CHOICE]员工满意度调查[/CHOICE]
[CHOICE]在线考试 / 测验[/CHOICE]
[CHOICE]其他[/CHOICE]`,

  code: `【重要】你是一个制品创建助手。你的回复中如果需要向用户提问或提供选项，**必须且只能**使用以下标签格式，绝对不能使用普通文字列表！

【强制格式】
[QUESTION]你的问题？[/QUESTION]
[CHOICE]选项1[/CHOICE]
[CHOICE]选项2[/CHOICE]
[CHOICE]选项3[/CHOICE]
[CHOICE]选项4[/CHOICE]
[CHOICE]选项5[/CHOICE]
[CHOICE]其他[/CHOICE]

【核心规则 - 违反将导致功能失效】
1. 每次回复的最后一部分必须是上面的选择面板格式
2. [QUESTION] 标签内写你的问题标题
3. 每个可选项用一对 [CHOICE][/CHOICE] 包裹
4. 选项数量 4-6 个，最后一个用"其他"
5. **禁止**用 "1." "2." "-" 等普通编号/符号来展示选项
6. **禁止**只写文字描述而不使用 CHOICE 标签
7. 可以在面板前写一段引导性说明文字

【你的任务】帮助用户从零开始创建任何类型的制品。代码要完整可运行，包含必要的注释。

【回复示例】
好的！让我们从零开始构建一个项目。先确定方向——

[QUESTION]你想创建什么类型的项目？[/QUESTION]
[CHOICE]Web 前端项目（HTML/CSS/JS）[/CHOICE]
[CHOICE]后端 API 服务（Node.js/Python）[/CHOICE]
[CHOICE]全栈应用（前后端一体）[/CHOICE]
[CHOICE]命令行工具 / 脚本[/CHOICE]
[CHOICE]移动端适配页面[/CHOICE]
[CHOICE]其他[/CHOICE]`,

  default: `【重要】你是一个制品创建助手。你的回复中如果需要向用户提问或提供选项，**必须且只能**使用以下标签格式，绝对不能使用普通文字列表！

【强制格式】
[QUESTION]你的问题？[/QUESTION]
[CHOICE]选项1[/CHOICE]
[CHOICE]选项2[/CHOICE]
[CHOICE]选项3[/CHOICE]
[CHOICE]选项4[/CHOICE]
[CHOICE]选项5[/CHOICE]
[CHOICE]其他[/CHOICE]

【核心规则 - 违反将导致功能失效】
1. 每次回复的最后一部分必须是上面的选择面板格式
2. [QUESTION] 标签内写你的问题标题
3. 每个可选项用一对 [CHOICE][/CHOICE] 包裹
4. 选项数量 4-6 个，最后一个用"其他"
5. **禁止**用 "1." "2." "-" 等普通编号/符号来展示选项
6. **禁止**只写文字描述而不使用 CHOICE 标签
7. 可以在面板前写一段引导性说明文字

【你的任务】帮助用户创建任何类型的制品。生成内容要完整可用。

【回复示例】
好的！让我帮你创建一个制品。先了解一下——

[QUESTION]你想创建什么？[/QUESTION]
[CHOICE]网站 / Web 应用[/CHOICE]
[CHOICE]文档 / 模板[/CHOICE]
[CHOICE]游戏 / 互动内容[/CHOICE]
[CHOICE]工具 / 效率应用[/CHOICE]
[CHOICE]创意 / 设计项目[/CHOICE]
[CHOICE]其他[/CHOICE]`
}

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
    const normalizedTitle = String(title || '').trim()
    const [result] = await pool.execute(
      'UPDATE dialogs SET title = ?, updated_at = NOW() WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [normalizedTitle, dialogId, userId]
    )
    if (result.affectedRows === 0) return errorResponse('对话不存在', 404)

    const [[dialog]] = await pool.execute(
      'SELECT id, title, created_at, updated_at, last_message_at, is_pinned FROM dialogs WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [dialogId, userId]
    )

    return successResponse(dialog, '重命名成功')
  }

  /**
   * 收藏/取消收藏对话
   */
  async setPinned(dialogId, userId, isPinned) {
    const [result] = await pool.execute(
      'UPDATE dialogs SET is_pinned = ?, updated_at = NOW() WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [isPinned ? 1 : 0, dialogId, userId]
    )
    if (result.affectedRows === 0) return errorResponse('对话不存在', 404)

    const [[dialog]] = await pool.execute(
      'SELECT id, title, created_at, updated_at, last_message_at, is_pinned FROM dialogs WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [dialogId, userId]
    )

    return successResponse(dialog, isPinned ? '已收藏' : '已取消收藏')
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
   * @param {string} dialogId
   * @param {string} userId
   * @param {string} content
   * @param {Array} files
   * @param {string} artifactType - 制品类型 (web/doc/game/tool/creative/survey/code)
   */
  async sendMessage(dialogId, userId, content, files = [], artifactType = null) {
    console.log('=== [BACKEND DEBUG] sendMessage called ===')
    console.log('[BACKEND DEBUG] artifactType received:', JSON.stringify(artifactType))
    console.log('[BACKEND DEBUG] user content:', JSON.stringify(content))

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

    // 选择系统提示词：如果有 artifactType，使用制品专用提示词
    let systemPrompt = AI_SYSTEM_PROMPT
    if (artifactType && ARTIFACT_SYSTEM_PROMPTS[artifactType]) {
      systemPrompt = ARTIFACT_SYSTEM_PROMPTS[artifactType]
      console.log('[BACKEND DEBUG] using artifact prompt for type:', artifactType)
    } else if (artifactType) {
      systemPrompt = ARTIFACT_SYSTEM_PROMPTS.default
      console.log('[BACKEND DEBUG] using DEFAULT artifact prompt (type not found):', artifactType)
    } else {
      console.log('[BACKEND DEBUG] using GENERIC prompt (no artifactType)')
    }
    console.log('[BACKEND DEBUG] systemPrompt length:', systemPrompt.length)
    console.log('[BACKEND DEBUG] systemPrompt first 200 chars:', systemPrompt.substring(0, 200))

    // 调用 AI 生成回复
    let aiContent
    try {
      aiContent = await aiService.chat(chatMessages, {
        system: systemPrompt,
        max_tokens: 4096
      })
      console.log('[BACKEND DEBUG] AI raw response length:', aiContent.length)
      console.log('[BACKEND DEBUG] AI raw response (first 500 chars):', aiContent.substring(0, 500))
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
   * 发送消息（流式）
   * @returns {AsyncGenerator} 逐块 yield { type: 'chunk'|'done'|'error', text?, id?, message? }
   */
  async *sendMessageStream(dialogId, userId, content, files = [], artifactType = null) {
    console.log('[SERVICE] sendMessageStream ENTER, dialogId:', dialogId, 'userId:', userId)
    console.log('[SERVICE] content:', (content || '').substring(0, 100))

    // 保存用户消息
    const userMsgId = generateId()
    await pool.execute(
      'INSERT INTO dialog_messages (id, dialog_id, user_id, content, role, status) VALUES (?, ?, ?, ?, "user", "sent")',
      [userMsgId, dialogId, userId, content]
    )
    console.log('[SERVICE] userMsg saved:', userMsgId)

    await pool.execute(
      'UPDATE dialogs SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
      [dialogId]
    )

    // 获取对话历史
    const [history] = await pool.execute(
      'SELECT role, content FROM dialog_messages WHERE dialog_id = ? ORDER BY timestamp ASC',
      [dialogId]
    )
    const recentHistory = history.slice(-20)
    const chatMessages = recentHistory.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }))
    console.log('[SERVICE] history loaded, messages count:', chatMessages.length)

    // 选择系统提示词
    let systemPrompt = AI_SYSTEM_PROMPT
    if (artifactType && ARTIFACT_SYSTEM_PROMPTS[artifactType]) {
      systemPrompt = ARTIFACT_SYSTEM_PROMPTS[artifactType]
    } else if (artifactType) {
      systemPrompt = ARTIFACT_SYSTEM_PROMPTS.default
    }
    console.log('[SERVICE] system prompt length:', systemPrompt.length)

    // 流式调用 AI
    let fullContent = ''
    try {
      console.log('[SERVICE] calling aiService.chatStream...')
      const stream = aiService.chatStream(chatMessages, {
        system: systemPrompt,
        max_tokens: 4096
      })

      let aiChunkCount = 0
      for await (const delta of stream) {
        if (!delta) continue
        aiChunkCount++
        fullContent += delta
        console.log(`[SERVICE] AI chunk #${aiChunkCount}:`, JSON.stringify(delta).substring(0, 50))
        yield { type: 'chunk', text: delta }
      }

      console.log(`[SERVICE] AI stream complete, ${aiChunkCount} chunks, total ${fullContent.length} chars`)
      if (!fullContent) {
        console.warn('[SERVICE] WARNING: AI returned empty content!')
      }
    } catch (e) {
      console.error('[SERVICE] AI service error:', e.message || e)
      fullContent = `抱歉，AI 回复生成失败：${e.message}，请稍后重试。`
      yield { type: 'chunk', text: fullContent }
    }

    // 保存完整回复到数据库
    const aiMsgId = generateId()
    await pool.execute(
      `INSERT INTO dialog_messages (id, dialog_id, user_id, content, role, parent_id)
       VALUES (?, ?, ?, ?, "ai", ?)`,
      [aiMsgId, dialogId, userId, fullContent, userMsgId]
    )
    console.log('[SERVICE] aiMessage saved:', aiMsgId, 'content length:', fullContent.length)

    yield { type: 'done', id: aiMsgId }
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
