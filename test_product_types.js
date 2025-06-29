const axios = require('axios');

// 测试商品类型功能
async function testProductTypes() {
  const baseURL = 'http://localhost:3000';
  
  console.log('开始测试商品类型功能...\n');
  
  try {
    // 1. 测试创建卡密类型商品
    console.log('1. 测试创建卡密类型商品');
    const cardProduct = {
      name: '测试卡密商品',
      description: '这是一个测试的卡密类型商品',
      price: 10.00,
      type: 'card'
    };
    
    const cardResponse = await axios.post(`${baseURL}/api/products`, cardProduct);
    console.log('✓ 卡密商品创建成功:', cardResponse.data.data.name, '类型:', cardResponse.data.data.type);
    
    // 2. 测试创建POST类型商品
    console.log('\n2. 测试创建POST类型商品');
    const postProduct = {
      name: '测试POST商品',
      description: '这是一个测试的POST类型商品',
      price: 20.00,
      type: 'post',
      post_data: JSON.stringify({
        url: 'https://api.example.com/cards',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        body: {
          product_id: '{{product_id}}',
          quantity: '{{quantity}}'
        }
      })
    };
    
    const postResponse = await axios.post(`${baseURL}/api/products`, postProduct);
    console.log('✓ POST商品创建成功:', postResponse.data.data.name, '类型:', postResponse.data.data.type);
    
    // 3. 测试获取商品列表
    console.log('\n3. 测试获取商品列表');
    const listResponse = await axios.get(`${baseURL}/api/products`);
    console.log('✓ 商品列表获取成功，共', listResponse.data.data.products.length, '个商品');
    
    listResponse.data.data.products.forEach(product => {
      console.log(`  - ${product.name} (类型: ${product.type})`);
    });
    
    // 4. 测试更新商品类型
    console.log('\n4. 测试更新商品类型');
    const updateData = {
      type: 'post',
      post_data: JSON.stringify({
        url: 'https://api.updated.com/cards',
        headers: { 'Authorization': 'Bearer updated-token' },
        body: { product_id: '{{product_id}}', count: '{{quantity}}' }
      })
    };
    
    const updateResponse = await axios.put(`${baseURL}/api/products/${cardResponse.data.data.id}`, updateData);
    console.log('✓ 商品类型更新成功:', updateResponse.data.data.name, '新类型:', updateResponse.data.data.type);
    
    // 5. 测试获取单个商品详情
    console.log('\n5. 测试获取商品详情');
    const detailResponse = await axios.get(`${baseURL}/api/products/${postResponse.data.data.id}`);
    console.log('✓ 商品详情获取成功');
    console.log('  商品名称:', detailResponse.data.data.name);
    console.log('  商品类型:', detailResponse.data.data.type);
    console.log('  POST配置:', detailResponse.data.data.post_data ? '已配置' : '未配置');
    
    console.log('\n✅ 所有测试通过！');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('错误详情:', error.response.data);
    }
  }
}

// 等待服务器启动后执行测试
setTimeout(() => {
  testProductTypes();
}, 3000);
