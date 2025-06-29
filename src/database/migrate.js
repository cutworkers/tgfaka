const databaseService = require('./index');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('开始执行数据库迁移...');

    // 初始化数据库连接
    await databaseService.init();
    console.log('数据库连接成功');

    // 检查是否已经有type字段
    try {
      await databaseService.query('SELECT type FROM products LIMIT 1');
      console.log('type字段已存在，跳过迁移');
      return;
    } catch (error) {
      console.log('type字段不存在，开始添加...');
    }
    
    // 添加type字段
    await databaseService.run('ALTER TABLE products ADD COLUMN type TEXT DEFAULT \'card\'');
    console.log('✓ 添加type字段成功');
    
    // 添加post_data字段
    await databaseService.run('ALTER TABLE products ADD COLUMN post_data TEXT');
    console.log('✓ 添加post_data字段成功');
    
    // 更新现有商品的type字段
    await databaseService.run('UPDATE products SET type = \'card\' WHERE type IS NULL');
    console.log('✓ 更新现有商品type字段成功');
    
    console.log('数据库迁移完成！');
    
    // 验证迁移结果
    const result = await databaseService.query('PRAGMA table_info(products)');
    console.log('\n当前products表结构:');
    result.forEach(column => {
      console.log(`- ${column.name}: ${column.type} (默认值: ${column.dflt_value})`);
    });
    
  } catch (error) {
    console.error('数据库迁移失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runMigration().then(() => {
    process.exit(0);
  });
}

module.exports = runMigration;
