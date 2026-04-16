const multer = require('multer')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const { pool } = require('../config/database')
const { generateId, successResponse, errorResponse } = require('../utils/helpers')
require('dotenv').config()

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024

// Multer配置
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      // 图片
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // 文档
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      // 纯文本 & 代码
      'text/plain', 'text/html', 'text/css', 'text/javascript', 'text/x-python',
      'application/json', 'application/xml', 'text/xml', 'text/markdown',
      'text/csv', 'text/x-sql', 'text/x-java-source',
      'text/typescript', 'application/typescript',
      'text/x-go', 'text/x-rust', 'text/x-ruby', 'text/x-php', 'text/x-c',
      'text/x-c++src', 'text/yaml', 'application/x-yaml', 'application/graphql',
    ]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('文件类型不支持'))
    }
  }
})

class FileService {
  /**
   * 上传文件
   */
  async uploadFile(file, userId, dialogId = null) {
    const fileType = file.mimetype.startsWith('image/') ? 'image' : 'document'
    const fileId = generateId()

    await pool.execute(
      `INSERT INTO files (id, user_id, dialog_id, filename, file_path, file_type, size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fileId, userId, dialogId, file.originalname, file.path, fileType, file.size]
    )

    return successResponse({
      id: fileId,
      filename: file.originalname,
      file_path: file.path,
      file_type: fileType,
      size: file.size,
      uploaded_at: new Date().toISOString()
    }, '上传成功')
  }
}

module.exports = {
  fileService: new FileService(),
  uploadMiddleware: upload.single('file'),
  upload
}
