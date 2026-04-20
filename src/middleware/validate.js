const { body, query, param, validationResult } = require('express-validator')

/**
 * 验证结果处理
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: '参数验证失败',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    })
  }
  next()
}

// ========== 认证相关验证规则 ==========
const registerValidation = [
  body('username').trim().isLength({ min: 3 }).withMessage('用户名至少3个字符'),
  body('email').isEmail().withMessage('邮箱格式不正确'),
  body('password').isLength({ min: 8 }).withMessage('密码至少8个字符'),
  handleValidationErrors
]

const loginValidation = [
  body('username').notEmpty().withMessage('请输入用户名或邮箱'),
  body('password').notEmpty().withMessage('请输入密码'),
  handleValidationErrors
]

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('邮箱格式不正确'),
  handleValidationErrors
]

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('请提供重置token'),
  body('new_password').isLength({ min: 8 }).withMessage('新密码至少8个字符'),
  handleValidationErrors
]

// ========== 对话相关验证 ==========
const createDialogValidation = [handleValidationErrors]
const updateDialogValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('标题不能为空')
    .isLength({ max: 200 })
    .withMessage('标题不能超过200个字符'),
  handleValidationErrors
]
const pinDialogValidation = [
  body('is_pinned').isBoolean().withMessage('收藏状态无效'),
  handleValidationErrors
]
const sendMessageValidation = [
  body('content').notEmpty().withMessage('消息内容不能为空'),
  handleValidationErrors
]
const editMessageValidation = [
  body('content').notEmpty().withMessage('消息内容不能为空'),
  handleValidationErrors
]

// ========== 分页参数验证 ==========
const paginationQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('size').optional().isInt({ min: 1, max: 100 })
]

// ========== UUID参数验证 ==========
const dialogIdParam = [
  param('dialogId').isUUID().withMessage('对话ID格式无效'),
  handleValidationErrors
]
const projectIdParam = [
  param('projectId').isUUID().withMessage('项目ID格式无效'),
  handleValidationErrors
]

// ========== 兑换码验证 ==========
const useRedemptionCodeValidation = [
  body('code').notEmpty().withMessage('兑换码不能为空'),
  handleValidationErrors
]

// ========== Artifact创建验证 ==========
const createArtifactValidation = [
  body('type').isIn(['code', 'web', 'mermaid', 'doc']).withMessage('Artifact类型无效'),
  body('content').notEmpty().withMessage('内容不能为空'),
  handleValidationErrors
]

// ========== Agent相关验证 ==========
const generateCodeValidation = [
  body('language').isIn(['python','javascript','java','cpp','go','rust','php','ruby','sql','shell']).withMessage('编程语言无效'),
  body('requirement').notEmpty().withMessage('需求描述不能为空'),
  handleValidationErrors
]

const debugCodeValidation = [
  body('code').notEmpty().withMessage('代码不能为空'),
  body('error_message').notEmpty().withMessage('错误信息不能为空'),
  handleValidationErrors
]

const createProjectValidation = [
  body('name').notEmpty().withMessage('项目名称不能为空'),
  handleValidationErrors
]

// ========== 管理后台验证 ==========
const generateRedemptionCodesValidation = [
  body('plan_id').isInt().withMessage('套餐ID无效'),
  body('count').isInt({ min: 1 }).withMessage('数量必须大于0'),
  body('expires_at').isISO8601().withMessage('过期时间格式无效'),
  handleValidationErrors
]

const createPlanValidation = [
  body('name').notEmpty(),
  body('duration_days').isInt({ min: 1 }),
  body('hourly_limit').isInt({ min: -1 }),
  body('daily_limit').isInt({ min: -1 }),
  body('price').isFloat({ min: 0 }),
  handleValidationErrors
]

module.exports = {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  createDialogValidation,
  updateDialogValidation,
  pinDialogValidation,
  sendMessageValidation,
  editMessageValidation,
  paginationQuery,
  dialogIdParam,
  projectIdParam,
  useRedemptionCodeValidation,
  createArtifactValidation,
  generateCodeValidation,
  debugCodeValidation,
  createProjectValidation,
  generateRedemptionCodesValidation,
  createPlanValidation
}
