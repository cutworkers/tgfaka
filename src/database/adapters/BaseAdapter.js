/**
 * 数据库适配器基类
 * 定义所有数据库适配器必须实现的接口
 */
class BaseAdapter {
  constructor(config) {
    this.config = config;
    this.connection = null;
  }

  /**
   * 初始化数据库连接
   */
  async init() {
    throw new Error('init() method must be implemented');
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    throw new Error('close() method must be implemented');
  }

  /**
   * 执行查询语句，返回多行结果
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数数组
   * @returns {Promise<Array>} 查询结果
   */
  async query(sql, params = []) {
    throw new Error('query() method must be implemented');
  }

  /**
   * 执行查询语句，返回单行结果
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数数组
   * @returns {Promise<Object|null>} 查询结果
   */
  async get(sql, params = []) {
    throw new Error('get() method must be implemented');
  }

  /**
   * 执行更新语句（INSERT, UPDATE, DELETE）
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数数组
   * @returns {Promise<Object>} 执行结果，包含lastID和changes
   */
  async run(sql, params = []) {
    throw new Error('run() method must be implemented');
  }

  /**
   * 开始事务
   */
  async beginTransaction() {
    throw new Error('beginTransaction() method must be implemented');
  }

  /**
   * 提交事务
   */
  async commit() {
    throw new Error('commit() method must be implemented');
  }

  /**
   * 回滚事务
   */
  async rollback() {
    throw new Error('rollback() method must be implemented');
  }

  /**
   * 获取数据库连接对象
   */
  getConnection() {
    return this.connection;
  }

  /**
   * 检查连接是否有效
   */
  async isConnected() {
    throw new Error('isConnected() method must be implemented');
  }
}

module.exports = BaseAdapter;
