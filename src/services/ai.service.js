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
    const TAG = `[AI-${Date.now()}]`
    console.log(`${TAG} ========== chatStream START ==========`)
    console.log(`${TAG} model: ${this.model}`)
    console.log(`${TAG} baseURL: ${this.client.baseURL}`)
    console.log(`${TAG} messages count: ${messages.length}`)

    const chatMessages = []
    if (options.system) {
      chatMessages.push({ role: 'system', content: options.system })
    }
    chatMessages.push(...messages)
    console.log(`${TAG} total messages (incl system): ${chatMessages.length}`)

    let stream
    try {
      console.log(`${TAG} >>> calling this.client.chat.completions.create({ stream: true })...`)
      stream = await this.client.chat.completions.create({
        model: this.model,
        messages: chatMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 4096,
        stream: true
      })
      console.log(`${TAG} <<< stream object returned, type=${typeof stream}, hasAsyncIterator=${!!stream[Symbol.asyncIterator]}`)
    } catch (e) {
      console.error(`${TAG} !!! create() THREW ERROR:`)
      console.error(`    status: ${e.status}`)
      console.error(`    code: ${e.code || 'N/A'}`)
      console.error(`    message: ${e.message}`)
      console.error(`    error type: ${e.constructor.name}`)
      throw e
    }

    let chunkIdx = 0
    let totalYielded = 0
    try {
      for await (const chunk of stream) {
        chunkIdx++
        const delta = chunk?.choices?.[0]?.delta?.content
        const finishReason = chunk?.choices?.[0]?.finish_reason

        // 每10个chunk或第一个chunk打印详情
        if (chunkIdx === 1 || chunkIdx % 20 === 0) {
          console.log(`${TAG} raw chunk #${chunkIdx}: delta="${(delta || '').substring(0, 40)}", finishReason=${finishReason}`)
        }

        if (delta) {
          totalYielded++
          yield delta
        }
        // 打印最后一个finish_reason
        if (finishReason) {
          console.log(`${TAG} finish_reason received at chunk #${chunkIdx}: ${finishReason}`)
        }
      }
      console.log(`${TAG} for-await loop ended. totalRawChunks=${chunkIdx}, totalContentChunksYielded=${totalYielded}`)
    } catch (iterErr) {
      console.error(`${TAG} !!! for-await loop THREW ERROR:`)
      console.error(`    message: ${iterErr.message}`)
      console.error(`    stack: ${iterErr.stack}`)
      console.error(`    error type: ${iterErr.constructor.name}`)
      throw iterErr
    }

    console.log(`${TAG} ========== chatStream END (normal) ==========`)
  }
}

module.exports = new AiService()
