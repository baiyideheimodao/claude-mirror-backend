const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: 'sk-c23sUfYzW3ez613OPyxsIjPmflID1oI2fDKhUUWYfNlwDknf',
  baseURL: 'https://api.lingshi.chat/v1'
});

async function testVisionSupport() {
  console.log('测试AI API Vision支持...');
  console.log('API地址:', client.baseURL);
  
  try {
    // 首先测试是否能正常调用聊天API
    console.log('\n测试常规聊天API...');
    const chatResponse = await client.chat.completions.create({
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: '你好，这是一个测试，请回答"测试成功"' }],
      max_tokens: 50
    });
    console.log('常规API测试成功:', chatResponse.choices[0]?.message?.content?.substring(0, 50) + '...');
    
    // 测试基础图片分析（使用文本询问能否分析图片）
    console.log('\n测试询问是否支持图片分析...');
    const visionTestResponse = await client.chat.completions.create({
      model: 'claude-haiku-4-5',
      messages: [{ 
        role: 'user', 
        content: '你支持图片分析功能吗？如果支持，请告诉我你的能力和支持的图片格式。' 
      }],
      max_tokens: 200
    });
    console.log('图片分析能力测试:', visionTestResponse.choices[0]?.message?.content?.substring(0, 100) + '...');
    
  } catch (error) {
    console.error('API测试失败:', error.message);
    if (error.status) console.error('HTTP状态码:', error.status);
    if (error.code) console.error('错误代码:', error.code);
  }
}

testVisionSupport();