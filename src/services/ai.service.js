const OpenAI = require('openai')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

class AiService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL || 'https://api.lingshi.chat/v1'
    })
    this.model = process.env.AI_MODEL || 'claude-haiku-4-5'
  }

  /**
   * 通用聊天补全
   * @param {Array} messages - OpenAI 格式的消息数组 [{ role, content }]
   * @param {Object} options - 可选参数 { temperature, max_tokens, system }
   * @returns {Promise<string>} AI 回复文本
   */
  async chat(messages, options = {}) {
    const chatMessages = []

    // 如果有 system prompt，插入到最前面
    if (options.system) {
      chatMessages.push({ role: 'system', content: options.system })
    }

    chatMessages.push(...messages)

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: chatMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096
    })

    return response.choices[0]?.message?.content || ''
  }

  /**
   * 流式聊天补全
   * @param {Array} messages
   * @param {Object} options
   * @returns {AsyncGenerator} 逐块返回文本
   */
  async *chatStream(messages, options = {}) {
    const chatMessages = []
    if (options.system) {
      chatMessages.push({ role: 'system', content: options.system })
    }
    chatMessages.push(...messages)

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: chatMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096,
      stream: true
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        yield delta
      }
    }
  }
}

module.exports = new AiService()
