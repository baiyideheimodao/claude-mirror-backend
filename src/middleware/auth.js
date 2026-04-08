const jwt = require('jsonwebtoken')
require('dotenv').config()

/**
 * JWT认证中间件
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: '未提供认证令牌' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ success: false, error: '令牌无效或已过期' })
  }
}

/**
 * 管理员权限中间件
 */
const requireAdmin = (req, res, next) => {
  // 检查X-Admin-Role头或用户角色
  const adminRole = req.headers['x-admin-role']
  if (!adminRole && req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: '需要管理员权限' })
  }
  next()
}

module.exports = { authenticate, requireAdmin }
