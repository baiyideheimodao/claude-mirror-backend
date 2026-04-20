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
   * 获取用户项目列表
   */
  async getList(userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    )
    return successResponse(rows)
  }

  /**
   * 将对话加入项目
   */
  async addDialog(projectId, dialogId, userId) {
    const [[project]] = await pool.execute(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      [projectId, userId]
    )
    if (!project) return errorResponse('项目不存在', 404)

    const [[dialog]] = await pool.execute(
      'SELECT id FROM dialogs WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [dialogId, userId]
    )
    if (!dialog) return errorResponse('对话不存在', 404)

    const [[relation]] = await pool.execute(
      'SELECT id FROM project_dialogs WHERE project_id = ? AND dialog_id = ?',
      [projectId, dialogId]
    )

    if (!relation) {
      await pool.execute(
        'INSERT INTO project_dialogs (project_id, dialog_id) VALUES (?, ?)',
        [projectId, dialogId]
      )
    }

    await pool.execute(
      'UPDATE projects SET updated_at = NOW() WHERE id = ? AND user_id = ?',
      [projectId, userId]
    )

    return successResponse(null, relation ? '该对话已在项目中' : '已添加到项目')
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
