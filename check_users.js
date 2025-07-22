const databaseService = require('./src/database/index');

async function checkUsers() {
  try {
    console.log('=== 检查数据库中的用户数据 ===\n');
    
    // 初始化数据库
    console.log('初始化数据库...');
    await databaseService.init();
    console.log('✅ 数据库初始化成功\n');

    // 检查用户表
    const users = await databaseService.query('SELECT * FROM users LIMIT 5');
    console.log('用户数量:', users.length);
    
    if (users.length > 0) {
      console.log('\n前5个用户:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}, Telegram ID: ${user.telegram_id}, Username: ${user.username || 'N/A'}`);
      });
    } else {
      console.log('数据库中没有用户数据');
      
      // 创建测试用户
      console.log('\n创建测试用户...');
      const testUser = await databaseService.run(
        `INSERT INTO users (telegram_id, username, first_name, last_name, balance, total_spent, order_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [123456789, 'testuser', 'Test', 'User', 100.00, 50.00, 2]
      );
      console.log('✅ 测试用户创建成功，ID:', testUser.id);
    }

    // 检查订单表
    const orders = await databaseService.query('SELECT * FROM orders LIMIT 3');
    console.log('\n订单数量:', orders.length);
    
    if (orders.length > 0) {
      console.log('\n前3个订单:');
      orders.forEach((order, index) => {
        console.log(`${index + 1}. ID: ${order.id}, User ID: ${order.user_id}, Status: ${order.status}, Amount: ${order.total_amount}`);
      });
    }

  } catch (error) {
    console.error('检查数据库失败:', error.message);
  } finally {
    process.exit(0);
  }
}

checkUsers();