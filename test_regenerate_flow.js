// 分析重试功能的工作流
console.log('=== 分析重试功能的正确工作流 ===\n')

// 后端regenerateMessage的正确行为：
console.log('1. 后端行为（正确）：')
console.log('   - 接收消息ID（用户或AI消息）')
console.log('   - 验证消息存在且属于用户')
console.log('   - 确定父用户消息ID')
console.log('   - 删除后续非分支消息')
console.log('   - 使用AI生成新回复')
console.log('   - 生成新的数据库ID（generateId()）')
console.log('   - 插入数据库并返回新消息：{id: "msg_real_xxx", ...}')
console.log('   - API路径：POST /dialogs/{dialogId}/messages/{messageId}/regenerate')

// 前端行为（正确）：
console.log('\n2. 前端行为（正确）：')
console.log('   - 用户点击AI消息下的"重试"按钮')
console.log('   - 调用 handleRegenerate(aiMessageId)')
console.log('   - 调用 appStore.regenerateMessage(dialogId, aiMessageId)')
console.log('   - 后端返回新AI消息 {id: "msg_real_...", parent_id: "user_msg_xx", version: N}')
console.log('   - store将新消息插入到正确位置（父用户消息之后）')
console.log('   - 消息ID应该是数据库真实ID，不是临时ID')

// 问题分析：
console.log('\n3. 可能的问题来源：')
console.log('   a) 临时消息没有被正确替换：')
console.log('      当用户发送新消息时，会创建临时消息 ai_stream_xxx')
console.log('      这个临时消息应该在AI回复完成时被替换为真实消息')
console.log('      如果替换失败，临时消息会留在界面上')
console.log('   b) 分支系统误用了临时消息：')
console.log('      hasMultipleBranches 可能判断临时消息有分支')
console.log('      然后尝试获取分支API，但临时消息不在数据库中')
console.log('   c) 其他前端逻辑问题：')
console.log('      可能在前端某些地方错误地创建/保留临时消息ID')

// 需要检查的关键点：
console.log('\n4. 需要检查的关键点：')
console.log('   a) 检查是否有AI消息使用了 ai_stream_ 前缀')
console.log('      SELECT id FROM dialog_messages WHERE id LIKE "ai_stream_%";')
console.log('   b) 检查store中messages数组的内容')
console.log('      重试后的消息ID是否正确')
console.log('   c) 检查分支缓存机制')
console.log('      branchHistory 是否缓存了临时消息ID')

// 测试代码：
console.log('\n5. 数据库检查脚本：')
console.log(`// 检查是否有 ai_stream_ 前缀的消息
const [tempMessages] = await pool.execute(
  'SELECT id, role, parent_id FROM dialog_messages WHERE id LIKE "ai_stream_%"'
)
console.log('临时消息数量：', tempMessages.length)
tempMessages.forEach(msg => {
  console.log(\`  消息ID: \${msg.id}, 角色: \${msg.role}, 父ID: \${msg.parent_id}\`)
})
`)

console.log('\n=== 结论 ===')
console.log('应该在数据库层面检查是否真的存在 ai_stream_ 前缀的消息。')
console.log('如果存在，说明临时消息被错误地保存到了数据库。')
console.log('如果不存在，说明前端在显示已经不在数据库中的临时消息ID。')