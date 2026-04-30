const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// API配置
const BASE_URL = 'http://localhost:3001';
const TEST_IMAGE_PATH = path.join(__dirname, '..', 'picnew', 'test.png'); // 假设有一个测试图片

// 如果没有测试图片，创建一个简单的PNG
function createTestImage() {
    const testImagePath = TEST_IMAGE_PATH;
    if (!fs.existsSync(testImagePath)) {
        console.log('使用替代方法：从网络下载一个测试图片...');
        return null;
    }
    return testImagePath;
}

async function testImageUploadAndAnalysis() {
    try {
        console.log('=== 测试图片上传和分析功能 ===');
        
        // 1. 首先，我们需要一个测试用户登录或注册
        // 这里假设我们已经有一个用户ID为"test_user"用于测试
        const userId = "test_user";
        
        // 2. 创建一个对话
        console.log('1. 创建对话...');
        const dialogRes = await axios.post(`${BASE_URL}/api/v1/dialogs`, {
            title: '图片分析测试对话',
            userId: userId
        });
        
        const dialogId = dialogRes.data.data.id;
        console.log(`对话创建成功: ${dialogId}`);
        
        // 3. 上传图片文件
        console.log('2. 上传图片...');
        const imagePath = createTestImage() || path.join(__dirname, '..', 'picnew', 'purple.png');
        
        if (!fs.existsSync(imagePath)) {
            console.error('找不到测试图片，请确保有可用图片文件');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(imagePath));
        formData.append('userId', userId);
        formData.append('fileType', 'image');
        
        const uploadRes = await axios.post(`${BASE_URL}/api/v1/files/upload`, formData, {
            headers: {
                ...formData.getHeaders(),
                'Content-Type': 'multipart/form-data'
            }
        });
        
        const fileId = uploadRes.data.data.fileId;
        console.log(`图片上传成功: ${fileId}`);
        
        // 4. 发送包含图片的消息
        console.log('3. 发送消息分析图片...');
        const messageRes = await axios.post(`${BASE_URL}/api/v1/dialogs/${dialogId}/messages`, {
            content: '请分析这张图片的内容',
            files: [fileId],
            userId: userId
        });
        
        console.log('4. AI响应结果:');
        const aiResponse = messageRes.data.data.ai_message.content;
        console.log(`AI回复长度: ${aiResponse.length} 字符`);
        console.log(`AI回复前200字: ${aiResponse.substring(0, 200)}...`);
        
        if (aiResponse.includes('无法') || aiResponse.includes('失败') || aiResponse.includes('抱歉')) {
            console.log('⚠️  AI可能无法分析图片，请检查日志');
        } else {
            console.log('✅  AI成功响应图片分析');
        }
        
        // 5. 测试生成HTML页面功能
        console.log('\n5. 测试根据图片生成HTML页面...');
        const htmlPromptRes = await axios.post(`${BASE_URL}/api/v1/dialogs/${dialogId}/messages`, {
            content: '根据这张图片的风格和内容，生成一个相关的HTML页面',
            files: [fileId],
            userId: userId
        });
        
        const htmlResponse = htmlPromptRes.data.data.ai_message.content;
        console.log(`HTML回复长度: ${htmlResponse.length} 字符`);
        
        // 检查是否包含HTML代码
        if (htmlResponse.includes('<!DOCTYPE') || htmlResponse.includes('<html') || htmlResponse.includes('```html')) {
            console.log('✅  AI成功生成HTML页面');
        } else {
            console.log('⚠️  AI可能没有生成HTML代码');
        }
        
        console.log('\n=== 测试完成 ===');
        
    } catch (error) {
        console.error('测试失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
    }
}

// 运行测试
testImageUploadAndAnalysis();