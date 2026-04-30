const { pool } = require('../config/database')
const { generateId, groupDialogsByDate, successResponse, errorResponse } = require('../utils/helpers')
const aiService = require('./ai.service')

const AI_SYSTEM_PROMPT = `你是 Claude，一个由 Anthropic 开发的 AI 助手。你善于分析问题、提供详细解答，并始终以友好、专业的方式与用户交流。

当用户请求创建网页、HTML 页面或网站时，请遵守以下规则：

1. **输出完整HTML文档**：必须提供完整的、可运行的HTML代码，包含必要的<!DOCTYPE html>、<html>、<head>和<body>标签。
2. **使用代码块**：将完整的HTML代码包裹在\`\`\`html\`\`\`代码块中。
3. **包含基本结构**：确保HTML文档包含：
   - <!DOCTYPE html>声明
   - <html>标签
   - <head>部分，包含<meta charset="UTF-8">和<meta name="viewport" content="width=device-width, initial-scale=1.0">
   - <title>标签设置页面标题
   - <body>标签包含所有可见内容
4. **添加示例内容**：如果用户没有指定具体内容，请添加有意义的示例内容（如"你好，世界！"）。
5. **包含基本样式**：添加一些基本的CSS样式使页面看起来美观。
6. **确保可直接运行**：生成的HTML代码应该可以直接复制到.html文件中并在浏览器中打开运行。

示例格式：
\`\`\`html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面标题</title>
  <style>
    /* 基本样式 */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: sans-serif; background: #f0f2f5; }
    /* 更多样式... */
  </style>
</head>
<body>
  <div>页面内容</div>
</body>
</html>
\`\`\``

/**
 * 检测内容中是否包含可渲染的 HTML
 * 返回提取的 HTML 内容，如果没有则返回 null
 */
const extractHtmlContent = (content) => {
  if (!content) return null
  
  console.log('[SERVICE] extractHtmlContent called, content length:', content.length)
  
  // 1. 检查代码块中的 HTML (包括 ```html 或 ```htm)
  const codeBlockRegex = /```\s*(?:html|htm)\s*\n([\s\S]*?)```/gi
  let codeMatch
  let bestHtml = ''
  let bestLength = 0
  
  // 重置正则表达式 lastIndex
  codeBlockRegex.lastIndex = 0
  while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
    const html = codeMatch[1].trim()
    if (html.length > bestLength) {
      bestLength = html.length
      bestHtml = html
    }
  }
  
  if (bestHtml && bestHtml.length > 20) {
    console.log('[SERVICE] Extracted HTML from code block, length:', bestHtml.length)
    return bestHtml
  }
  
  // 2. 检查裸 HTML 文档
  const htmlDocRegex = /<!DOCTYPE\s+html[\s\S]*?<\/html>|<html[\s\S]*?<\/html>/i
  const htmlDocMatch = content.match(htmlDocRegex)
  if (htmlDocMatch) {
    const html = htmlDocMatch[0].trim()
    if (html.length > 50) {
      console.log('[SERVICE] Found complete HTML document, length:', html.length)
      return html
    }
  }
  
  // 3. 检查 HTML 片段（包含常见标签）
  const htmlTagsRegex = /<(?:div|span|p|h[1-6]|a|button|form|input|textarea|select|table|ul|ol|li|header|footer|nav|section|article|main|aside|img|video|audio|canvas|svg|path|rect|circle|ellipse|line|polyline|polygon|text|g)[^>]*>[\s\S]*?<\/[^>]+>/i
  const htmlTagMatch = content.match(htmlTagsRegex)
  if (htmlTagMatch) {
    const html = htmlTagMatch[0].trim()
    if (html.length > 30) {
      console.log('[SERVICE] Found HTML fragment with tags, length:', html.length)
      return html
    }
  }
  
  // 4. 检查是否有明显的 HTML 结构（包含样式或脚本）
  const hasHtmlStructure = /<[^>]+>.*<\/[^>]+>|<style[\s\S]*?>[\s\S]*?<\/style>|<script[\s\S]*?>[\s\S]*?<\/script>/i.test(content)
  if (hasHtmlStructure) {
    // 尝试提取从第一个标签开始到最后一个标签结束的内容
    const startIndex = content.indexOf('<')
    const endIndex = content.lastIndexOf('>') + 1
    if (endIndex > startIndex) {
      const html = content.substring(startIndex, endIndex).trim()
      if (html.length > 30) {
        console.log('[SERVICE] Found HTML structure, length:', html.length)
        return html
      }
    }
  }
  
  // 5. 检查是否包含 CSS 样式内容（可能是内联样式或样式块）
  const hasCssContent = /\{(?:[^{}]|\{[^{}]*\})*\}/.test(content) && (content.includes('font-family') || content.includes('color') || content.includes('background') || content.includes('margin') || content.includes('padding') || content.includes('width') || content.includes('height'))
  if (hasCssContent) {
    // 尝试提取从第一个 { 到最后一个 } 的内容作为 CSS
    const styleStart = content.indexOf('{')
    const styleEnd = content.lastIndexOf('}') + 1
    if (styleEnd > styleStart) {
      const styleContent = content.substring(styleStart, styleEnd).trim()
      if (styleContent.length > 20) {
        console.log('[SERVICE] Found CSS content, creating HTML wrapper')
        // 创建包含样式的简单HTML
        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 20px;
    }
    ${styleContent}
  </style>
</head>
<body>
  <div>${content.substring(0, Math.min(200, content.length)).replace(/[<>]/g, '')}</div>
</body>
</html>`
      }
    }
  }
  
  console.log('[SERVICE] No HTML content detected')
  return null
}

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
   * 获取对话详情（含消息和文件）
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

    // 获取所有消息关联的文件
    const [messageFiles] = await pool.execute(
      'SELECT mf.*, f.filename, f.file_path, f.file_type, f.size, f.uploaded_at FROM message_files mf JOIN files f ON mf.file_id = f.id WHERE mf.dialog_id = ?',
      [dialogId]
    )

    // 将文件信息按消息分组
    const filesByMessage = {}
    for (const file of messageFiles) {
      if (!filesByMessage[file.message_id]) {
        filesByMessage[file.message_id] = []
      }
      // 从 file_path 中提取实际存储的文件名
      const storedFilename = file.file_path.split(/[/\\]/).pop()
      filesByMessage[file.message_id].push({
        id: file.file_id,
        filename: file.filename,
        file_path: file.file_path,
        file_type: file.file_type,
        size: file.size,
        uploaded_at: file.uploaded_at,
        preview_url: file.file_type === 'image' ? `/uploads/${storedFilename}` : null
      })
    }

    // 将文件添加到对应的消息中
    for (const msg of messages) {
      msg.files = filesByMessage[msg.id] || []
    }

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
    
    // 关联文件与消息（如果存在文件）
    if (files && files.length > 0) {
      for (const fileId of files) {
        await pool.execute(
          'UPDATE files SET dialog_id = ? WHERE id = ? AND user_id = ?',
          [dialogId, fileId, userId]
        )
        // 创建消息文件关联记录
        try {
          const messageFileId = generateId()
          await pool.execute(
            'INSERT INTO message_files (id, message_id, file_id, dialog_id) VALUES (?, ?, ?, ?)',
            [messageFileId, userMsgId, fileId, dialogId]
          )
          console.log(`[SERVICE] sendMessage: 关联文件 ${fileId} 到消息 ${userMsgId}`)
        } catch (error) {
          console.error(`[SERVICE] sendMessage: 创建消息文件关联失败:`, error.message)
        }
      }
    }
    
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
    const chatMessages = []
    
    // 处理消息历史，为当前用户消息添加图片
    for (const historyMsg of recentHistory) {
      // 如果这是当前用户消息且包含文件，构建multimodal消息
      if (historyMsg.role === 'user' && files && files.length > 0) {
        const messageContent = [{
          type: 'text',
          text: historyMsg.content
        }]
        
        // 获取并添加图片
        for (const fileId of files) {
          try {
            const [fileRows] = await pool.execute(
              'SELECT file_path, file_type FROM files WHERE id = ? AND user_id = ?',
              [fileId, userId]
            )
            
            if (fileRows.length > 0) {
              const file = fileRows[0]
              if (file.file_type === 'image') {
                const base64Image = await aiService.imageToBase64(file.file_path)
                
                messageContent.push({
                  type: 'image_url',
                  image_url: {
                    url: base64Image
                  }
                })
                console.log(`[SERVICE] sendMessage: 添加图片到消息: ${fileId}`)
              }
            }
          } catch (error) {
            console.error(`[SERVICE] sendMessage: 处理文件 ${fileId} 失败:`, error.message)
          }
        }
        
        chatMessages.push({
          role: 'user',
          content: messageContent
        })
      } else {
        // 其他消息保持原样
        chatMessages.push({
          role: historyMsg.role === 'ai' ? 'assistant' : 'user',
          content: historyMsg.content
        })
      }
    }
    
    console.log(`[SERVICE] sendMessage: 聊天消息数量: ${chatMessages.length}`)

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
    // 提取 HTML 预览内容
    const htmlPreview = extractHtmlContent(aiContent)
    
    await pool.execute(
      `INSERT INTO dialog_messages (id, dialog_id, user_id, content, html_preview, role, parent_id)
       VALUES (?, ?, ?, ?, ?, "ai", ?)`,
      [aiMsgId, dialogId, userId, aiContent, htmlPreview, userMsgId]
    )

    // 获取用户消息关联的文件
    let userFiles = []
    if (files && files.length > 0) {
      for (const fileId of files) {
        const [fileRows] = await pool.execute(
          'SELECT id, filename, file_path, file_type, size, uploaded_at FROM files WHERE id = ? AND user_id = ?',
          [fileId, userId]
        )
        if (fileRows.length > 0) {
          const file = fileRows[0]
          // 从 file_path 中提取实际存储的文件名
          const storedFilename = file.file_path.split(/[/\\]/).pop()
          userFiles.push({
            id: file.id,
            filename: file.filename,
            file_path: file.file_path,
            file_type: file.file_type,
            size: file.size,
            uploaded_at: file.uploaded_at,
            preview_url: file.file_type === 'image' ? `/uploads/${storedFilename}` : null
          })
        }
      }
    }

    return successResponse({
      user_message: { id: userMsgId, content, role: 'user', files: userFiles },
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

    // 关联文件与消息（如果存在文件）
    if (files && files.length > 0) {
      for (const fileId of files) {
        await pool.execute(
          'UPDATE files SET dialog_id = ? WHERE id = ? AND user_id = ?',
          [dialogId, fileId, userId]
        )
        // 创建消息文件关联记录
        try {
          const messageFileId = generateId()
          await pool.execute(
            'INSERT INTO message_files (id, message_id, file_id, dialog_id) VALUES (?, ?, ?, ?)',
            [messageFileId, userMsgId, fileId, dialogId]
          )
          console.log(`[SERVICE] 关联文件 ${fileId} 到消息 ${userMsgId}`)
        } catch (error) {
          console.error(`[SERVICE] 创建消息文件关联失败:`, error.message)
        }
      }
    }

    await pool.execute(
      'UPDATE dialogs SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
      [dialogId]
    )

    // 获取对话历史（包含当前消息）
    const [history] = await pool.execute(
      'SELECT role, content FROM dialog_messages WHERE dialog_id = ? ORDER BY timestamp ASC',
      [dialogId]
    )
    const recentHistory = history.slice(-20)
    
    // 构建聊天消息用于AI
    const chatMessages = []
    
    // 添加历史消息
    for (const historyMsg of recentHistory) {
      // 如果这是当前用户消息，我们需要包含图片数据
      if (historyMsg.role === 'user' && files && files.length > 0) {
        // 对于当前消息，如果包含文件，构建multimodal消息
        const messageContent = [{
          type: 'text',
          text: historyMsg.content
        }]
        
        // 获取并添加图片
        for (const fileId of files) {
          try {
            // 获取文件信息
            const [fileRows] = await pool.execute(
              'SELECT file_path, file_type FROM files WHERE id = ? AND user_id = ?',
              [fileId, userId]
            )
            
            if (fileRows.length > 0) {
              const file = fileRows[0]
              // 只处理图片文件
              if (file.file_type === 'image') {
                const aiService = require('./ai.service')
                const base64Image = await aiService.imageToBase64(file.file_path)
                
                messageContent.push({
                  type: 'image_url',
                  image_url: {
                    url: base64Image
                  }
                })
                console.log(`[SERVICE] 添加图片到消息: ${fileId}`)
              }
            }
          } catch (error) {
            console.error(`[SERVICE] 处理文件 ${fileId} 失败:`, error.message)
          }
        }
        
        chatMessages.push({
          role: 'user',
          content: messageContent
        })
      } else {
        // 其他消息保持原样
        chatMessages.push({
          role: historyMsg.role === 'ai' ? 'assistant' : 'user',
          content: historyMsg.content
        })
      }
    }
    
    // 如果当前消息是新的（不在历史中），添加到chatMessages末尾
    // 注意：数据库查询可能已经包含了刚插入的消息，取决于服务器速度
    const currentMessageInHistory = recentHistory.some(m => m.role === 'user' && m.content === content)
    if (!currentMessageInHistory) {
      // 这是新消息，按上述流程处理
      const messageContent = [{
        type: 'text',
        text: content
      }]
      
      // 获取并添加图片（与上面相同逻辑）
      if (files && files.length > 0) {
        for (const fileId of files) {
          try {
            const [fileRows] = await pool.execute(
              'SELECT file_path, file_type FROM files WHERE id = ? AND user_id = ?',
              [fileId, userId]
            )
            
            if (fileRows.length > 0) {
              const file = fileRows[0]
              if (file.file_type === 'image') {
                const aiService = require('./ai.service')
                const base64Image = await aiService.imageToBase64(file.file_path)
                
                messageContent.push({
                  type: 'image_url',
                  image_url: {
                    url: base64Image
                  }
                })
                console.log(`[SERVICE] 添加图片到当前消息: ${fileId}`)
              }
            }
          } catch (error) {
            console.error(`[SERVICE] 处理当前消息文件 ${fileId} 失败:`, error.message)
          }
        }
      }
      
      chatMessages.push({
        role: 'user',
        content: messageContent
      })
    }
    
    console.log('[SERVICE] 聊天消息准备完成，数量:', chatMessages.length)

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
    let state = 'normal' // 'normal' 或 'html_block'
    let buffer = '' // 当前状态下的累积缓冲区
    let hasSentHtmlRender = false

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

        // 将 delta 追加到缓冲区
        buffer += delta

        // 处理缓冲区中的内容，可能产生多个事件
        while (true) {
          if (state === 'normal') {
            // 检测是否出现 ```html 或 ```htm 代码块开始（允许跨行）
            // 匹配模式：``` 后跟任意空白（包括换行），然后 html 或 htm
            const startMatch = buffer.match(/```[\s]*?(?:html|htm)\b/)
            if (startMatch) {
              const startIdx = buffer.indexOf(startMatch[0])
              // 发送开始标记之前的普通文本
              const beforeHtml = buffer.substring(0, startIdx)
              if (beforeHtml) {
                yield { type: 'chunk', text: beforeHtml }
              }
              // 找到开始标记后的第一个非空白字符
              const afterStart = buffer.substring(startIdx + startMatch[0].length)
              let skipChars = 0
              // 跳过可能的空白字符和换行符
              while (skipChars < afterStart.length && (afterStart[skipChars] === ' ' || afterStart[skipChars] === '\t' || afterStart[skipChars] === '\n' || afterStart[skipChars] === '\r')) {
                skipChars++
              }
              // 剩余部分包含开始标记之后的内容（去掉开始标记和空白）
              const remaining = afterStart.substring(skipChars)
              // 切换到 html_block 状态
              state = 'html_block'
              buffer = remaining
              console.log('[SERVICE] Switched to html_block state, buffer length:', buffer.length)
              // 继续循环，可能立即检测到结束标记
              continue
            }
            
            // 检测是否出现裸 HTML 文档开始（<!DOCTYPE html>、<html>、<body>、<head>等）
            // 但为了避免误匹配，我们只在这些标记出现在行首或前面只有空白时进行匹配
            const htmlDocStartMatch = buffer.match(/(?:^|\n)\s*(?:<!DOCTYPE\s+html|<html\b|<body\b|<head\b)/i)
            // 也检测更常见的HTML标签开头
            const htmlTagStartMatch = buffer.match(/(?:^|\n)\s*(?:<(?:div|span|p|h[1-6]|a|button|form|input|textarea|select|table|ul|ol|li|header|footer|nav|section|article|main|aside|img|video|audio|canvas|svg)\b)/i)
            if ((htmlDocStartMatch || htmlTagStartMatch) && !artifactType) {
              const match = htmlDocStartMatch || htmlTagStartMatch
              const startIdx = buffer.indexOf(match[0])
              // 发送开始标记之前的普通文本
              const beforeHtml = buffer.substring(0, startIdx)
              if (beforeHtml) {
                yield { type: 'chunk', text: beforeHtml }
              }
              // 切换到 html_block 状态，保留 HTML 开始标记
              state = 'html_block'
              buffer = buffer.substring(startIdx)
              console.log('[SERVICE] Switched to html_block state (naked HTML), buffer length:', buffer.length)
              continue
            }
            
            // 检查是否可能正在构建 HTML 开始标记（以 ``` 开头）
            // 我们需要处理 ``` 和 html/htm 可能在不同 chunk 的情况
            const backtickMatch = buffer.match(/```/)
            if (backtickMatch) {
              const backtickIdx = buffer.indexOf('```')
              // 检查 ``` 之后的内容是否可能成为 html/htm 标记
              const afterBackticks = buffer.substring(backtickIdx + 3) // 3个反引号
              
              // 情况1：``` 后面直接是空白，可能下一行是 html
              if (afterBackticks.length === 0 || /^[\s\r\n]*$/.test(afterBackticks)) {
                // 可能还在构建开始标记，等待更多数据
                console.log('[SERVICE] Found ``` followed by whitespace, waiting for language tag')
                break
              }
              
              // 情况2：``` 后面有一些字符，检查是否可能是 html/htm 的一部分
              // 例如：```h, ```ht, ```htm 等
              const partialMatch = afterBackticks.match(/^[\s]*?(?:h|ht|htm|html)?$/)
              if (partialMatch) {
                // 可能还在构建开始标记，等待更多数据
                console.log('[SERVICE] Found ``` with partial HTML tag:', afterBackticks.substring(0, 10))
                break
              }
              
              // 情况3：``` 后面有明显不是 html/htm 的内容
              // 例如：```js, ```python, ```text 等
              // 检查是否已经有一个完整的非html语言标记
              const otherLangMatch = afterBackticks.match(/^[\s]*?([a-zA-Z][a-zA-Z0-9]*)\b/)
              if (otherLangMatch && !/^(?:h|ht|htm|html)$/i.test(otherLangMatch[1].trim())) {
                // 这是其他语言的代码块
                console.log('[SERVICE] Found ``` with other language:', otherLangMatch[1])
                // 发送整个buffer作为普通文本
                if (buffer) {
                  yield { type: 'chunk', text: buffer }
                  buffer = ''
                }
                break
              }
              
              // 情况4：``` 后面有内容但不是有效的语言标识符
              // 可能是格式错误的代码块或只是普通文本中的 ```
              // 检查是否有换行符，如果有，可能是一个没有语言标识符的代码块
              const hasNewlineAfter = afterBackticks.includes('\n')
              if (hasNewlineAfter) {
                // 可能是一个没有语言标识符的代码块，发送整个buffer
                if (buffer) {
                  yield { type: 'chunk', text: buffer }
                  buffer = ''
                }
                break
              }
              
              // 其他情况：等待更多数据
              console.log('[SERVICE] Found ``` but unclear what follows:', afterBackticks.substring(0, 20))
              break
            }
            
            // 没有检测到 HTML 开始标记，发送整个缓冲区作为普通文本
            if (buffer) {
              yield { type: 'chunk', text: buffer }
              buffer = ''
            }
            break // 退出 while 循环，等待下一个 delta
          } else if (state === 'html_block') {
            // 检测是否出现结束标记 ```
            const endMatch = buffer.match(/```/)
            if (endMatch) {
              const endIdx = buffer.indexOf(endMatch[0])
              // 提取结束标记之前的 HTML 内容
              const htmlContent = buffer.substring(0, endIdx)
              // 按行拆分 HTML 内容并发送块
              if (!artifactType && htmlContent) {
                const lines = htmlContent.split('\n')
                for (const line of lines) {
                  const trimmedLine = line.trim()
                  if (trimmedLine.length > 0) {
                    console.log('[SERVICE] Sending HTML line (before ```):', trimmedLine.substring(0, 100))
                    yield { type: 'render', html: trimmedLine, artifactType: null, chunk: true }
                    hasSentHtmlRender = true
                  }
                }
              } else if (artifactType) {
                console.log('[SERVICE] HTML content detected in artifact mode (type:', artifactType, '), skipping render events')
              }
              // 剩余部分为结束标记之后的内容
              const remaining = buffer.substring(endIdx + endMatch[0].length)
              // 切换回 normal 状态
              state = 'normal'
              buffer = remaining
              console.log('[SERVICE] Switched back to normal state after HTML block, remaining buffer length:', buffer.length)
              // 继续循环，可能剩余内容中包含另一个开始标记
              continue
            }
            
            // 对于裸 HTML 文档，检测 </html> 结束标签
            // 注意：这里假设 HTML 文档是完整的，以 </html> 结束
            const htmlEndMatch = buffer.match(/<\/html>/i)
            if (htmlEndMatch && !artifactType) {
              const endIdx = buffer.indexOf(htmlEndMatch[0])
              // 提取结束标记之前的 HTML 内容（包含 </html>）
              const htmlContent = buffer.substring(0, endIdx + htmlEndMatch[0].length)
              // 按行拆分 HTML 内容并发送块
              const lines = htmlContent.split('\n')
              for (const line of lines) {
                const trimmedLine = line.trim()
                if (trimmedLine.length > 0) {
                  console.log('[SERVICE] Sending HTML line (including </html>):', trimmedLine.substring(0, 100))
                  yield { type: 'render', html: trimmedLine, artifactType: null, chunk: true }
                  hasSentHtmlRender = true
                }
              }
              // 剩余部分为结束标记之后的内容
              const remaining = buffer.substring(endIdx + htmlEndMatch[0].length)
              // 切换回 normal 状态
              state = 'normal'
              buffer = remaining
              console.log('[SERVICE] Switched back to normal state after naked HTML, remaining buffer length:', buffer.length)
              // 继续循环，可能剩余内容中包含另一个开始标记
              continue
            }
            
            // 尝试按行拆分 HTML 内容并流式发送
            // 查找换行符位置
            const newlineIndex = buffer.indexOf('\n')
            if (newlineIndex !== -1 && !artifactType) {
              // 提取该行（不包括换行符）
              const line = buffer.substring(0, newlineIndex)
              // 对于HTML内容，我们不能随意trim，因为空格可能是有意义的
              // 但可以移除行首和行尾的空白，保留中间的
              const trimmedLine = line.trim()
              if (trimmedLine.length > 0) {
                // 发送该行作为渲染事件（添加 chunk 标记）
                console.log('[SERVICE] Sending HTML line:', trimmedLine.substring(0, 100))
                yield { type: 'render', html: trimmedLine, artifactType: null, chunk: true }
                hasSentHtmlRender = true
              }
              // 从缓冲区中移除该行和换行符
              buffer = buffer.substring(newlineIndex + 1)
              // 继续循环，可能还有更多行
              continue
            }
            
            // 没有检测到结束标记，保持 html_block 状态，等待更多数据
            // 在 html_block 状态下，我们不发送任何 chunk，只累积内容
            break // 退出 while 循环，等待下一个 delta
          }
        }
      }

      console.log(`[SERVICE] AI stream complete, ${aiChunkCount} chunks, total ${fullContent.length} chars`)
      if (!fullContent) {
        console.warn('[SERVICE] WARNING: AI returned empty content!')
      }

      // 流结束后，处理可能剩余的内容
      if (state === 'normal' && buffer) {
        yield { type: 'chunk', text: buffer }
        buffer = ''
      }
      // 如果流结束时仍处于 html_block 状态，说明没有找到结束标记，可能格式错误
      if (state === 'html_block') {
        // 如果是代码块模式但没有结束标记，将 buffer 作为普通文本发送（加上开始标记）
        console.warn('[SERVICE] WARNING: HTML block not closed, sending as plain text')
        // 检查是否以代码块开始（根据之前的检测逻辑）
        if (fullContent.includes('```html') || fullContent.includes('```htm')) {
          yield { type: 'chunk', text: '```html\n' + buffer }
        } else {
          // 裸HTML文档，直接发送
          yield { type: 'chunk', text: buffer }
        }
        buffer = ''
      }
    } catch (e) {
      console.error('[SERVICE] AI service error:', e.message || e)
      fullContent = `抱歉，AI 回复生成失败：${e.message}，请稍后重试。`
      yield { type: 'chunk', text: fullContent }
    }

    // 保存完整回复到数据库（fullContent 包含所有原始内容，包括 HTML 代码块）
    const aiMsgId = generateId()
    // 提取 HTML 预览内容
    const htmlPreview = extractHtmlContent(fullContent)
    
    await pool.execute(
      `INSERT INTO dialog_messages (id, dialog_id, user_id, content, html_preview, role, parent_id)
       VALUES (?, ?, ?, ?, ?, "ai", ?)`,
      [aiMsgId, dialogId, userId, fullContent, htmlPreview, userMsgId]
    )
    console.log('[SERVICE] aiMessage saved:', aiMsgId, 'content length:', fullContent.length, 'html_preview length:', htmlPreview ? htmlPreview.length : 0)

  //此处调试不可删除
  console.log('[SERVICE] artifactType:', artifactType)
  console.log('[SERVICE] fullContent:', fullContent)
  // 检测并发送 HTML 渲染事件（仅限非制品模式）
  // 注意：如果已经在流式处理中发送了渲染事件，这里不再重复发送
  // 但为了兼容旧逻辑，我们仍然调用 extractHtmlContent 进行检测
  const htmlContent = extractHtmlContent(fullContent)
  if (htmlContent && !artifactType && !hasSentHtmlRender) {
    console.log('[SERVICE] HTML content detected in non-artifact mode (post-stream), sending render event')
    console.log('[SERVICE] Render event html length:', htmlContent.length)
    console.log('[SERVICE] Render event html sample:', htmlContent.substring(0, 200))
    // 确保在 done 事件之前发送 render 事件
    yield { type: 'render', html: htmlContent, artifactType: null, chunk: false }
    hasSentHtmlRender = true
  } else if (htmlContent && !hasSentHtmlRender) {
    console.log('[SERVICE] HTML content detected in artifact mode (type:', artifactType, '), skipping render event')
  } else {
    console.log('[SERVICE] No HTML content detected, fullContent length:', fullContent.length)
    console.log('[SERVICE] fullContent sample:', fullContent.substring(0, 300))
  }

  yield { type: 'done', id: aiMsgId }
  }

  /**
   * 编辑消息
   */
  async editMessage(dialogId, messageId, userId, content) {
    const normalizedContent = String(content || '').trim()
    const [[message]] = await pool.execute(
      'SELECT * FROM dialog_messages WHERE id = ? AND dialog_id = ? AND user_id = ?',
      [messageId, dialogId, userId]
    )
    if (!message) return errorResponse('消息不存在', 404)

    await pool.execute(
      'UPDATE dialog_messages SET content = ? WHERE id = ? AND dialog_id = ? AND user_id = ?',
      [normalizedContent, messageId, dialogId, userId]
    )

    if (message.role !== 'user') {
      const [[updatedMessage]] = await pool.execute(
        'SELECT * FROM dialog_messages WHERE id = ? AND dialog_id = ? AND user_id = ?',
        [messageId, dialogId, userId]
      )
      return successResponse(updatedMessage, '编辑成功')
    }

    const [history] = await pool.execute(
      'SELECT role, content FROM dialog_messages WHERE dialog_id = ? AND timestamp < ? ORDER BY timestamp ASC',
      [dialogId, message.timestamp]
    )

    const recentHistory = history.slice(-20)
    const chatMessages = recentHistory.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }))
    chatMessages.push({ role: 'user', content: normalizedContent })

    let aiContent
    try {
      aiContent = await aiService.chat(chatMessages, {
        system: AI_SYSTEM_PROMPT,
        max_tokens: 4096
      })
    } catch (e) {
      aiContent = `抱歉，AI 回复生成失败：${e.message}，请稍后重试。`
    }

    await pool.execute(
      'DELETE FROM dialog_messages WHERE dialog_id = ? AND (timestamp > ? OR (role = "ai" AND parent_id = ?))',
      [dialogId, message.timestamp, messageId]
    )

    const aiMsgId = generateId()
    // 提取 HTML 预览内容
    const htmlPreview = extractHtmlContent(aiContent)
    
    await pool.execute(
      `INSERT INTO dialog_messages (id, dialog_id, user_id, content, html_preview, role, parent_id, version)
       VALUES (?, ?, ?, ?, ?, "ai", ?, 1)`,
      [aiMsgId, dialogId, userId, aiContent, htmlPreview, messageId]
    )

    await pool.execute(
      'UPDATE dialogs SET updated_at = NOW(), last_message_at = NOW() WHERE id = ? AND user_id = ?',
      [dialogId, userId]
    )

    const [[updatedUserMessage]] = await pool.execute(
      'SELECT * FROM dialog_messages WHERE id = ? AND dialog_id = ? AND user_id = ?',
      [messageId, dialogId, userId]
    )
    const [[updatedAiMessage]] = await pool.execute(
      'SELECT * FROM dialog_messages WHERE id = ? AND dialog_id = ? AND user_id = ?',
      [aiMsgId, dialogId, userId]
    )

    return successResponse({
      user_message: updatedUserMessage,
      ai_message: updatedAiMessage
    }, '编辑成功')
  }

  /**
   * 重新生成消息
   * 无论用户消息还是AI消息，效果完全一样：重新生成当前轮次的AI回答
   * 1. 替换当前气泡内的AI回答
   * 2. 当前轮次之后的所有消息自动归档到历史记录（不再显示在主对话流）
   * 3. 创建新的对话分支
   */
  async regenerateMessage(dialogId, messageId, userId) {
    const [[msg]] = await pool.execute(
      'SELECT * FROM dialog_messages WHERE id = ? AND dialog_id = ? AND user_id = ?',
      [messageId, dialogId, userId]
    )
    if (!msg) return errorResponse('消息不存在', 404)

    // 确定父用户消息（当前轮次的用户消息）
    let parentUserMessage = msg
    if (msg.role === 'ai') {
      // 如果是AI消息，找到其父用户消息
      const [[parentMsg]] = await pool.execute(
        'SELECT * FROM dialog_messages WHERE id = ? AND dialog_id = ? AND user_id = ?',
        [msg.parent_id, dialogId, userId]
      )
      if (!parentMsg) return errorResponse('父用户消息不存在', 404)
      parentUserMessage = parentMsg
    }

    // 删除当前轮次之后的非分支消息（归档到历史记录）
    // 保留所有父消息ID为 parentUserMessage.id 的AI分支
    // 先获取所有需要保留的分支消息ID
    const [branchMessages] = await pool.execute(
      'SELECT id FROM dialog_messages WHERE dialog_id = ? AND parent_id = ?',
      [dialogId, parentUserMessage.id]
    )
    const branchIds = branchMessages.map(m => m.id)
    
    // 如果没有分支消息，直接删除所有后续消息
    if (branchIds.length === 0) {
      await pool.execute(
        'DELETE FROM dialog_messages WHERE dialog_id = ? AND timestamp > ?',
        [dialogId, parentUserMessage.timestamp]
      )
    } else {
      // 构建IN语句占位符
      const placeholders = branchIds.map(() => '?').join(',')
      await pool.execute(
        `DELETE FROM dialog_messages WHERE dialog_id = ? AND timestamp > ? AND id NOT IN (${placeholders})`,
        [dialogId, parentUserMessage.timestamp, ...branchIds]
      )
    }

    // 获取对话历史（到父用户消息为止）
    const [history] = await pool.execute(
      'SELECT role, content FROM dialog_messages WHERE dialog_id = ? AND timestamp < ? ORDER BY timestamp ASC',
      [dialogId, parentUserMessage.timestamp]
    )

    const recentHistory = history.slice(-20)
    const chatMessages = recentHistory.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }))

    // 将父用户消息的内容追加到上下文
    chatMessages.push({ role: 'user', content: parentUserMessage.content })

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

    // 计算新版本号：查找该父用户消息现有的AI回复最大版本号
    const [existingAiMessages] = await pool.execute(
      'SELECT version FROM dialog_messages WHERE parent_id = ? ORDER BY version DESC LIMIT 1',
      [parentUserMessage.id]
    )
    const newVersion = existingAiMessages.length > 0 ? existingAiMessages[0].version + 1 : 1

    const newMsgId = generateId()
    // 提取 HTML 预览内容
    const htmlPreview = extractHtmlContent(aiContent)
    
    await pool.execute(
      `INSERT INTO dialog_messages (id, dialog_id, user_id, content, html_preview, role, parent_id, version)
       VALUES (?, ?, ?, ?, ?, "ai", ?, ?)`,
      [newMsgId, dialogId, userId, aiContent, htmlPreview, parentUserMessage.id, newVersion]
    )

    return successResponse({ 
      id: newMsgId, 
      content: aiContent, 
      role: 'ai', 
      version: newVersion, 
      parent_id: parentUserMessage.id,
      timestamp: new Date().toISOString(),
      status: 'sent'
    })
  }

  /**
   * 获取消息分支版本
   */
  async getMessageBranches(dialogId, messageId, userId) {
    // 首先验证用户是否拥有此对话
    const [[dialog]] = await pool.execute(
      'SELECT id FROM dialogs WHERE id = ? AND user_id = ?',
      [dialogId, userId]
    )
    if (!dialog) return errorResponse('对话不存在或无权访问', 404)
    
    // 然后验证消息是否存在且属于该对话
    const [[parentMsg]] = await pool.execute(
      'SELECT id, role, parent_id FROM dialog_messages WHERE id = ? AND dialog_id = ?',
      [messageId, dialogId]
    )
    if (!parentMsg) return errorResponse('消息不存在', 404)

    // 对于AI消息，获取其父用户消息的分支
    const targetMessageId = parentMsg.role === 'ai' && parentMsg.parent_id 
      ? parentMsg.parent_id 
      : messageId

    const [branches] = await pool.execute(
      'SELECT id, content, role, version, timestamp as created_at, status FROM dialog_messages WHERE parent_id = ? ORDER BY version ASC',
      [targetMessageId]
    )
    return successResponse(branches)
  }
}

module.exports = new DialogService()
