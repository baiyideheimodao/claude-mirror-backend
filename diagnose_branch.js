// 诊断分支API 404问题
const { pool } = require('./src/config/database')

async function diagnoseBranchIssue() {
  const dialogId = 'a66adbed-fca2-4876-89c9-591a084fe116'
  const messageId = 'ai_stream_1777536604686'
  
  console.log('=== 诊断分支API问题 ===')
  console.log(`对话ID: ${dialogId}`)
  console.log(`消息ID: ${messageId}`)
  
  try {
    // 1. 检查对话是否存在
    const [[dialog]] = await pool.execute(
      'SELECT id, user_id FROM dialogs WHERE id = ?',
      [dialogId]
    )
    
    if (!dialog) {
      console.log('❌ 错误：对话不存在')
      return
    }
    
    console.log('✅ 对话存在')
    console.log(`对话信息: ID=${dialog.id}, user_id=${dialog.user_id}`)
    
    // 2. 检查消息是否存在
    const [[message]] = await pool.execute(
      'SELECT id, role, parent_id, dialog_id, version FROM dialog_messages WHERE id = ?',
      [messageId]
    )
    
    if (!message) {
      console.log('❌ 错误：消息不存在于数据库中')
      
      // 检查是否是对话ID不匹配的问题
      const [[messageInDialog]] = await pool.execute(
        'SELECT id, role, parent_id, dialog_id, version FROM dialog_messages WHERE dialog_id = ? AND id = ?',
        [dialogId, messageId]
      )
      
      if (!messageInDialog) {
        console.log('❌ 错误：消息也不存在于指定对话中')
      }
      
      // 检查数据库中是否有任何 ai_stream_ 前缀的消息
      console.log('\n=== 检查是否有其他临时消息 ===')
      const [allTempMessages] = await pool.execute(
        'SELECT id, role, parent_id, dialog_id FROM dialog_messages WHERE id LIKE "ai_stream_%"'
      )
      
      console.log(`数据库中找到 ${allTempMessages.length} 个临时消息：`)
      allTempMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ID=${msg.id}, role=${msg.role}, parent_id=${msg.parent_id}, dialog_id=${msg.dialog_id}`)
      })
      
      // 检查此对话中的消息
      const [dialogMessages] = await pool.execute(
        'SELECT id, role, parent_id FROM dialog_messages WHERE dialog_id = ? ORDER BY timestamp DESC LIMIT 20',
        [dialogId]
      )
      
      console.log(`\n对话 ${dialogId} 中的最近消息：`)
      dialogMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ID=${msg.id}, role=${msg.role}, parent_id=${msg.parent_id || '(无)'}`)
      })
      
      return
    }
    
    console.log('✅ 消息存在')
    console.log(`消息信息: ID=${message.id}, role=${message.role}, parent_id=${message.parent_id}, dialog_id=${message.dialog_id}, version=${message.version}`)
    
    if (message.dialog_id !== dialogId) {
      console.log('⚠️ 警告：消息不属于此对话')
      console.log(`消息的对话ID: ${message.dialog_id}`)
      console.log(`请求的对话ID: ${dialogId}`)
    }
    
    // 3. 如果是AI消息，查找其父用户消息
    let parentMessageId = message.role === 'ai' && message.parent_id ? message.parent_id : messageId
    
    const [[parentMessage]] = await pool.execute(
      'SELECT id, role, dialog_id FROM dialog_messages WHERE id = ?',
      [parentMessageId]
    )
    
    if (!parentMessage) {
      console.log('❌ 错误：父消息不存在')
      return
    }
    
    console.log(`父消息信息: ID=${parentMessage.id}, role=${parentMessage.role}, dialog_id=${parentMessage.dialog_id}`)
    
    // 4. 查找所有分支
    const [branches] = await pool.execute(
      'SELECT id, role, parent_id, version FROM dialog_messages WHERE parent_id = ? ORDER BY version ASC',
      [parentMessageId]
    )
    
    console.log(`分支数量: ${branches.length}`)
    branches.forEach((branch, index) => {
      console.log(`  ${index + 1}. ID=${branch.id}, role=${branch.role}, parent_id=${branch.parent_id}, version=${branch.version}`)
    })
    
    // 5. 检查getMessageBranches逻辑
    console.log('\n=== 模拟getMessageBranches函数逻辑 ===')
    console.log(`消息ID: ${messageId}`)
    console.log(`消息role: ${message.role}`)
    console.log(`消息parent_id: ${message.parent_id}`)
    
    const targetMessageId = message.role === 'ai' && message.parent_id ? message.parent_id : messageId
    console.log(`targetMessageId（用于查找分支）: ${targetMessageId}`)
    
    const [allBranches] = await pool.execute(
      'SELECT id, content, role, version, timestamp as created_at, status FROM dialog_messages WHERE parent_id = ? ORDER BY version ASC',
      [targetMessageId]
    )
    
    console.log(`应返回的分支数量: ${allBranches.length}`)
    
    // 6. 检查用户权限（模拟接口调用）
    console.log('\n=== 模拟接口权限检查 ===')
    console.log('需要知道用户ID来进行权限检查')
    
    // 查看所有用户
    const [users] = await pool.execute('SELECT id, email FROM users')
    console.log('系统用户:')
    users.forEach(user => {
      console.log(`  ID=${user.id}, email=${user.email}`)
    })
    
  } catch (error) {
    console.error('诊断错误:', error)
  }
}

diagnoseBranchIssue().then(() => {
  console.log('\n=== 诊断完成 ===')
  process.exit(0)
}).catch(err => {
  console.error('诊断失败:', err)
  process.exit(1)
})