// 简单的启动测试
console.log('开始启动测试...');

try {
  console.log('1. 加载配置...');
  const config = require('./src/config');
  console.log('✓ 配置加载成功');

  console.log('2. 加载数据库服务...');
  const databaseService = require('./src/database');
  console.log('✓ 数据库服务加载成功');

  console.log('3. 测试Product模型...');
  const Product = require('./src/database/models/Product');
  console.log('✓ Product模型加载成功');

  console.log('4. 初始化数据库...');
  databaseService.init().then(() => {
    console.log('✓ 数据库初始化成功');

    console.log('5. 测试获取商品列表...');
    return Product.findAll();
  }).then((products) => {
    console.log('✓ 商品列表获取成功，共', products.length, '个商品');

    console.log('6. 测试创建商品...');
    return Product.create({
      name: '测试商品-' + Date.now(),
      price: 10.00,
      type: 'card'
    });
  }).then((product) => {
    console.log('✓ 商品创建成功:', product.name, '类型:', product.type);
    console.log('\n✅ 所有测试通过！');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

} catch (error) {
  console.error('❌ 启动测试失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
