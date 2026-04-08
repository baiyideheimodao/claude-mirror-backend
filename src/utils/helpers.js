const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')

/**
 * 生成UUID
 */
const generateId = () => uuidv4()

/**
 * 生成兑换码
 */
const generateRedemptionCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-'
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * 对话时间分组
 */
const groupDialogsByDate = (dialogs) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000)
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000)

  return {
    today: dialogs.filter(d => new Date(d.last_message_at || d.created_at) >= today),
    yesterday: dialogs.filter(d => {
      const dt = new Date(d.last_message_at || d.created_at)
      return dt >= yesterday && dt < today
    }),
    last_7_days: dialogs.filter(d => {
      const dt = new Date(d.last_message_at || d.created_at)
      return dt >= sevenDaysAgo && dt < yesterday
    }),
    last_30_days: dialogs.filter(d => {
      const dt = new Date(d.last_message_at || d.created_at)
      return dt >= thirtyDaysAgo && dt < sevenDaysAgo
    })
  }
}

/**
 * 统一响应格式
 */
const successResponse = (data, message = 'success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString()
})

const errorResponse = (message, statusCode = 400, details = null) => ({
  success: false,
  error: message,
  details,
  statusCode,
  timestamp: new Date().toISOString()
})

module.exports = {
  generateId,
  generateRedemptionCode,
  groupDialogsByDate,
  successResponse,
  errorResponse
}
