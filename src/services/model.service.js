const { pool } = require('../config/database')
const { generateId, successResponse, errorResponse } = require('../utils/helpers')

class ModelService {
  /**
   * 获取模型列表
   */
  async getModels() {
    const [rows] = await pool.execute(
      'SELECT id, name, description, api_url, context_length, capabilities, cost_per_1k_tokens, is_active, status FROM models WHERE is_active = 1'
    )
    return successResponse(rows)
  }

  /**
   * 切换对话模型
   */
  async switchModel(modelId, dialogId, userId) {
    const [models] = await pool.execute(
      'SELECT * FROM models WHERE id = ? AND is_active = 1',
      [modelId]
    )
    if (models.length === 0) return errorResponse('模型不存在或不可用', 404)

    // 可在对话表中存储当前使用的模型ID，或使用会话级配置
    // 此处简化实现
    return successResponse({
      model_id: modelId,
      dialog_id: dialogId,
      model_name: models[0].name
    }, '模型切换成功')
  }
}

module.exports = new ModelService()
