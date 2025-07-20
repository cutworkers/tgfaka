const mysql = require('mysql2/promise');
const BaseAdapter = require('./BaseAdapter');
const logger = require('../../utils/logger');
const fs = require('fs');

/**
 * MySQL数据库适配器
 */
class MySQLAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.pool = null;
    this.transactionConnection = null;
  }

  async init() {
    try {
      // 创建连接池
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        charset: this.config.charset,
        timezone: this.config.timezone,
        connectionLimit: this.config.connectionLimit,
        ssl: this.config.ssl === 'true' ? {
          minVersion: 'TLSv1.2',
          ca: this.config.ca_path ? fs.readFileSync(this.config.ca_path) : undefined
       } : null,
        // 连接池配置
        queueLimit: 0,
        acquireTimeout: 60000,
        timeout: 60000,
        // MySQL特定配置
        supportBigNumbers: true,
        bigNumberStrings: true,
        dateStrings: false,
        debug: false,
        multipleStatements: false
      });

      // 测试连接
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      logger.info('MySQL数据库连接池创建成功', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database
      });

    } catch (error) {
      logger.error('MySQL数据库初始化失败', { error: error.message });
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
        logger.info('MySQL数据库连接池已关闭');
      } catch (error) {
        logger.error('MySQL数据库关闭失败', { error: error.message });
        throw error;
      }
    }
  }

  async query(sql, params = []) {
    try {
      const connection = this.transactionConnection || this.pool;
      const [rows] = await connection.execute(sql, params);
      return rows;
    } catch (error) {
      logger.error('MySQL查询失败', { sql, params, error: error.message });
      throw error;
    }
  }

  async get(sql, params = []) {
    try {
      const connection = this.transactionConnection || this.pool;
      const [rows] = await connection.execute(sql, params);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('MySQL查询失败', { sql, params, error: error.message });
      throw error;
    }
  }

  async run(sql, params = []) {
    try {
      const connection = this.transactionConnection || this.pool;
      const [result] = await connection.execute(sql, params);
      
      return {
        lastID: result.insertId || 0,
        changes: result.affectedRows || 0,
        info: result.info || ''
      };
    } catch (error) {
      logger.error('MySQL执行失败', { sql, params, error: error.message });
      throw error;
    }
  }

  async beginTransaction() {
    try {
      this.transactionConnection = await this.pool.getConnection();
      await this.transactionConnection.beginTransaction();
      logger.debug('MySQL事务开始');
    } catch (error) {
      logger.error('MySQL开始事务失败', { error: error.message });
      throw error;
    }
  }

  async commit() {
    try {
      if (this.transactionConnection) {
        await this.transactionConnection.commit();
        this.transactionConnection.release();
        this.transactionConnection = null;
        logger.debug('MySQL事务提交成功');
      }
    } catch (error) {
      logger.error('MySQL提交事务失败', { error: error.message });
      throw error;
    }
  }

  async rollback() {
    try {
      if (this.transactionConnection) {
        await this.transactionConnection.rollback();
        this.transactionConnection.release();
        this.transactionConnection = null;
        logger.debug('MySQL事务回滚成功');
      }
    } catch (error) {
      logger.error('MySQL回滚事务失败', { error: error.message });
      throw error;
    }
  }

  getConnection() {
    return this.transactionConnection || this.pool;
  }

  async isConnected() {
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = MySQLAdapter;
