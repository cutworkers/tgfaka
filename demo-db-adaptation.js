#!/usr/bin/env node

/**
 * 数据库类型自适应演示脚本
 * 展示种子数据系统如何根据.env配置自动适配不同数据库
 */

require('dotenv').config();

const DatabaseSeeder = require('./src/database/seed');

console.log('🎯 数据库类型自适应演示');
console.log('='.repeat(50));

// 创建种子数据实例
const seeder = new DatabaseSeeder();

// 显示配置信息
console.log('📋 配置信息:');
console.log(`  .env文件中的 DATABASE_TYPE: ${process.env.DATABASE_TYPE || '未设置'}`);

// 显示检测结果
console.log(`  检测到的数据库类型: ${seeder.dbType.toUpperCase()}`);

// 显示详细配置
seeder.displayDatabaseConfig();

// 演示SQL语法适配
console.log('🔧 SQL语法自适应演示:');
const insertIgnoreSql = seeder.dbType === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
console.log(`  使用的INSERT语句: ${insertIgnoreSql}`);

const countField = seeder.dbType === 'mysql' ? 'result.count' : 'result["COUNT(*)"]';
console.log(`  COUNT查询结果字段: ${countField}`);

const insertIdField = seeder.dbType === 'mysql' ? 'result.insertId' : 'result.lastID';
console.log(`  插入ID获取方式: ${insertIdField}`);

console.log('\n💡 使用建议:');
if (seeder.dbType === 'mysql') {
  console.log('  ✅ 当前配置为MySQL模式');
  console.log('  - 确保MySQL服务正在运行');
  console.log('  - 验证连接参数正确');
  console.log('  - 运行: npm run db:test:mysql');
} else {
  console.log('  ✅ 当前配置为SQLite模式');
  console.log('  - 数据库文件将自动创建');
  console.log('  - 无需额外服务');
  console.log('  - 运行: npm run db:seed');
}

console.log('\n🚀 快速切换数据库类型:');
console.log('  切换到MySQL: 在.env中设置 DATABASE_TYPE=mysql');
console.log('  切换到SQLite: 在.env中设置 DATABASE_TYPE=sqlite');
console.log('  或者删除 DATABASE_TYPE 使用默认SQLite');

console.log('\n📚 相关命令:');
console.log('  npm run db:test:type  - 测试类型检测功能');
console.log('  npm run db:seed       - 创建种子数据');
console.log('  npm run db:seed:clean - 清理并重新创建');
console.log('  npm run db:test:mysql - MySQL兼容性测试');

console.log('\n' + '='.repeat(50));
console.log('✨ 自适应功能让您无需修改代码即可切换数据库！');