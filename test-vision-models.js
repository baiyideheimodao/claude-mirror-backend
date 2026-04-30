const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: 'sk-c23sUfYzW3ez613OPyxsIjPmflID1oI2fDKhUUWYfNlwDknf',
  baseURL: 'https://api.lingshi.chat/v1'
});

async function testVisionCapabilities() {
  console.log('测试模型Vision支持...\n');
  
  // 测试的模型列表
  const modelsToTest = [
    'claude-haiku-4-5',  // 当前使用的模型
    'claude-opus-4-5',   // 更强的模型
    'claude-sonnet-4-5'  // 另一个候选
  ];
  
  for (const model of modelsToTest) {
    console.log(`=== 测试模型: ${model} ===`);
    
    try {
      // 测试1: 直接询问是否支持图片分析
      const response1 = await client.chat.completions.create({
        model: model,
        messages: [{ 
          role: 'user', 
          content: '你支持分析图片或处理图像吗？如果支持，请说明你的能力。' 
        }],
        max_tokens: 100,
        temperature: 0.3
      });
      console.log(`询问结果: ${response1.choices[0]?.message?.content?.substring(0, 80)}...`);
      
      // 测试2: 尝试使用基础base64图片测试格式（即使模型不支持）
      // 创建一个简单的base64图片
      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      try {
        console.log('尝试调用Vision API格式...');
        const visionResponse = await client.chat.completions.create({
          model: model,
          messages: [{ 
            role: 'user', 
            content: [
              { type: 'text', text: '描述这张图片的内容：' },
              { type: 'image_url', image_url: { url: base64Image } }
            ]
          }],
          max_tokens: 50
        });
        console.log(`Vision API格式调用成功: ${visionResponse.choices[0]?.message?.content?.substring(0, 50)}...`);
      } catch (visionError) {
        console.log(`Vision格式调用失败: ${visionError.message?.substring(0, 100)}`);
      }
      
    } catch (error) {
      console.log(`模型测试失败: ${error.message?.substring(0, 100)}`);
    }
    
    console.log(''); // 空行分隔
  }
  
  console.log('\n=== 尝试标准Vision模型名称 ===');
  // 尝试标准的Vision模型名称
  const visionModelNames = [
    'gpt-4-vision-preview',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
    'gpt-4-turbo-vision'
  ];
  
  for (const model of visionModelNames) {
    try {
      console.log(`尝试调用模型: ${model}`);
      const simpleTest = await client.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: '简单测试' }],
        max_tokens: 10
      });
      console.log(`  ✓ 可用: ${model}`);
    } catch (error) {
      console.log(`  ✗ 不可用或不支持: ${model} (${error.message?.substring(0, 50)})`);
    }
  }
}

testVisionCapabilities();