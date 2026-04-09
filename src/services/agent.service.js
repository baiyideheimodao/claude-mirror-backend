const { successResponse, errorResponse } = require('../utils/helpers')
const aiService = require('./ai.service')

class AgentService {
  /**
   * 生成代码
   */
  async generateCode(language, requirement, contextFiles = []) {
    try {
      // 构建上下文信息
      let contextInfo = ''
      if (contextFiles && contextFiles.length > 0) {
        contextInfo = `\n\n参考上下文文件：\n${contextFiles.map(f => `- ${f}`).join('\n')}`
      }

      const systemPrompt = `你是一个专业的编程助手。用户会给你一个编程需求，你需要生成高质量的代码。
请用以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "code": "生成的代码内容",
  "explanation": "代码说明"
}`

      const content = `请用 ${language} 语言实现以下需求：${requirement}${contextInfo}`

      const result = await aiService.chat(
        [{ role: 'user', content }],
        { system: systemPrompt, temperature: 0.3, max_tokens: 4096 }
      )

      // 尝试解析 JSON
      let parsed
      try {
        // 去除可能的 markdown 代码块标记
        const cleaned = result.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
        parsed = JSON.parse(cleaned)
      } catch {
        // JSON 解析失败，直接返回原始文本
        parsed = { code: result, explanation: '代码已生成' }
      }

      return successResponse({
        code: parsed.code || result,
        explanation: parsed.explanation || ''
      })
    } catch (e) {
      return errorResponse(`代码生成失败：${e.message}`, 500)
    }
  }

  /**
   * Bug分析与修复
   */
  async debugCode(code, errorMessage) {
    try {
      const systemPrompt = `你是一个专业的代码调试助手。用户会给你一段代码和错误信息，你需要分析原因并修复。
请用以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "cause": "错误原因分析",
  "fixed_code": "修复后的完整代码",
  "suggestion": "改进建议"
}`

      const content = `以下代码出现了错误，请分析并修复：

代码：
\`\`\`
${code}
\`\`\`

错误信息：
${errorMessage}`

      const result = await aiService.chat(
        [{ role: 'user', content }],
        { system: systemPrompt, temperature: 0.3, max_tokens: 4096 }
      )

      let parsed
      try {
        const cleaned = result.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
        parsed = JSON.parse(cleaned)
      } catch {
        parsed = { cause: result, fixed_code: code, suggestion: '' }
      }

      return successResponse({
        cause: parsed.cause || '分析完成',
        fixed_code: parsed.fixed_code || code,
        suggestion: parsed.suggestion || ''
      })
    } catch (e) {
      return errorResponse(`调试失败：${e.message}`, 500)
    }
  }

  /**
   * 生成项目骨架
   */
  async createProjectSkeleton(projectName, requirement) {
    try {
      const systemPrompt = `你是一个专业的项目架构师。用户会给你项目名称和需求，你需要设计项目结构并生成关键文件。
请用以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "directory_structure": "项目的目录树结构（文本形式）",
  "files": [
    { "path": "文件相对路径", "content": "文件内容" }
  ]
}
至少包含 package.json、主入口文件、README.md 等基础文件。文件内容要具体、可运行。`

      const content = `请为以下项目生成项目骨架：

项目名称：${projectName}
项目需求：${requirement}`

      const result = await aiService.chat(
        [{ role: 'user', content }],
        { system: systemPrompt, temperature: 0.4, max_tokens: 4096 }
      )

      let parsed
      try {
        const cleaned = result.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
        parsed = JSON.parse(cleaned)
      } catch {
        // 解析失败，返回简单的默认结构
        parsed = {
          directory_structure: `${projectName}/\n├── src/\n│   └── index.js\n├── package.json\n└── README.md`,
          files: [
            { path: 'package.json', content: JSON.stringify({ name: projectName, version: '1.0.0', main: 'src/index.js' }, null, 2) },
            { path: 'src/index.js', content: `// Main entry point for ${projectName}` },
            { path: 'README.md', content: `# ${projectName}\n\n${requirement}` }
          ]
        }
      }

      return successResponse({
        directory_structure: parsed.directory_structure || '',
        files: parsed.files || []
      })
    } catch (e) {
      return errorResponse(`项目生成失败：${e.message}`, 500)
    }
  }
}

module.exports = new AgentService()
