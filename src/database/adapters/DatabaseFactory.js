const SQLiteAdapter = require('./SQLiteAdapter');
const MySQLAdapter = require('./MySQLAdapter');
const logger = require('../../utils/logger');

/**
 * 数据库适配器工厂类
 * 根据配置创建相应的数据库适配器
 */
class DatabaseFactory {
  /**
   * 创建数据库适配器
   * @param {Object} config - 数据库配置
   * @returns {BaseAdapter} 数据库适配器实例
   */
  static createAdapter(config) {
    const dbType = config.type.toLowerCase();
    
    logger.info('创建数据库适配器', { type: dbType });

    switch (dbType) {
      case 'sqlite':
        return new SQLiteAdapter(config);
        
      case 'mysql':
        return new MySQLAdapter(config.mysql);
        
      default:
        throw new Error(`不支持的数据库类型: ${dbType}`);
    }
  }

  /**
   * 获取支持的数据库类型列表
   * @returns {Array<string>} 支持的数据库类型
   */
  static getSupportedTypes() {
    return ['sqlite', 'mysql'];
  }

  /**
   * 验证数据库配置
   * @param {Object} config - 数据库配置
   * @returns {boolean} 配置是否有效
   */
  static validateConfig(config) {
    if (!config || !config.type) {
      throw new Error('数据库配置缺少type字段');
    }

    const dbType = config.type.toLowerCase();
    
    if (!this.getSupportedTypes().includes(dbType)) {
      throw new Error(`不支持的数据库类型: ${dbType}`);
    }

    switch (dbType) {
      case 'sqlite':
        if (!config.path) {
          throw new Error('SQLite配置缺少path字段');
        }
        break;
        
      case 'mysql':
        if (!config.mysql) {
          throw new Error('MySQL配置缺少mysql字段');
        }
        
        const required = ['host', 'port', 'database', 'username'];
        for (const field of required) {
          if (!config.mysql[field]) {
            throw new Error(`MySQL配置缺少${field}字段`);
          }
        }
        break;
    }

    return true;
  }
}

module.exports = DatabaseFactory;
