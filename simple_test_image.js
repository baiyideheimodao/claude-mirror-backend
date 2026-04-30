// 直接测试AI服务的图片分析功能
const aiService = require('./src/services/ai.service');
const path = require('path');

async function testVisionAPI() {
    try {
        console.log('=== 测试Claude Vision API功能 ===');
        
        // 使用现有的测试图片
        const testImagePath = path.join(__dirname, '..', 'picnew', '图标.png');
        console.log(`使用测试图片: ${testImagePath}`);
        
        // 测试图片转base64
        console.log('1. 将图片转为base64...');
        const base64Image = await aiService.imageToBase64(testImagePath);
        console.log(`Base64图片数据长度: ${base64Image.length} 字符`);
        console.log(`Base64前缀: ${base64Image.substring(0, 50)}...`);
        
        // 构建multimodal消息
        const messages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: '请分析这张图片的内容'
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: base64Image
                        }
                    }
                ]
            }
        ];
        
        // 调用AI分析图片
        console.log('\n2. 调用AI分析图片...');
        const response = await aiService.chat(messages, {
            system: '你是一个专业的图片分析助手，请详细描述图片内容',
            max_tokens: 500
        });
        
        console.log('3. AI回复:');
        console.log(response);
        
        // 测试生成HTML页面
        console.log('\n4. 测试根据图片生成HTML页面...');
        const htmlMessages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: '根据这张图片的风格和内容，生成一个相关的HTML页面'
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: base64Image
                        }
                    }
                ]
            }
        ];
        
        const htmlResponse = await aiService.chat(htmlMessages, {
            system: '当用户请求创建HTML页面时，请提供完整的、可运行的HTML代码，包含<!DOCTYPE html>、<html>、<head>和<body>标签。将完整的HTML代码包裹在```html代码块中。',
            max_tokens: 1000
        });
        
        console.log('5. AI生成的HTML页面:');
        console.log(htmlResponse);
        
        // 检查是否包含HTML代码
        if (htmlResponse.includes('<!DOCTYPE') || htmlResponse.includes('<html') || htmlResponse.includes('```html')) {
            console.log('\n✅  AI成功生成HTML页面');
        } else {
            console.log('\n⚠️  AI可能没有生成HTML代码');
        }
        
        console.log('\n=== 测试完成 ===');
        
    } catch (error) {
        console.error('测试失败:', error.message);
        console.error('错误详情:', error);
    }
}

// 运行测试
testVisionAPI();