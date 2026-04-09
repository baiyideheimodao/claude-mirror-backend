const { pool } = require('../config/database')
const { generateId, successResponse, errorResponse } = require('../utils/helpers')

class ArtifactService {
  /**
   * 创建Artifact
   */
  async createArtifact(userId, dialogId, type, content, language = null) {
    const id = generateId()
    await pool.execute(
      `INSERT INTO artifacts (id, dialog_id, user_id, type, content)
       VALUES (?, ?, ?, ?, ?)`,
      [id, dialogId, userId, type, content]
    )

    return successResponse({
      id, dialog_id: dialogId, type, content, language,
      render_url: `/api/v1/artifacts/${id}/render`,
      created_at: new Date().toISOString(), version: 1
    }, '创建成功', 201)
  }

  /**
   * 查询用户的 Artifact 列表
   */
  async listArtifacts(userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM artifacts WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    )
    return successResponse(rows)
  }

  /**
   * 渲染Artifact
   */
  async renderArtifact(artifactId, userId) {
    const [artifacts] = await pool.execute(
      'SELECT * FROM artifacts WHERE id = ? AND user_id = ?',
      [artifactId, userId]
    )
    if (artifacts.length === 0) return errorResponse('Artifact不存在', 404)

    const artifact = artifacts[0]
    // 根据类型渲染内容
    let renderedContent = artifact.content
    if (artifact.type === 'mermaid') {
      renderedContent = `<div class="mermaid">${artifact.content}</div>`
    } else if (artifact.type === 'web' || artifact.type === 'code') {
      renderedContent = `<pre><code class="language-${artifact.language || ''}">${this.escapeHtml(artifact.content)}</code></pre>`
    }

    return successResponse({
      id: artifact.id,
      type: artifact.type,
      content: renderedContent,
      raw_content: artifact.content,
      version: artifact.version
    })
  }

  escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

module.exports = new ArtifactService()
