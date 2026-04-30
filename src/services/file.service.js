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
      // 其他可能的文本类型
      'text/x-markdown', 'application/markdown', 'application/x-markdown',
    ]
    // 允许的扩展名列表
    const allowedExtensions = ['.md', '.txt', '.pdf', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.html', '.css', '.js', '.json', '.xml', '.csv', '.sql', '.java', '.ts', '.go', '.rs', '.rb', '.php', '.c', '.cpp', '.yaml', '.yml', '.graphql']
    
    const ext = path.extname(file.originalname).toLowerCase()
    
    // 如果MIME类型在允许列表中，直接通过
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } 
    // 如果MIME类型不被允许，但扩展名在允许列表中，也通过（针对某些浏览器误判MIME类型的情况）
    else if (allowedExtensions.includes(ext)) {
      console.log(`[File Filter] Allowed by extension: ${file.originalname}, MIME: ${file.mimetype}, Ext: ${ext}`)
      cb(null, true)
    }
    else {
      console.log(`[File Filter] Rejected: ${file.originalname}, MIME: ${file.mimetype}, Ext: ${ext}`)
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

    // 对于图片文件，生成可访问的预览 URL
    // file.path 格式为 ./uploads/filename.ext 或 uploads/filename.ext
    let previewUrl = null
    if (fileType === 'image') {
      const filename = path.basename(file.path)
      previewUrl = `/uploads/${filename}`
    }
    
    return successResponse({
      id: fileId,
      filename: file.originalname,
      file_path: file.path,
      file_type: fileType,
      size: file.size,
      uploaded_at: new Date().toISOString(),
      preview_url: previewUrl
    }, '上传成功')
  }
}

module.exports = {
  fileService: new FileService(),
  uploadMiddleware: upload.single('file'),
  upload
}
