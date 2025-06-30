// 路由测试脚本
const axios = require('axios');

async function testRoutes() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  
  console.log('开始测试路由...');
  console.log('基础URL:', baseURL);
  console.log('');

  const routes = [
    { path: '/health', method: 'GET', description: '健康检查' },
    { path: '/api/health', method: 'GET', description: 'API健康检查' },
    { path: '/webhook', method: 'POST', description: 'Telegram Webhook', data: { test: true } },
    { path: '/api/docs', method: 'GET', description: 'API文档' },
    { path: '/debug/routes', method: 'GET', description: '路由诊断（需要DEBUG_ROUTES=true）' },
    { path: '/debug/session', method: 'GET', description: 'Session诊断（需要DEBUG_SESSION=true）' }
  ];

  for (const route of routes) {
    try {
      console.log(`测试 ${route.method} ${route.path} - ${route.description}`);
      
      let response;
      if (route.method === 'GET') {
        response = await axios.get(`${baseURL}${route.path}`, {
          timeout: 5000,
          validateStatus: () => true // 接受所有状态码
        });
      } else if (route.method === 'POST') {
        response = await axios.post(`${baseURL}${route.path}`, route.data || {}, {
          timeout: 5000,
          validateStatus: () => true
        });
      }

      console.log(`  状态码: ${response.status}`);
      
      if (response.status === 200) {
        console.log('  ✅ 成功');
        if (route.path === '/health' || route.path === '/api/health') {
          console.log(`  响应: ${JSON.stringify(response.data, null, 2)}`);
        }
      } else if (response.status === 404) {
        console.log('  ❌ 404 - 路由不存在');
      } else {
        console.log(`  ⚠️  状态码 ${response.status}`);
        if (response.data) {
          console.log(`  响应: ${JSON.stringify(response.data, null, 2)}`);
        }
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('  ❌ 连接被拒绝 - 服务器未启动');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('  ❌ 请求超时');
      } else {
        console.log(`  ❌ 错误: ${error.message}`);
      }
    }
    
    console.log('');
  }

  // 测试Bot配置
  console.log('检查Bot配置...');
  try {
    const response = await axios.get(`${baseURL}/webhook`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (response.status === 404 && response.data?.error === 'Bot未配置') {
      console.log('  ⚠️  Bot未配置 - 这是正常的，如果您还没有配置Telegram Bot');
    } else if (response.status === 200) {
      console.log('  ✅ Bot已配置并正常工作');
    } else {
      console.log(`  状态码: ${response.status}`);
      console.log(`  响应: ${JSON.stringify(response.data, null, 2)}`);
    }
  } catch (error) {
    console.log(`  ❌ 错误: ${error.message}`);
  }

  console.log('');
  console.log('测试完成！');
  console.log('');
  console.log('如果路由返回404，请检查：');
  console.log('1. 服务器是否正常启动');
  console.log('2. 端口是否正确');
  console.log('3. 是否有代理或负载均衡器');
  console.log('4. 环境变量是否正确设置');
}

// 如果直接运行此文件
if (require.main === module) {
  testRoutes().catch(console.error);
}

module.exports = testRoutes;
