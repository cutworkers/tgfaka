#!/usr/bin/env node

/**
 * 测试修复脚本
 * 验证订单创建和USDT支付监控的修复是否有效
 */

const config = require('./src/config');
const logger = require('./src/utils/logger');
const databaseService = require('./src/database');
const Order = require('./src/database/models/Order');
const USDTService = require('./src/services/payment/usdtService');

async function testOrderCreation() {
  console.log('\n=== 测试订单创建修复 ===');
  
  try {
    // 测试订单数据
    const testOrderData = {
      user_id: 1,
      product_id: 1,
      quantity: 1,
      unit_price: 10.00,
      total_amount: 10.00,
      payment_method: 'usdt',
      payment_address: 'test_address',
      payment_amount: 1.5,
      timeout_minutes: 30
    };

    console.log('创建测试订单...');
    const order = await Order.create(testOrderData);
    
    if (order && order.id) {
      console.log('✅ 订单创建成功:', {
        id: order.id,
        order_no: order.order_no,
        status: order.status
      });
      
      // 测试过期订单更新
      console.log('测试过期订单更新...');
      const expiredCount = await Order.updateExpiredOrders();
      console.log('✅ 过期订单更新成功，处理数量:', expiredCount);
      
    } else {
      console.log('❌ 订单创建失败: 返回的订单对象无效');
    }
    
  } catch (error) {
    console.log('❌ 订单创建测试失败:', error.message);
  }
}

async function testUSDTService() {
  console.log('\n=== 测试USDT服务修复 ===');
  
  try {
    const usdtService = new USDTService();
    
    console.log('USDT配置状态:', {
      isConfigured: usdtService.isConfigured,
      hasApiKey: !!usdtService.apiKey && usdtService.apiKey !== 'your_tron_api_key',
      hasWalletAddress: !!usdtService.walletAddress && usdtService.walletAddress !== 'your_usdt_wallet_address'
    });
    
    // 测试获取交易记录（应该优雅处理配置缺失）
    console.log('测试获取交易记录...');
    const transactions = await usdtService.getTransactions(1);
    console.log('✅ 获取交易记录成功，返回数量:', transactions.length);
    
    // 测试支付监控（应该优雅处理配置缺失）
    console.log('测试支付监控...');
    await usdtService.monitorPayments();
    console.log('✅ 支付监控执行成功');
    
  } catch (error) {
    console.log('❌ USDT服务测试失败:', error.message);
  }
}

async function testDatabaseCompatibility() {
  console.log('\n=== 测试数据库兼容性修复 ===');
  
  try {
    // 测试数据库连接
    const isConnected = await databaseService.isConnected();
    console.log('数据库连接状态:', isConnected ? '✅ 已连接' : '❌ 未连接');
    
    // 测试数据库类型
    const dbType = databaseService.getDatabaseType();
    console.log('数据库类型:', dbType);
    
    // 测试SQL兼容性（过期订单清理）
    console.log('测试SQL兼容性...');
    const expiredCount = await Order.updateExpiredOrders();
    console.log('✅ SQL兼容性测试成功，处理过期订单数量:', expiredCount);
    
  } catch (error) {
    console.log('❌ 数据库兼容性测试失败:', error.message);
  }
}

async function main() {
  console.log('开始测试修复效果...');
  
  try {
    // 初始化数据库
    await databaseService.init();
    console.log('✅ 数据库初始化成功');
    
    // 运行测试
    await testDatabaseCompatibility();
    await testOrderCreation();
    await testUSDTService();
    
    console.log('\n=== 测试完成 ===');
    console.log('如果看到上述✅标记，说明相应的修复已生效');
    console.log('如果看到❌标记，请检查对应的错误信息');
    
  } catch (error) {
    console.log('❌ 测试初始化失败:', error.message);
  } finally {
    // 关闭数据库连接
    await databaseService.close();
    process.exit(0);
  }
}

// 运行测试
main().catch(console.error);
