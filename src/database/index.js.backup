const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const DatabaseInitializer = require('./init');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = config.database.path;
  }

  async init() {
    try {
      // 确保数据库目录存在
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 检查数据库文件是否存在，如果不存在则初始化
      if (!fs.existsSync(this.dbPath)) {
        logger.info('数据库文件不存在，开始初始化...');
        const initializer = new DatabaseInitializer();
        await initializer.init();
      }

      // 连接数据库
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('数据库连接失败', { error: err.message });
          throw err;
        }
        logger.info('数据库连接成功', { path: this.dbPath });
      });

      // 启用外键约束
      this.db.run('PRAGMA foreign_keys = ON');

    } catch (error) {
      logger.error('数据库初始化失败', { error: error.message });
      throw error;
    }
  }

  // 通用查询方法
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('数据库查询失败', { sql, error: err.message });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 通用执行方法
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('数据库执行失败', { sql, error: err.message });
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // 获取单条记录
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('数据库查询失败', { sql, error: err.message });
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 事务处理
  async transaction(callback) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        callback(this.db)
          .then((result) => {
            this.db.run('COMMIT', (err) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          })
          .catch((error) => {
            this.db.run('ROLLBACK', () => {
              reject(error);
            });
          });
      });
    });
  }

  getDatabase() {
    return this.db;
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            logger.error('数据库关闭失败', { error: err.message });
          } else {
            logger.info('数据库连接已关闭');
          }
          resolve();
        });
      });
    }
  }
}

module.exports = new DatabaseService();
