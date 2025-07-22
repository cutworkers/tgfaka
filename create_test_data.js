const databaseService = require('./src/database/index');

async function createTestData() {
  try {
    console.log('=== 创建测试数据 ===\n');
    
    // 初始化数据库
    await databaseService.init();
    console.log('✅ 数据库初始化成功\n');

    // 创建测试用户（如果不存在）
    console.log('创建测试用户...');
    let user1, user2;
    
    try {
      user1 = await databaseService.run(
        `INSERT INTO users (telegram_id, username, first_name, last_name, balance, total_spent, order_count, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [123456789, 'testuser1', 'Test', 'User1', 100.00, 50.00, 2, 'active']
      );
      console.log('✅ 用户1创建成功，ID:', user1.lastID);
    } catch (error) {
      if (error.message.includes('Duplicate entry')) {
        const existingUser = await databaseService.get('SELECT * FROM users WHERE telegram_id = ?', [123456789]);
        user1 = { lastID: existingUser.id };
        console.log('ℹ️ 用户1已存在，ID:', existingUser.id);
      } else {
        throw error;
      }
    }

    try {
      user2 = await databaseService.run(
        `INSERT INTO users (telegram_id, username, first_name, last_name, balance, total_spent, order_count, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [987654321, 'testuser2', 'Test', 'User2', 200.00, 150.00, 5, 'active']
      );
      console.log('✅ 用户2创建成功，ID:', user2.lastID);
    } catch (error) {
      if (error.message.includes('Duplicate entry')) {
        const existingUser = await databaseService.get('SELECT * FROM users WHERE telegram_id = ?', [987654321]);
        user2 = { lastID: existingUser.id };
        console.log('ℹ️ 用户2已存在，ID:', existingUser.id);
      } else {
        throw error;
      }
    }

    // 创建测试商品
    console.log('\n创建测试商品...');
    const product1 = await databaseService.run(
      `INSERT INTO products (name, description, price, category, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['测试商品1', '这是一个测试商品', 25.00, 'test', 'active']
    );
    console.log('✅ 商品1创建成功，ID:', product1.lastID);

    const product2 = await databaseService.run(
      `INSERT INTO products (name, description, price, category, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['测试商品2', '这是另一个测试商品', 50.00, 'test', 'active']
    );
    console.log('✅ 商品2创建成功，ID:', product2.lastID);

    // 创建测试订单
    console.log('\n创建测试订单...');
    const order1 = await databaseService.run(
      `INSERT INTO orders (user_id, product_id, quantity, unit_price, total_amount, status, payment_method, order_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user1.lastID, product1.lastID, 1, 25.00, 25.00, 'completed', 'usdt', 'ORDER_' + Date.now() + '_1']
    );
    console.log('✅ 订单1创建成功，ID:', order1.lastID);

    const order2 = await databaseService.run(
      `INSERT INTO orders (user_id, product_id, quantity, unit_price, total_amount, status, payment_method, order_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user1.lastID, product2.lastID, 1, 50.00, 50.00, 'pending', 'alipay', 'ORDER_' + Date.now() + '_2']
    );
    console.log('✅ 订单2创建成功，ID:', order2.lastID);

    const order3 = await databaseService.run(
      `INSERT INTO orders (user_id, product_id, quantity, unit_price, total_amount, status, payment_method, order_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user2.lastID, product1.lastID, 2, 25.00, 50.00, 'completed', 'usdt', 'ORDER_' + Date.now() + '_3']
    );
    console.log('✅ 订单3创建成功，ID:', order3.lastID);

    // 验证数据
    console.log('\n=== 验证创建的数据 ===');
    const users = await databaseService.query('SELECT * FROM users');
    console.log('用户数量:', users.length);

    const products = await databaseService.query('SELECT * FROM products');
    console.log('商品数量:', products.length);

    const orders = await databaseService.query('SELECT * FROM orders');
    console.log('订单数量:', orders.length);

    console.log('\n✅ 测试数据创建完成！');

  } catch (error) {
    console.error('创建测试数据失败:', error.message);
  } finally {
    await databaseService.close();
    process.exit(0);
  }
}

createTestData();