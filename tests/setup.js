const path = require('path');
const fs = require('fs');

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = './database/test.db';
process.env.LOG_LEVEL = 'error';

// 测试前清理
beforeAll(async () => {
  // 删除测试数据库
  const testDbPath = path.join(__dirname, '../database/test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

// 测试后清理
afterAll(async () => {
  // 删除测试数据库
  const testDbPath = path.join(__dirname, '../database/test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});
