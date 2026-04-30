// 测试分支功能修复
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api/v1';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImViNTYzMGQ3LTI1YjYtNGNlZi1hNWIwLWVhMGMxM2NhOWY2NSIsInVzZXJuYW1lIjoiYWRtaW4iLCJpYXQiOjE3NDMxNjY0MjMsImV4cCI6MTc0Mzc3MTIyM30.SomeValidToken';

const headers = {
  'Authorization': `Bearer ${TEST_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testMessageBranches() {
  console.log('测试 getMessageBranches 接口...');
  
  // 使用一个存在的对话ID和消息ID
  const dialogId = '7aa1c3ea-26da-42eb-b851-303c401a8841';
  const messageId = '13417ba2-a611-45dd-a61a-d38ac3e42101'; // 用户消息ID
  
  try {
    // 测试1：正常请求（属于当前用户的消息）
    const response = await axios.get(
      `${API_BASE}/dialogs/${dialogId}/messages/${messageId}/branch`,
      { headers }
    );
    
    console.log('测试1 - 正常请求:');
    console.log('状态码:', response.status);
    console.log('响应格式:', response.data.success ? 'success' : 'error');
    console.log('数据类型:', typeof response.data.data);
    console.log('数据内容:', Array.isArray(response.data.data) ? `${response.data.data.length} 条分支` : response.data.data);
    
    if (Array.isArray(response.data.data) && response.data.data.length > 0) {
      console.log('第一条分支字段检查:');
      const branch = response.data.data[0];
      console.log('  - id:', branch.id);
      console.log('  - content:', branch.content.substring(0, 50) + '...');
      console.log('  - role:', branch.role);
      console.log('  - version:', branch.version);
      console.log('  - created_at:', branch.created_at);
      console.log('  - status:', branch.status);
    }
    
    // 测试2：不存在的消息ID
    console.log('\n测试2 - 不存在的消息ID...');
    try {
      await axios.get(
        `${API_BASE}/dialogs/${dialogId}/messages/nonexistent-message-id/branch`,
        { headers }
      );
    } catch (error) {
      console.log('预期错误:', error.response?.status || error.code);
      console.log('错误信息:', error.response?.data?.error || error.message);
    }
    
    // 测试3：其他用户的对话ID（需要创建测试数据）
    console.log('\n测试3 - 不存在的对话ID...');
    try {
      await axios.get(
        `${API_BASE}/dialogs/nonexistent-dialog-id/messages/${messageId}/branch`,
        { headers }
      );
    } catch (error) {
      console.log('预期错误:', error.response?.status || error.code);
      console.log('错误信息:', error.response?.data?.error || error.message);
    }
    
    // 测试4：AI消息ID的分支
    console.log('\n测试4 - AI消息ID的分支...');
    const aiMessageId = '219c8f39-da9a-4f67-80ff-c230870719af'; // AI消息ID
    
    try {
      const aiResponse = await axios.get(
        `${API_BASE}/dialogs/${dialogId}/messages/${aiMessageId}/branch`,
        { headers }
      );
      console.log('状态码:', aiResponse.status);
      console.log('响应格式:', aiResponse.data.success ? 'success' : 'error');
      if (aiResponse.data.data) {
        console.log('分支数量:', Array.isArray(aiResponse.data.data) ? aiResponse.data.data.length : 'N/A');
      }
    } catch (error) {
      console.log('错误:', error.response?.status || error.code);
      console.log('错误信息:', error.response?.data?.error || error.message);
    }
    
  } catch (error) {
    console.error('测试过程中出错:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

async function testRegenerate() {
  console.log('\n\n测试 regenerateMessage 接口...');
  
  const dialogId = '7aa1c3ea-26da-42eb-b851-303c401a8841';
  const messageId = '13417ba2-a611-45dd-a61a-d38ac3e42101'; // 用户消息ID
  
  try {
    const response = await axios.post(
      `${API_BASE}/dialogs/${dialogId}/messages/${messageId}/regenerate`,
      {},
      { headers }
    );
    
    console.log('重新生成响应:');
    console.log('状态码:', response.status);
    console.log('成功:', response.data.success);
    console.log('返回消息字段:');
    
    if (response.data.data) {
      const data = response.data.data;
      console.log('  - id:', data.id);
      console.log('  - content:', data.content.substring(0, 50) + '...');
      console.log('  - role:', data.role);
      console.log('  - version:', data.version);
      console.log('  - parent_id:', data.parent_id);
      console.log('  - timestamp:', data.timestamp);
      console.log('  - status:', data.status);
    }
    
  } catch (error) {
    console.error('重新生成测试错误:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    }
  }
}

// 运行测试
async function runTests() {
  console.log('开始测试分支功能修复...\n');
  
  await testMessageBranches();
  await testRegenerate();
  
  console.log('\n测试完成！');
}

runTests().catch(console.error);