const { pool } = require('../config/database')
const { generateId, successResponse, errorResponse } = require('../utils/helpers')

class ProjectService {
  /**
   * 创建项目
   */
  async createProject(userId, name, description, icon = null) {
    const id = generateId()
    await pool.execute(
      'INSERT INTO projects (id, user_id, name, description, icon) VALUES (?, ?, ?, ?, ?)',
      [id, userId, name, description, icon]
    )

    const [[project]] = await pool.execute('SELECT * FROM projects WHERE id = ?', [id])
    return successResponse(project, '项目创建成功', 201)
  }

  /**
   * 上传知识库文件
   */
  async uploadKnowledgeBase(projectId, userId, fileId) {
    await pool.execute(
      'INSERT INTO project_knowledge (project_id, file_id) VALUES (?, ?)',
      [projectId, fileId]
    )
    return successResponse(null, '上传成功')
  }

  /**
   * 设置System Prompt
   */
  async setSystemPrompt(projectId, userId, systemPrompt) {
    await pool.execute(
      'UPDATE projects SET system_prompt = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [systemPrompt, projectId, userId]
    )
    return successResponse(null, '设置成功')
  }
}

module.exports = new ProjectService()
