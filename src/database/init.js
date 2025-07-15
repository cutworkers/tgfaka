const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const DatabaseFactory = require('./adapters/DatabaseFactory');

class DatabaseInitializer {
  constructor() {
    this.config = config.database;
    this.adapter = null;
  }

  async init() {
    try {
      const dbType = this.config.type.toLowerCase();
      logger.info('开始初始化数据库', { type: dbType });

      // 创建数据库适配器
      this.adapter = DatabaseFactory.createAdapter(this.config);

      // 对于SQLite，确保数据库目录存在
      if (dbType === 'sqlite') {
        const dbDir = path.dirname(this.config.path);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
          logger.info('创建数据库目录', { path: dbDir });
        }
      }

      // 初始化数据库连接
      await this.adapter.init();

      // 读取并执行schema文件
      await this.executeSchema();

      // 插入默认配置
      await this.insertDefaultConfig();

      // 创建默认管理员
      await this.createDefaultAdmin();

      // 关闭连接
      await this.adapter.close();
      logger.info('数据库初始化完成', { type: dbType });

    } catch (error) {
      logger.error('数据库初始化失败', { error: error.message });
      if (this.adapter) {
        await this.adapter.close();
      }
      throw error;
    }
  }

  async executeSchema() {
    const dbType = this.config.type.toLowerCase();
    let schemaPath;

    // 根据数据库类型选择schema文件
    if (dbType === 'mysql') {
      schemaPath = path.join(__dirname, 'mysql-schema.sql');
    } else {
      schemaPath = path.join(__dirname, 'schema.sql');
    }

    logger.info('执行数据库schema', { schemaPath });

    // 读取schema文件
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema.split(';').filter(stmt => stmt.trim());

    // 执行每个SQL语句
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await this.adapter.run(statement);
        } catch (error) {
          // 对于MySQL，忽略表已存在的错误
          if (dbType === 'mysql' && error.code === 'ER_TABLE_EXISTS_ERROR') {
            continue;
          }
          throw error;
        }
      }
    }
  }

  async insertDefaultConfig() {
    const defaultConfigs = [
      {
        key: 'site_name',
        value: 'Telegram卡密销售系统',
        type: 'string',
        description: '网站名称'
      },
      {
        key: 'order_timeout_minutes',
        value: '30',
        type: 'number',
        description: '订单超时时间(分钟)'
      },
      {
        key: 'card_expire_hours',
        value: '24',
        type: 'number',
        description: '卡密过期时间(小时)'
      },
      {
        key: 'min_usdt_amount',
        value: '1',
        type: 'number',
        description: 'USDT最小支付金额'
      },
      {
        key: 'usdt_rate',
        value: '6.5',
        type: 'number',
        description: 'USDT汇率(CNY)'
      },
      {
        key: 'auto_delivery',
        value: 'true',
        type: 'boolean',
        description: '自动发货'
      },
      {
        key: 'welcome_message',
        value: '欢迎使用卡密销售Bot！',
        type: 'string',
        description: '欢迎消息'
      }
    ];

    const dbType = this.config.type.toLowerCase();
    const insertIgnoreSql = dbType === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';

    for (const config of defaultConfigs) {
      try {
        await this.adapter.run(
          `${insertIgnoreSql} INTO system_config (config_key, config_value, config_type, description) VALUES (?, ?, ?, ?)`,
          [config.key, config.value, config.type, config.description]
        );
      } catch (error) {
        logger.warn('插入默认配置失败', { key: config.key, error: error.message });
      }
    }

    logger.info('默认配置插入完成');
  }

  async createDefaultAdmin() {
    const bcrypt = require('bcryptjs');
    const username = config.admin.username;
    const password = config.admin.password;
    const passwordHash = bcrypt.hashSync(password, 10);

    const dbType = this.config.type.toLowerCase();
    const insertIgnoreSql = dbType === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';

    try {
      await this.adapter.run(
        `${insertIgnoreSql} INTO admins (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)`,
        [username, passwordHash, 'admin', JSON.stringify(['all'])]
      );
      logger.info('默认管理员创建完成', { username });
    } catch (error) {
      logger.warn('创建默认管理员失败', { error: error.message });
    }
  }


}

// 如果直接运行此文件，则执行初始化
if (require.main === module) {
  const initializer = new DatabaseInitializer();
  initializer.init()
    .then(() => {
      console.log('数据库初始化成功！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('数据库初始化失败:', error.message);
      process.exit(1);
    });
}

module.exports = DatabaseInitializer;
