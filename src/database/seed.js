const DatabaseInitializer = require('./init');
const databaseService = require('./index');
const logger = require('../utils/logger');

class DatabaseSeeder {
  constructor() {
    this.db = null;
  }

  async seed() {
    try {
      // 初始化数据库连接
      await databaseService.init();
      this.db = databaseService.getDatabase();

      // 创建默认分类
      await this.createDefaultCategories();
      
      // 创建示例商品
      await this.createSampleProducts();
      
      // 创建示例卡密
      await this.createSampleCards();

      logger.info('数据库种子数据创建完成');
      
    } catch (error) {
      logger.error('种子数据创建失败', { error: error.message });
      throw error;
    } finally {
      if (this.db) {
        await databaseService.close();
      }
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

    for (const category of categories) {
      try {
        await databaseService.run(
          'INSERT OR IGNORE INTO categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)',
          [category.name, category.description, category.icon, category.sort_order]
        );
        logger.info('创建分类', { name: category.name });
      } catch (error) {
        logger.warn('创建分类失败', { name: category.name, error: error.message });
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
      }
    ];

    for (const product of products) {
      try {
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
        logger.info('创建商品', { name: product.name, id: result.id });
      } catch (error) {
        logger.warn('创建商品失败', { name: product.name, error: error.message });
      }
    }
  }

  async createSampleCards() {
    // 为每个商品创建一些示例卡密
    const products = await databaseService.query('SELECT id, name FROM products');
    
    for (const product of products) {
      const cardCount = Math.floor(Math.random() * 10) + 5; // 5-14张卡密
      
      for (let i = 1; i <= cardCount; i++) {
        const cardNumber = this.generateCardNumber();
        const cardPassword = this.generateCardPassword();
        
        try {
          await databaseService.run(
            'INSERT INTO cards (product_id, card_number, card_password, batch_id, status) VALUES (?, ?, ?, ?, ?)',
            [product.id, cardNumber, cardPassword, `BATCH_${Date.now()}`, 'available']
          );
        } catch (error) {
          logger.warn('创建卡密失败', { product: product.name, error: error.message });
        }
      }
      
      logger.info('为商品创建卡密', { product: product.name, count: cardCount });
    }
  }

  generateCardNumber() {
    // 生成16位卡号
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  generateCardPassword() {
    // 生成12位密码
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// 如果直接运行此文件，则执行种子数据创建
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.seed()
    .then(() => {
      console.log('种子数据创建成功！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('种子数据创建失败:', error.message);
      process.exit(1);
    });
}

module.exports = DatabaseSeeder;
