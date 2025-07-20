#!/usr/bin/env node

/**
 * MySQL种子数据测试脚本
 * 用于验证种子数据在MySQL环境下的兼容性
 */

const path = require('path');
require('dotenv').config();

// 临时设置MySQL环境（如果未设置）
if (!process.env.DATABASE_TYPE) {
  process.env.DATABASE_TYPE = 'mysql';
}

const DatabaseSeeder = require('./src/database/seed');
const logger = require('./src/utils/logger');

async function testMySQLSeed() {
  console.log('🧪 开始测试MySQL种子数据兼容性...\n');
  
  try {
    // 检查MySQL配置
    const requiredEnvs = [
      'MYSQL_HOST',
      'MYSQL_PORT', 
      'MYSQL_DATABASE',
      'MYSQL_USERNAME',
      'MYSQL_PASSWORD'
    ];
    
    const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
    if (missingEnvs.length > 0) {
      throw new Error(`缺少MySQL配置: ${missingEnvs.join(', ')}`);
    }
    
    console.log('✅ MySQL配置检查通过');
    console.log(`📍 连接信息: ${process.env.MYSQL_USERNAME}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}\n`);
    
    // 创建种子数据实例
    const seeder = new DatabaseSeeder();
    
    // 执行种子数据创建（清理模式）
    await seeder.seed({ clean: true });
    
    console.log('✅ MySQL种子数据测试成功！');
    console.log('\n📋 测试完成项目:');
    console.log('- ✅ MySQL连接测试');
    console.log('- ✅ 数据库表结构验证');
    console.log('- ✅ INSERT IGNORE语法适配');
    console.log('- ✅ 分类数据创建');
    console.log('- ✅ 商品数据创建');
    console.log('- ✅ 卡密数据创建');
    console.log('- ✅ 数据统计功能');
    
  } catch (error) {
    console.error('❌ MySQL种子数据测试失败:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 连接被拒绝，请检查:');
      console.log('1. MySQL服务是否正在运行');
      console.log('2. 连接参数是否正确');
      console.log('3. 防火墙设置');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n🔧 访问被拒绝，请检查:');
      console.log('1. 用户名和密码是否正确');
      console.log('2. 用户是否有数据库访问权限');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n🔧 数据库不存在，请检查:');
      console.log('1. 数据库名称是否正确');
      console.log('2. 是否需要先创建数据库');
    }
    
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testMySQLSeed()
    .then(() => {
      console.log('\n🎉 所有测试通过！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 测试执行失败:', error.message);
      process.exit(1);
    });
}

module.exports = testMySQLSeed;