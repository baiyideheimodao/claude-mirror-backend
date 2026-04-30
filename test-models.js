const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: 'sk-c23sUfYzW3ez613OPyxsIjPmflID1oI2fDKhUUWYfNlwDknf',
  baseURL: 'https://api.lingshi.chat/v1'
});

async function testAvailableModels() {
  console.log('测试可用的模型...');
  
  try {
    // 尝试获取模型列表
    console.log('尝试获取可用模型列表...');
    const models = await client.models.list();
    
    console.log(`可用模型数量: ${models.data?.length || 0}`);
    console.log('所有可用模型:');
    models.data?.forEach(model => {
      console.log(`  - ${model.id} (拥有者: ${model.owned_by || '未知'})`);
    });
    
    // 检查是否有支持Vision的模型
    console.log('\n搜索可能支持Vision的模型名称...');
    const visionCandidates = models.data?.filter(model => 
      model.id.toLowerCase().includes('vision') ||
      model.id.toLowerCase().includes('vision') ||
      model.id.toLowerCase().includes('gpt-4') ||
      model.id.toLowerCase().includes('claude-3')
    );
    
    if (visionCandidates && visionCandidates.length > 0) {
      console.log('可能支持Vision的模型:');
      visionCandidates.forEach(model => {
        console.log(`  - ${model.id} (ID中可能包含Vision相关名称)`);
      });
      
      // 测试第一个候选模型
      console.log(`\n测试模型: ${visionCandidates[0].id}`);
      try {
        const testResponse = await client.chat.completions.create({
          model: visionCandidates[0].id,
          messages: [{ 
            role: 'user', 
            content: '请问你支持分析图片吗？' 
          }],
          max_tokens: 50
        });
        console.log(`模型回复: ${testResponse.choices[0]?.message?.content?.substring(0, 100)}...`);
      } catch (modelError) {
        console.log(`该模型可能不可用或出错: ${modelError.message}`);
      }
    } else {
      console.log('未找到明显支持Vision的模型名称。');
      console.log('可以尝试使用流行的多模态模型名称：');
      console.log('  - gpt-4-vision-preview');
      console.log('  - claude-3-opus');
      console.log('  - claude-3-sonnet');
      console.log('  - claude-3-haiku');
    }
    
  } catch (error) {
    console.error('获取模型列表失败:', error.message);
    console.log('可能该API端点不支持models.list()接口。');
    console.log('\n常见的Vision模型名称（可能需要直接尝试调用）：');
    console.log('  - gpt-4-vision-preview');
    console.log('  - claude-3-opus');
    console.log('  - claude-3-sonnet');
    console.log('  - claude-3-haiku');
    console.log('  - gpt-4-turbo-vision');
    console.log('  - gemini-pro-vision');
  }
}

testAvailableModels();