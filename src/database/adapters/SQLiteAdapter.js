const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const BaseAdapter = require('./BaseAdapter');
const logger = require('../../utils/logger');

/**
 * SQLite数据库适配器
 */
class SQLiteAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.dbPath = config.path;
  }

  async init() {
    try {
      // 确保数据库目录存在
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 连接数据库
      this.connection = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('SQLite数据库连接失败', { error: err.message });
          throw err;
        }
        logger.info('SQLite数据库连接成功', { path: this.dbPath });
      });

      // 启用外键约束
      await this.run('PRAGMA foreign_keys = ON');
      
    } catch (error) {
      logger.error('SQLite数据库初始化失败', { error: error.message });
      throw error;
    }
  }

  async close() {
    if (this.connection) {
      return new Promise((resolve, reject) => {
        this.connection.close((err) => {
          if (err) {
            logger.error('SQLite数据库关闭失败', { error: err.message });
            reject(err);
          } else {
            logger.info('SQLite数据库连接已关闭');
            this.connection = null;
            resolve();
          }
        });
      });
    }
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.connection.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('SQLite查询失败', { sql, params, error: err.message });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.connection.get(sql, params, (err, row) => {
        if (err) {
          logger.error('SQLite查询失败', { sql, params, error: err.message });
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.connection.run(sql, params, function(err) {
        if (err) {
          logger.error('SQLite执行失败', { sql, params, error: err.message });
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  async beginTransaction() {
    return this.run('BEGIN TRANSACTION');
  }

  async commit() {
    return this.run('COMMIT');
  }

  async rollback() {
    return this.run('ROLLBACK');
  }

  async isConnected() {
    try {
      await this.get('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = SQLiteAdapter;
