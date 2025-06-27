const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('../config');
const logger = require('../utils/logger');

class DatabaseInitializer {
  constructor() {
    this.dbPath = config.database.path;
    this.schemaPath = path.join(__dirname, 'schema.sql');
  }

  async init() {
    try {
      // 确保数据库目录存在
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.info('创建数据库目录', { path: dbDir });
      }

      // 连接数据库
      const db = new sqlite3.Database(this.dbPath);
      
      // 启用外键约束
      await this.runQuery(db, 'PRAGMA foreign_keys = ON');
      
      // 读取并执行schema.sql
      const schema = fs.readFileSync(this.schemaPath, 'utf8');
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await this.runQuery(db, statement);
        }
      }

      // 插入默认配置
      await this.insertDefaultConfig(db);
      
      // 创建默认管理员
      await this.createDefaultAdmin(db);

      db.close();
      logger.info('数据库初始化完成', { path: this.dbPath });
      
    } catch (error) {
      logger.error('数据库初始化失败', { error: error.message });
      throw error;
    }
  }

  runQuery(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  async insertDefaultConfig(db) {
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

    for (const config of defaultConfigs) {
      try {
        await this.runQuery(db, 
          'INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES (?, ?, ?, ?)',
          [config.key, config.value, config.type, config.description]
        );
      } catch (error) {
        logger.warn('插入默认配置失败', { key: config.key, error: error.message });
      }
    }

    logger.info('默认配置插入完成');
  }

  async createDefaultAdmin(db) {
    const bcrypt = require('bcryptjs');
    const username = config.admin.username;
    const password = config.admin.password;
    const passwordHash = bcrypt.hashSync(password, 10);

    try {
      await this.runQuery(db,
        'INSERT OR IGNORE INTO admins (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)',
        [username, passwordHash, 'admin', JSON.stringify(['all'])]
      );
      logger.info('默认管理员创建完成', { username });
    } catch (error) {
      logger.warn('创建默认管理员失败', { error: error.message });
    }
  }

  async createDefaultCategories(db) {
    const defaultCategories = [
      { name: '游戏充值', description: '各类游戏充值卡', icon: '🎮', sort_order: 1 },
      { name: '软件激活', description: '软件激活码', icon: '💻', sort_order: 2 },
      { name: '会员服务', description: '各类会员卡', icon: '👑', sort_order: 3 }
    ];

    for (const category of defaultCategories) {
      try {
        await this.runQuery(db,
          'INSERT OR IGNORE INTO categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)',
          [category.name, category.description, category.icon, category.sort_order]
        );
      } catch (error) {
        logger.warn('插入默认分类失败', { name: category.name, error: error.message });
      }
    }

    logger.info('默认分类创建完成');
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
