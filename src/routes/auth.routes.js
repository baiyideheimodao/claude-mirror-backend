const express = require('express')
const router = express.Router()
const authService = require('../services/auth.service')
const {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation
} = require('../middleware/validate')

// 注册
router.post('/register', registerValidation, async (req, res) => {
  const result = await authService.register(req.body.username, req.body.email, req.body.password)
  res.status(result.statusCode || 201).json(result)
})

// 登录
router.post('/login', loginValidation, async (req, res) => {
  const result = await authService.login(req.body.username, req.body.password)
  res.status(result.statusCode || 200).json(result)
})

// 忘记密码
router.post('/forgot-password', forgotPasswordValidation, async (req, res) => {
  const result = await authService.forgotPassword(req.body.email)
  res.status(result.statusCode || 200).json(result)
})

// 重置密码
router.post('/reset-password', resetPasswordValidation, async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.new_password)
  res.status(result.statusCode || 200).json(result)
})

module.exports = router
