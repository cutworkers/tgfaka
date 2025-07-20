const databaseService = require('./index');
const config = require('../config');
const logger = require('../utils/logger');

class DatabaseSeeder {
  constructor() {
    this.db = null;
    // 从配置中直接获取数据库类型，确保与.env中的DATABASE_TYPE一致
    this.dbType = this.getDatabaseTypeFromConfig();
  }

  /**
   * 从配置中获取数据库类型
   * 优先级：DATABASE_TYPE环境变量 > config.database.type > 默认sqlite
   */
  getDatabaseTypeFromConfig() {
    const envType = process.env.DATABASE_TYPE;
    const configType = config.database.type;
    const defaultType = 'sqlite';
    
    // 只有当环境变量存在且不为空时才使用
    let selectedType;
    let source;
    
    if (envType && envType.trim() !== '') {
      selectedType = envType.toLowerCase();
      source = 'environment';
    } else if (configType && configType.trim() !== '') {
      selectedType = configType.toLowerCase();
      source = 'config';
    } else {
      selectedType = defaultType;
      source = 'default';
    }
    
    logger.debug('数据库类型配置', {
      envType: envType || 'undefined',
      configType: configType || 'undefined',
      selectedType,
      source
    });
    
    return selectedType;
  }

  async seed(options = {}) {
    try {
      // 初始化数据库连接
      await databaseService.init();
      this.db = databaseService.getDatabase();
      
      // 验证配置的数据库类型与实际使用的是否一致
      const actualDbType = databaseService.getDatabaseType().toLowerCase();
      if (this.dbType !== actualDbType) {
        logger.warn('配置的数据库类型与实际使用的不一致', {
          configured: this.dbType,
          actual: actualDbType,
          envValue: process.env.DATABASE_TYPE
        });
        // 使用实际的数据库类型
        this.dbType = actualDbType;
      }

      logger.info('开始创建种子数据', {
        dbType: this.dbType,
        configuredType: config.database.type,
        envType: process.env.DATABASE_TYPE,
        cleanFirst: options.clean || false
      });

      // 显示数据库配置信息
      this.displayDatabaseConfig();

      // 验证数据库表结构
      await this.validateDatabase();

      // 如果指定了清理选项，先清理现有数据
      if (options.clean) {
        await this.cleanSeedData();
      }

      // 创建默认分类
      await this.createDefaultCategories();

      // 创建示例商品
      await this.createSampleProducts();

      // 创建示例卡密
      await this.createSampleCards();

      // 输出统计信息
      await this.printStatistics();

      logger.info('数据库种子数据创建完成', { dbType: this.dbType });

    } catch (error) {
      logger.error('种子数据创建失败', {
        error: error.message,
        stack: error.stack,
        dbType: this.dbType
      });
      throw error;
    } finally {
      if (this.db) {
        await databaseService.close();
      }
    }
  }

  /**
   * 输出数据统计信息
   */
  async printStatistics() {
    try {
      const stats = {};

      // 统计分类数量
      const categoryResult = await databaseService.get('SELECT COUNT(*) as count FROM categories');
      stats.categories = this.dbType === 'mysql' ? categoryResult.count : categoryResult['COUNT(*)'];

      // 统计商品数量
      const productResult = await databaseService.get('SELECT COUNT(*) as count FROM products');
      stats.products = this.dbType === 'mysql' ? productResult.count : productResult['COUNT(*)'];

      // 统计卡密数量
      const cardResult = await databaseService.get('SELECT COUNT(*) as count FROM cards');
      stats.cards = this.dbType === 'mysql' ? cardResult.count : cardResult['COUNT(*)'];

      // 按状态统计卡密
      const cardStatusResult = await databaseService.query(
        'SELECT status, COUNT(*) as count FROM cards GROUP BY status'
      );

      stats.cardsByStatus = {};
      cardStatusResult.forEach(row => {
        const count = this.dbType === 'mysql' ? row.count : row['COUNT(*)'];
        stats.cardsByStatus[row.status] = count;
      });

      logger.info('种子数据统计', {
        dbType: this.dbType,
        statistics: stats
      });

      console.log('\n📊 种子数据统计信息:');
      console.log(`数据库类型: ${this.dbType.toUpperCase()}`);
      console.log(`分类数量: ${stats.categories}`);
      console.log(`商品数量: ${stats.products}`);
      console.log(`卡密总数: ${stats.cards}`);
      console.log('卡密状态分布:');
      Object.entries(stats.cardsByStatus).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count}`);
      });
      console.log('');

    } catch (error) {
      logger.warn('获取统计信息失败', { error: error.message, dbType: this.dbType });
    }
  }

  async createDefaultCategories() {
    const categories = [
      {
        name: '游戏充值',
        description: '各类游戏充值卡密',
        icon: '🎮',
        sort_order: 1
      },
      {
        name: '软件激活',
        description: '软件激活码和许可证',
        icon: '💻',
        sort_order: 2
      },
      {
        name: '会员服务',
        description: '各类平台会员卡',
        icon: '👑',
        sort_order: 3
      },
      {
        name: '礼品卡',
        description: '购物平台礼品卡',
        icon: '🎁',
        sort_order: 4
      }
    ];

    // 根据数据库类型选择合适的INSERT语句
    const insertIgnoreSql = this.dbType === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';

    for (const category of categories) {
      try {
        await databaseService.run(
          `${insertIgnoreSql} INTO categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)`,
          [category.name, category.description, category.icon, category.sort_order]
        );
        logger.info('创建分类', { name: category.name, dbType: this.dbType });
      } catch (error) {
        logger.warn('创建分类失败', { name: category.name, error: error.message, dbType: this.dbType });
      }
    }
  }

  async createSampleProducts() {
    const products = [
      {
        category_id: 1,
        name: '王者荣耀点券',
        description: '王者荣耀游戏内充值点券，可购买皮肤、英雄等',
        price: 10.00,
        original_price: 12.00,
        stock_count: 100,
        min_stock_alert: 10,
        sort_order: 1
      },
      {
        category_id: 1,
        name: '和平精英UC',
        description: '和平精英游戏UC充值，可购买服装、武器皮肤',
        price: 6.00,
        original_price: 8.00,
        stock_count: 150,
        min_stock_alert: 15,
        sort_order: 2
      },
      {
        category_id: 1,
        name: '原神创世结晶',
        description: '原神游戏内充值货币，可抽卡、购买月卡等',
        price: 30.00,
        original_price: 35.00,
        stock_count: 80,
        min_stock_alert: 10,
        sort_order: 3
      },
      {
        category_id: 2,
        name: 'Windows 11 Pro',
        description: 'Windows 11 专业版激活密钥',
        price: 25.00,
        original_price: 30.00,
        stock_count: 50,
        min_stock_alert: 5,
        sort_order: 1
      },
      {
        category_id: 2,
        name: 'Office 2021',
        description: 'Microsoft Office 2021 激活码',
        price: 35.00,
        original_price: 40.00,
        stock_count: 30,
        min_stock_alert: 5,
        sort_order: 2
      },
      {
        category_id: 3,
        name: '爱奇艺VIP月卡',
        description: '爱奇艺会员月卡，享受高清无广告观影',
        price: 15.00,
        original_price: 19.80,
        stock_count: 200,
        min_stock_alert: 20,
        sort_order: 1
      },
      {
        category_id: 3,
        name: '腾讯视频VIP月卡',
        description: '腾讯视频会员月卡，海量影视资源',
        price: 16.00,
        original_price: 20.00,
        stock_count: 180,
        min_stock_alert: 20,
        sort_order: 2
      },
      {
        category_id: 4,
        name: '京东E卡',
        description: '京东购物卡，可在京东商城购买商品',
        price: 95.00,
        original_price: 100.00,
        stock_count: 60,
        min_stock_alert: 10,
        sort_order: 1
      },
      {
        category_id: 4,
        name: '天猫超市卡',
        description: '天猫超市购物卡，享受便民购物',
        price: 48.00,
        original_price: 50.00,
        stock_count: 80,
        min_stock_alert: 15,
        sort_order: 2
      }
    ];

    // 根据数据库类型选择合适的INSERT语句
    const insertIgnoreSql = this.dbType === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';

    for (const product of products) {
      try {
        // 先检查商品是否已存在（通过名称）
        const existingProduct = await databaseService.get(
          'SELECT id FROM products WHERE name = ?',
          [product.name]
        );

        if (existingProduct) {
          logger.info('商品已存在，跳过创建', { name: product.name, id: existingProduct.id });
          continue;
        }

        const result = await databaseService.run(
          `INSERT INTO products (category_id, name, description, price, original_price, 
                               stock_count, min_stock_alert, sort_order, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            product.category_id,
            product.name,
            product.description,
            product.price,
            product.original_price,
            product.stock_count,
            product.min_stock_alert,
            product.sort_order
          ]
        );

        // 获取插入的ID（MySQL和SQLite返回格式不同）
        const insertId = this.dbType === 'mysql' ? result.insertId : result.lastID;
        logger.info('创建商品', { name: product.name, id: insertId, dbType: this.dbType });
      } catch (error) {
        logger.warn('创建商品失败', { name: product.name, error: error.message, dbType: this.dbType });
      }
    }
  }

  async createSampleCards() {
    // 为每个商品创建一些示例卡密
    const products = await databaseService.query('SELECT id, name FROM products');

    logger.info('开始为商品创建示例卡密', { productCount: products.length, dbType: this.dbType });

    for (const product of products) {
      // 检查该商品是否已有卡密
      const existingCards = await databaseService.query(
        'SELECT COUNT(*) as count FROM cards WHERE product_id = ?',
        [product.id]
      );

      const existingCount = this.dbType === 'mysql' ? existingCards[0].count : existingCards[0]['COUNT(*)'];

      if (existingCount > 0) {
        logger.info('商品已有卡密，跳过创建', {
          product: product.name,
          existingCount,
          dbType: this.dbType
        });
        continue;
      }

      const cardCount = Math.floor(Math.random() * 10) + 5; // 5-14张卡密
      const batchId = `BATCH_${Date.now()}_${product.id}`;
      let successCount = 0;

      for (let i = 1; i <= cardCount; i++) {
        const cardNumber = this.generateCardNumber();
        const cardPassword = this.generateCardPassword();

        try {
          await databaseService.run(
            'INSERT INTO cards (product_id, card_number, card_password, batch_id, status) VALUES (?, ?, ?, ?, ?)',
            [product.id, cardNumber, cardPassword, batchId, 'available']
          );
          successCount++;
        } catch (error) {
          logger.warn('创建卡密失败', {
            product: product.name,
            cardNumber: cardNumber.substring(0, 8) + '****',
            error: error.message,
            dbType: this.dbType
          });
        }
      }

      logger.info('为商品创建卡密完成', {
        product: product.name,
        requestedCount: cardCount,
        successCount,
        batchId,
        dbType: this.dbType
      });
    }
  }

  generateCardNumber() {
    // 生成16位卡号，格式：XXXX-XXXX-XXXX-XXXX
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) {
        result += '-';
      }
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  generateCardPassword() {
    // 生成12位密码，包含数字、大小写字母
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 清理现有的种子数据（仅用于开发环境）
   */
  async cleanSeedData() {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('生产环境不允许清理种子数据');
      return;
    }

    try {
      logger.info('开始清理现有种子数据', { dbType: this.dbType });

      // 删除卡密（有外键约束，需要先删除）
      await databaseService.run('DELETE FROM cards WHERE batch_id LIKE ?', ['BATCH_%']);

      // 删除商品
      await databaseService.run('DELETE FROM products WHERE name IN (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        '王者荣耀点券', '和平精英UC', '原神创世结晶', 'Windows 11 Pro', 'Office 2021',
        '爱奇艺VIP月卡', '腾讯视频VIP月卡', '京东E卡', '天猫超市卡'
      ]);

      // 删除分类
      await databaseService.run('DELETE FROM categories WHERE name IN (?, ?, ?, ?)', [
        '游戏充值', '软件激活', '会员服务', '礼品卡'
      ]);

      logger.info('种子数据清理完成', { dbType: this.dbType });
    } catch (error) {
      logger.error('清理种子数据失败', { error: error.message, dbType: this.dbType });
      throw error;
    }
  }

  /**
   * 显示数据库配置信息
   */
  displayDatabaseConfig() {
    console.log('\n🔧 数据库配置信息:');
    console.log(`环境变量 DATABASE_TYPE: ${process.env.DATABASE_TYPE || '未设置'}`);
    console.log(`配置文件 database.type: ${config.database.type || '未设置'}`);
    console.log(`实际使用类型: ${this.dbType.toUpperCase()}`);
    
    if (this.dbType === 'mysql') {
      console.log(`MySQL连接信息: ${config.database.mysql.username}@${config.database.mysql.host}:${config.database.mysql.port}/${config.database.mysql.database}`);
    } else if (this.dbType === 'sqlite') {
      console.log(`SQLite文件路径: ${config.database.path}`);
    }
    console.log('');
  }

  /**
   * 验证数据库连接和表结构
   */
  async validateDatabase() {
    try {
      logger.info('验证数据库连接和表结构', { dbType: this.dbType });

      // 检查必要的表是否存在
      const requiredTables = ['categories', 'products', 'cards', 'users', 'orders'];

      for (const table of requiredTables) {
        let query;
        if (this.dbType === 'mysql') {
          query = `SELECT COUNT(*) as count FROM information_schema.tables 
                   WHERE table_schema = DATABASE() AND table_name = ?`;
        } else {
          query = `SELECT COUNT(*) as count FROM sqlite_master 
                   WHERE type='table' AND name = ?`;
        }

        const result = await databaseService.get(query, [table]);
        const count = this.dbType === 'mysql' ? result.count : result['COUNT(*)'];

        if (count === 0) {
          throw new Error(`表 ${table} 不存在，请先运行数据库初始化`);
        }
      }

      logger.info('数据库表结构验证通过', { dbType: this.dbType });
    } catch (error) {
      logger.error('数据库验证失败', { error: error.message, dbType: this.dbType });
      throw error;
    }
  }
}

// 如果直接运行此文件，则执行种子数据创建
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    clean: args.includes('--clean') || args.includes('-c')
  };

  console.log('🌱 开始执行数据库种子数据创建...');
  if (options.clean) {
    console.log('⚠️  将清理现有种子数据');
  }

  const seeder = new DatabaseSeeder();
  seeder.seed(options)
    .then(() => {
      console.log('✅ 种子数据创建成功！');
      console.log('\n💡 提示:');
      console.log('- 可以访问管理后台查看创建的数据');
      console.log('- 使用 --clean 参数可以清理并重新创建种子数据');
      console.log('- 示例: npm run db:seed -- --clean');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 种子数据创建失败:', error.message);
      if (process.env.NODE_ENV !== 'production') {
        console.error('详细错误信息:', error.stack);
      }
      console.log('\n🔧 故障排除建议:');
      console.log('1. 确保数据库已正确初始化: npm run db:init');
      console.log('2. 检查数据库连接配置');
      console.log('3. 确保数据库服务正在运行');
      process.exit(1);
    });
}

module.exports = DatabaseSeeder;
