const config = require('../config');
const logger = require('../utils/logger');
const DatabaseFactory = require('./adapters/DatabaseFactory');
const DatabaseInitializer = require('./init');

class DatabaseService {
  constructor() {
    this.adapter = null;
    this.config = config.database;
  }

  async init() {
    try {
      // 验证数据库配置
      DatabaseFactory.validateConfig(this.config);

      // 创建数据库适配器
      this.adapter = DatabaseFactory.createAdapter(this.config);

      // 检查是否需要初始化数据库
      const needsInit = await this.checkNeedsInitialization();
      if (needsInit) {
        logger.info('数据库需要初始化...');
        const initializer = new DatabaseInitializer();
        await initializer.init();
      }

      // 初始化数据库连接
      await this.adapter.init();

    } catch (error) {
      logger.error('数据库初始化失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 检查是否需要初始化数据库
   */
  async checkNeedsInitialization() {
    const dbType = this.config.type.toLowerCase();

    if (dbType === 'sqlite') {
      const fs = require('fs');
      return !fs.existsSync(this.config.path);
    } else if (dbType === 'mysql') {
      // 对于MySQL，尝试连接并检查表是否存在
      try {
        const tempAdapter = DatabaseFactory.createAdapter(this.config);
        await tempAdapter.init();

        // 检查是否存在users表
        const result = await tempAdapter.query(
          "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
          [this.config.mysql.database]
        );

        await tempAdapter.close();
        return result[0].count === 0;
      } catch (error) {
        // 如果连接失败或表不存在，需要初始化
        return true;
      }
    }

    return false;
  }

  async close() {
    if (this.adapter) {
      await this.adapter.close();
      this.adapter = null;
    }
  }

  async query(sql, params = []) {
    if (!this.adapter) {
      throw new Error('数据库未初始化');
    }
    return this.adapter.query(sql, params);
  }

  async get(sql, params = []) {
    if (!this.adapter) {
      throw new Error('数据库未初始化');
    }
    return this.adapter.get(sql, params);
  }

  async run(sql, params = []) {
    if (!this.adapter) {
      throw new Error('数据库未初始化');
    }
    return this.adapter.run(sql, params);
  }

  async beginTransaction() {
    if (!this.adapter) {
      throw new Error('数据库未初始化');
    }
    return this.adapter.beginTransaction();
  }

  async commit() {
    if (!this.adapter) {
      throw new Error('数据库未初始化');
    }
    return this.adapter.commit();
  }

  async rollback() {
    if (!this.adapter) {
      throw new Error('数据库未初始化');
    }
    return this.adapter.rollback();
  }

  async transaction(callback) {
    if (!this.adapter) {
      throw new Error('数据库未初始化');
    }

    try {
      await this.beginTransaction();
      const result = await callback(this);
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  getDatabase() {
    return this.adapter ? this.adapter.getConnection() : null;
  }

  async isConnected() {
    if (!this.adapter) {
      return false;
    }
    return this.adapter.isConnected();
  }

  getDatabaseType() {
    return this.config.type;
  }
}

module.exports = new DatabaseService();
