// 测试POST类型商品功能
console.log('开始测试POST类型商品功能...');

const databaseService = require('./src/database');
const Product = require('./src/database/models/Product');

async function testPostProduct() {
  try {
    console.log('1. 初始化数据库...');
    await databaseService.init();
    console.log('✓ 数据库初始化成功');

    console.log('2. 创建POST类型商品...');
    const postProduct = await Product.create({
      name: 'POST测试商品-' + Date.now(),
      description: '这是一个POST类型的测试商品',
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
          quantity: '{{quantity}}',
          order_id: '{{order_id}}'
        }
      })
    });
    console.log('✓ POST商品创建成功:', postProduct.name);
    console.log('  商品ID:', postProduct.id);
    console.log('  商品类型:', postProduct.type);
    console.log('  POST配置:', postProduct.post_data ? '已配置' : '未配置');

    console.log('3. 测试获取商品详情...');
    const productDetail = await Product.findById(postProduct.id);
    console.log('✓ 商品详情获取成功');
    console.log('  商品名称:', productDetail.name);
    console.log('  商品类型:', productDetail.type);
    
    if (productDetail.post_data) {
      try {
        const postConfig = JSON.parse(productDetail.post_data);
        console.log('  POST URL:', postConfig.url);
        console.log('  POST Headers:', Object.keys(postConfig.headers || {}).join(', '));
      } catch (error) {
        console.log('  POST配置解析失败:', error.message);
      }
    }

    console.log('4. 测试更新POST商品...');
    const updatedProduct = await productDetail.update({
      description: '更新后的POST商品描述',
      post_data: JSON.stringify({
        url: 'https://api.updated.com/cards',
        headers: {
          'Authorization': 'Bearer updated-token'
        },
        body: {
          product_id: '{{product_id}}',
          count: '{{quantity}}'
        }
      })
    });
    console.log('✓ POST商品更新成功');

    console.log('5. 测试获取所有商品（包含类型）...');
    const allProducts = await Product.findAll();
    console.log('✓ 商品列表获取成功，共', allProducts.length, '个商品');
    
    const cardProducts = allProducts.filter(p => p.type === 'card');
    const postProducts = allProducts.filter(p => p.type === 'post');
    console.log('  卡密类型商品:', cardProducts.length, '个');
    console.log('  POST类型商品:', postProducts.length, '个');

    console.log('\n✅ POST类型商品功能测试通过！');
    process.exit(0);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testPostProduct();
