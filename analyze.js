const axios = require('axios');

exports.handler = async (event, context) => {
    // 阿里云函数计算的请求处理方式
    let requestData;
    
    try {
        // 解析请求数据
        if (event.body) {
            requestData = JSON.parse(event.body);
        } else if (event.data) {
            requestData = event.data;
        } else {
            requestData = event;
        }
    } catch (e) {
        requestData = event;
    }
    
    const { text, lang = 'zh' } = requestData || {};
    
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    if (!text || text.length < 5) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                success: false,
                error: '合同文本不能为空'
            })
        };
    }
    
    try {
        // API密钥 - 使用环境变量
        const API_KEY = process.env.TONGYI_API_KEY || "sk-81dd44c8f7104ba6aa1146a5104d3139";
        
        if (!API_KEY) {
            throw new Error('API密钥未配置');
        }
        
        console.log(`开始AI分析，语言: ${lang}, 文本长度: ${text.length}`);
        
        // 构建提示词（与之前相同）
        let prompt;
        if (lang === 'zh') {
            prompt = `作为专业外贸律师，请分析以下合同的风险点和改进建议：\n\n${text}`;
        } else if (lang === 'en') {
            prompt = `As a professional trade lawyer, please analyze risks and suggestions for this contract:\n\n${text}`;
        } else {
            prompt = `Como abogado profesional de comercio exterior, analice los riesgos y sugerencias de este contrato:\n\n${text}`;
        }
        
        // 限制文本长度
        const limitedPrompt = prompt.length > 3000 ? prompt.substring(0, 3000) + '...' : prompt;
        
        const response = await axios.post(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
            {
                model: "qwen-turbo",
                input: {
                    messages: [{
                        role: "user",
                        content: limitedPrompt
                    }]
                },
                parameters: {
                    result_format: "message",
                    max_tokens: 1500,
                    temperature: 0.1
                }
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                },
                timeout: 30000
            }
        );
        
        // 提取内容
        let aiContent = '';
        const result = response.data;
        
        if (result.output) {
            if (result.output.choices && result.output.choices[0]) {
                aiContent = result.output.choices[0].message?.content || '';
            } else if (result.output.text) {
                aiContent = result.output.text;
            }
        }
        
        if (!aiContent) {
            aiContent = "AI分析完成，但返回内容为空。";
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                result: aiContent,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('错误详情:', error.message);
        
        let errorMessage = '分析失败';
        if (error.response) {
            errorMessage = `API错误 (${error.response.status})`;
        } else if (error.request) {
            errorMessage = '网络错误，无法连接到AI服务';
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = '请求超时';
        }
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: errorMessage,
                timestamp: new Date().toISOString()
            })
        };
    }
};