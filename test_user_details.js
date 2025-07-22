const axios = require('axios');

// 测试用户详情路由
async function testUserDetails() {
  const baseURL = 'http://localhost:3000/api';
  
  try {
    console.log('=== 测试用户详情路由 ===\n');

    // 1. 测试获取用户详情（包含订单信息）
    console.log('1. 测试获取用户详情（包含订单信息）');
    try {
      const response = await axios.get(`${baseURL}/users/1?include_orders=true&orders_limit=5`);
      console.log('✅ 成功获取用户详情');
      console.log('用户信息:', {
        id: response.data.data.id,
        telegram_id: response.data.data.telegram_id,
        username: response.data.data.username,
        balance: response.data.data.balance,
        total_spent: response.data.data.total_spent,
        order_count: response.data.data.order_count
      });
      console.log('统计信息:', response.data.data.stats);
      if (response.data.data.orders) {
        console.log('订单数量:', response.data.data.orders.list.length);
        console.log('分页信息:', response.data.data.orders.pagination);
      }
    } catch (error) {
      console.log('❌ 获取用户详情失败:', error.response?.data?.message || error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 测试获取用户详情（不包含订单信息）
    console.log('2. 测试获取用户详情（不包含订单信息）');
    try {
      const response = await axios.get(`${baseURL}/users/1?include_orders=false`);
      console.log('✅ 成功获取用户基本信息');
      console.log('用户信息:', {
        id: response.data.data.id,
        telegram_id: response.data.data.telegram_id,
        username: response.data.data.username,
        balance: response.data.data.balance
      });
      console.log('是否包含订单:', !!response.data.data.orders);
    } catch (error) {
      console.log('❌ 获取用户基本信息失败:', error.response?.data?.message || error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 3. 测试获取不存在的用户
    console.log('3. 测试获取不存在的用户');
    try {
      const response = await axios.get(`${baseURL}/users/99999`);
      console.log('❌ 应该返回404错误');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ 正确返回404错误:', error.response.data.message);
      } else {
        console.log('❌ 意外错误:', error.response?.data?.message || error.message);
      }
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 4. 测试获取用户统计信息
    console.log('4. 测试获取用户统计信息');
    try {
      const response = await axios.get(`${baseURL}/users/1/stats`);
      console.log('✅ 成功获取用户统计信息');
      console.log('统计信息:', response.data.data);
    } catch (error) {
      console.log('❌ 获取用户统计信息失败:', error.response?.data?.message || error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 5. 测试获取用户列表
    console.log('5. 测试获取用户列表');
    try {
      const response = await axios.get(`${baseURL}/users?page=1&limit=5`);
      console.log('✅ 成功获取用户列表');
      console.log('用户数量:', response.data.data.users.length);
      console.log('分页信息:', response.data.data.pagination);
      if (response.data.data.users.length > 0) {
        console.log('第一个用户:', {
          id: response.data.data.users[0].id,
          username: response.data.data.users[0].username,
          telegram_id: response.data.data.users[0].telegram_id
        });
      }
    } catch (error) {
      console.log('❌ 获取用户列表失败:', error.response?.data?.message || error.message);
    }

  } catch (error) {
    console.error('测试过程中发生错误:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  testUserDetails().catch(console.error);
}

module.exports = { testUserDetails };