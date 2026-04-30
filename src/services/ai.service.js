const OpenAI = require('openai')
const path = require('path')
const fs = require('fs').promises
const crypto = require('crypto')
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
   * 通用聊天补全（支持图片）
   * @param {Array} messages - OpenAI 格式的消息数组 [{ role, content }]，支持multimodal格式
   * @param {Object} options - 可选参数 { temperature, max_tokens, system }
   * @returns {Promise<string>} AI 回复文本
   */
  async chat(messages, options = {}) {
    const chatMessages = []

    // 如果有 system prompt，插入到最前面
    if (options.system) {
      chatMessages.push({ role: 'system', content: options.system })
    }

    // 处理消息，转换包含图片的消息为multimodal格式
    const processedMessages = await this.processMessagesWithImages(messages)
    chatMessages.push(...processedMessages)

    console.log(`[AI Service] 调用模型: ${this.model}, 消息数: ${chatMessages.length}`)

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: chatMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096
    })

    return response.choices[0]?.message?.content || ''
  }

  /**
   * 流式聊天补全（支持图片）
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
    
    // 处理消息，转换包含图片的消息为multimodal格式
    const processedMessages = await this.processMessagesWithImages(messages)
    chatMessages.push(...processedMessages)
    
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

  /**
   * 处理消息中的图片，将其转换为base64格式
   * @param {Array} messages - 原始消息数组
   * @returns {Promise<Array>} 处理后的消息数组
   */
  async processMessagesWithImages(messages) {
    const processedMessages = []
    
    for (const message of messages) {
      // 如果消息是标准的OpenAI格式（包含content字段）
      if (message.content) {
        // 如果content是字符串，直接使用
        if (typeof message.content === 'string') {
          processedMessages.push(message)
        }
        // 如果content是数组（包含multimodal内容）
        else if (Array.isArray(message.content)) {
          // 处理multimodal消息中的图片
          const processedContent = []
          for (const item of message.content) {
            if (item.type === 'image_url' && item.image_url && item.image_url.url) {
              // 图片base64数据已经提供，直接使用
              processedContent.push(item)
            } else if (item.type === 'text') {
              // 文本内容
              processedContent.push(item)
            }
          }
          processedMessages.push({
            ...message,
            content: processedContent
          })
        }
      } else {
        // 保留其他格式的消息
        processedMessages.push(message)
      }
    }
    
    return processedMessages
  }

  /**
   * 将本地图片文件转换为base64字符串
   * @param {string} filePath - 图片文件路径
   * @param {number} maxSize - 最大文件大小（字节）
   * @returns {Promise<string>} base64编码的图片字符串
   */
  async imageToBase64(filePath, maxSize = 4 * 1024 * 1024) { // 默认4MB限制
    try {
      // 检查文件大小
      const stats = await fs.stat(filePath)
      if (stats.size > maxSize) {
        throw new Error(`图片文件过大: ${stats.size}字节 > ${maxSize}字节限制`)
      }
      
      // 读取文件
      const imageBuffer = await fs.readFile(filePath)
      
      // 确定MIME类型
      let mimeType = 'image/jpeg'
      const extension = filePath.split('.').pop().toLowerCase()
      if (extension === 'png') {
        mimeType = 'image/png'
      } else if (extension === 'gif') {
        mimeType = 'image/gif'
      } else if (extension === 'webp') {
        mimeType = 'image/webp'
      }
      
      // 转换为base64
      const base64Image = imageBuffer.toString('base64')
      return `data:${mimeType};base64,${base64Image}`
    } catch (error) {
      console.error('[AI Service] 图片转换base64失败:', error.message)
      throw error
    }
  }
}

module.exports = new AiService()
