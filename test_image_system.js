/**
 * 测试图片分析系统
 */
const AiService = require('./src/services/ai.service')
const fs = require('fs').promises
const path = require('path')

async function testImageSystem() {
  console.log('=== 测试图片分析系统 ===\n')
  
  // 测试1: 检查当前配置的模型是否支持Vision
  console.log('1. 测试AI服务配置:')
  console.log(`  模型: ${process.env.AI_MODEL || '未设置'}`)
  console.log(`  API地址: ${process.env.AI_BASE_URL || '默认'}`)
  
  try {
    // 测试2: 测试图片转base64
    console.log('\n2. 测试图片转base64功能:')
    
    // 创建一个小的测试图片（1x1像素的黑色PNG）
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const buffer = Buffer.from(testImageBase64, 'base64')
    const testImagePath = './test_image.png'
    await fs.writeFile(testImagePath, buffer)
    
    console.log(`   创建测试图片: ${testImagePath}`)
    
    // 测试imageToBase64方法
    const aiService = require('./src/services/ai.service')
    const base64Result = await aiService.imageToBase64(testImagePath)
    
    if (base64Result && base64Result.startsWith('data:image/png;base64,')) {
      console.log('   ✓ 图片转base64成功')
      console.log(`   base64长度: ${base64Result.length} 字符`)
    } else {
      console.log('   ✗ 图片转base64失败:', base64Result)
    }
    
    // 清理测试文件
    await fs.unlink(testImagePath)
    console.log('   清理测试图片')
    
    // 测试3: 测试AI Vision调用
    console.log('\n3. 测试AI Vision API调用:')
    
    const testMessage = [{
      role: 'user',
      content: [
        { type: 'text', text: '描述这张图片:' },
        { 
          type: 'image_url', 
          image_url: { 
            url: base64Result 
          }
        }
      ]
    }]
    
    console.log('   调用AI服务...')
    try {
      const response = await aiService.chat(testMessage, {
        temperature: 0.7,
        max_tokens: 100
      })
      
      console.log('   ✓ AI响应成功')
      console.log(`   响应: ${response.substring(0, 100)}...`)
      
      if (response.includes('黑色') || response.includes('像素') || response.includes('图片') || response.includes('图像')) {
        console.log('   ✓ AI正确识别了图片内容')
      } else {
        console.log('   ⚠ AI可能没有正确分析图片')
      }
      
    } catch (aiError) {
      console.log(`   ✗ AI调用失败: ${aiError.message}`)
      if (aiError.message.includes('vision') || aiError.message.includes('图片') || aiError.message.includes('不支持')) {
        console.log('   ⚠ 可能模型不支持Vision功能或需要调整API调用格式')
      }
    }
    
    // 测试4: 测试常规文本聊天
    console.log('\n4. 测试常规文本聊天:')
    
    const textMessage = [{
      role: 'user',
      content: '这是一个常规文本测试，请回答"文本测试成功"'
    }]
    
    try {
      const textResponse = await aiService.chat(textMessage, {
        temperature: 0.7,
        max_tokens: 50
      })
      
      console.log(`   ✓ 文本聊天成功: ${textResponse.substring(0, 80)}...`)
      
    } catch (textError) {
      console.log(`   ✗ 文本聊天失败: ${textError.message}`)
    }
    
  } catch (error) {
    console.error('测试失败:', error)
  }
  
  console.log('\n=== 测试完成 ===')
}

// 设置环境变量（从.env文件加载）
async function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '.env')
    const envContent = await fs.readFile(envPath, 'utf-8')
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          process.env[key] = value
        }
      }
    })
  } catch (error) {
    console.log('无法加载.env文件，使用默认环境变量')
  }
}

loadEnv().then(() => testImageSystem())