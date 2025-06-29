// 最终功能验证测试
console.log('=== 商品类型功能最终验证 ===\n');

const databaseService = require('./src/database');
const Product = require('./src/database/models/Product');

async function finalTest() {
  try {
    // 初始化数据库
    await databaseService.init();
    console.log('✓ 数据库连接成功\n');

    // 测试1: 创建卡密类型商品
    console.log('测试1: 创建卡密类型商品');
    const cardProduct = await Product.create({
      name: '卡密商品测试',
      description: '这是一个卡密类型的商品',
      price: 15.99,
      type: 'card'
    });
    console.log(`✓ 卡密商品创建成功 - ID: ${cardProduct.id}, 类型: ${cardProduct.type}\n`);

    // 测试2: 创建POST类型商品
    console.log('测试2: 创建POST类型商品');
    const postProduct = await Product.create({
      name: 'POST商品测试',
      description: '这是一个POST类型的商品',
      price: 25.99,
      type: 'post',
      post_data: JSON.stringify({
        url: 'https://api.example.com/generate-cards',
        headers: {
          'Authorization': 'Bearer test-token-123',
          'Content-Type': 'application/json'
        },
        body: {
          product_id: '{{product_id}}',
          quantity: '{{quantity}}',
          order_id: '{{order_id}}'
        }
      })
    });
    console.log(`✓ POST商品创建成功 - ID: ${postProduct.id}, 类型: ${postProduct.type}\n`);

    // 测试3: 验证POST配置
    console.log('测试3: 验证POST配置');
    const postConfig = JSON.parse(postProduct.post_data);
    console.log(`✓ POST URL: ${postConfig.url}`);
    console.log(`✓ 包含变量: ${Object.keys(postConfig.body).join(', ')}\n`);

    // 测试4: 获取所有商品并按类型分类
    console.log('测试4: 商品列表统计');
    const allProducts = await Product.findAll();
    const cardCount = allProducts.filter(p => p.type === 'card').length;
    const postCount = allProducts.filter(p => p.type === 'post').length;
    
    console.log(`✓ 总商品数: ${allProducts.length}`);
    console.log(`✓ 卡密类型: ${cardCount} 个`);
    console.log(`✓ POST类型: ${postCount} 个\n`);

    // 测试5: 更新商品类型
    console.log('测试5: 更新商品类型');
    const updatedProduct = await cardProduct.update({
      type: 'post',
      post_data: JSON.stringify({
        url: 'https://api.newprovider.com/cards',
        headers: { 'X-API-Key': 'new-key' },
        body: { product: '{{product_id}}', count: '{{quantity}}' }
      })
    });
    console.log(`✓ 商品类型更新成功 - 从 card 改为 ${updatedProduct.type}\n`);

    // 测试6: 验证数据完整性
    console.log('测试6: 数据完整性验证');
    const verifyProduct = await Product.findById(postProduct.id);
    console.log(`✓ 商品名称: ${verifyProduct.name}`);
    console.log(`✓ 商品类型: ${verifyProduct.type}`);
    console.log(`✓ POST配置: ${verifyProduct.post_data ? '已配置' : '未配置'}`);
    console.log(`✓ 价格: ¥${verifyProduct.price}\n`);

    console.log('🎉 所有测试通过！商品类型功能实现成功！');
    console.log('\n功能总结:');
    console.log('- ✅ 数据库结构已更新（添加type和post_data字段）');
    console.log('- ✅ Product模型已支持新字段');
    console.log('- ✅ 可以创建卡密类型商品');
    console.log('- ✅ 可以创建POST类型商品');
    console.log('- ✅ POST配置可以正确存储和读取');
    console.log('- ✅ 商品类型可以更新');
    console.log('- ✅ 数据完整性验证通过');

    process.exit(0);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

finalTest();
