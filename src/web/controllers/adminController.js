const bcrypt = require('bcryptjs');
const databaseService = require('../../database');
const Product = require('../../database/models/Product');
const Order = require('../../database/models/Order');
const Card = require('../../database/models/Card');
const User = require('../../database/models/User');
const Category = require('../../database/models/Category');
const logger = require('../../utils/logger');
const config = require('../../config');

class AdminController {
  // 登录页面
  static async loginPage(req, res) {
    try {
      if (req.session.admin) {
        return res.redirect('/admin/dashboard');
      }
      
      res.render('admin/login', {
        title: '管理员登录',
        error: req.query.error
      });
    } catch (error) {
      logger.error('显示登录页面失败', { error: error.message });
      res.status(500).send('服务器错误');
    }
  }

  // 处理登录
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.redirect('/admin/login?error=请输入用户名和密码');
      }

      // 验证管理员账户
      const admin = await databaseService.get(
        'SELECT * FROM admins WHERE username = ? AND status = "active"',
        [username]
      );

      if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        logger.warn('管理员登录失败', { username, ip: req.ip });
        return res.redirect('/admin/login?error=用户名或密码错误');
      }

      // 更新最后登录时间
      await databaseService.run(
        'UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
        [admin.id]
      );

      // 设置session
      req.session.admin = {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        permissions: JSON.parse(admin.permissions || '[]')
      };

      // 强制保存session并等待完成
      req.session.save((err) => {
        if (err) {
          logger.error('Session保存失败', {
            error: err.message,
            adminId: admin.id,
            sessionId: req.session.id
          });
          return res.redirect('/admin/login?error=登录失败，请重试');
        }

        logger.info('管理员登录成功', {
          adminId: admin.id,
          username: admin.username,
          ip: req.ip,
          sessionId: req.session.id,
          hasSessionAdmin: !!req.session.admin
        });

        res.redirect('/admin/dashboard');
      });
    } catch (error) {
      logger.error('管理员登录失败', { error: error.message });
      res.redirect('/admin/login?error=登录失败，请重试');
    }
  }

  // 退出登录
  static async logout(req, res) {
    try {
      req.session.destroy((err) => {
        if (err) {
          logger.error('退出登录失败', { error: err.message });
        }
        res.redirect('/admin/login');
      });
    } catch (error) {
      logger.error('退出登录失败', { error: error.message });
      res.redirect('/admin/login');
    }
  }

  // 仪表板
  static async dashboard(req, res) {
    try {
      // 获取统计数据
      const stats = await AdminController.getDashboardStats();
      
      res.render('admin/dashboard', {
        title: '管理后台',
        admin: req.session.admin,
        stats,
        currentPage: 'dashboard'
      });
    } catch (error) {
      logger.error('显示仪表板失败', { error: error.message });
      res.status(500).send('服务器错误');
    }
  }

  // 获取仪表板统计数据
  static async getDashboardStats() {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // 订单统计
      const orderStats = await Order.getStats();
      const todayOrderStats = await Order.getStats({
        date_from: todayStr + ' 00:00:00',
        date_to: todayStr + ' 23:59:59'
      });

      // 卡密统计
      const cardStats = await Card.getStats();

      // 用户统计
      const userStats = await databaseService.get(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN created_at >= ? THEN 1 END) as today_new
        FROM users
      `, [todayStr + ' 00:00:00']);

      // 商品统计
      const productStats = await databaseService.get(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN stock_count <= min_stock_alert THEN 1 END) as low_stock
        FROM products
      `);

      // 最近订单
      const recentOrders = await databaseService.query(`
        SELECT o.*, p.name as product_name, u.username, u.telegram_id
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
        LIMIT 10
      `);

      // 热销商品
      const topProducts = await databaseService.query(`
        SELECT p.*, COUNT(o.id) as order_count, SUM(o.total_amount) as total_revenue
        FROM products p
        LEFT JOIN orders o ON p.id = o.product_id AND o.status = 'completed'
        GROUP BY p.id
        ORDER BY order_count DESC
        LIMIT 5
      `);

      return {
        orders: {
          total: orderStats.total,
          pending: orderStats.pending,
          completed: orderStats.completed,
          today_completed: todayOrderStats.completed,
          total_revenue: orderStats.total_revenue,
          today_revenue: todayOrderStats.total_revenue
        },
        cards: {
          total: cardStats.total,
          available: cardStats.available,
          sold: cardStats.sold,
          expired: cardStats.expired
        },
        users: {
          total: userStats.total,
          today_new: userStats.today_new
        },
        products: {
          total: productStats.total,
          active: productStats.active,
          low_stock: productStats.low_stock
        },
        recent_orders: recentOrders,
        top_products: topProducts
      };
    } catch (error) {
      logger.error('获取仪表板统计失败', { error: error.message });
      return {};
    }
  }

  // 商品管理页面
  static async products(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      const products = await Product.findAll({
        limit,
        offset
      });

      // 为每个商品添加可用卡密数量
      const productsWithStock = await Promise.all(
        products.map(async (product) => {
          const availableCount = await product.getAvailableCardCount();
          const productData = product.toJSON();
          productData.available_cards = availableCount;
          return productData;
        })
      );

      // 获取分类列表
      const categories = await Category.getActiveCategories();

      // 获取总数
      const allProducts = await Product.findAll();
      const total = allProducts.length;
      const totalPages = Math.ceil(total / limit);

      res.render('admin/products', {
        title: '商品管理',
        admin: req.session.admin,
        products: productsWithStock,
        categories,
        currentPage: 'products',
        pagination: {
          page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      logger.error('显示商品管理页面失败', { error: error.message });
      res.status(500).send('服务器错误');
    }
  }

  // 订单管理页面
  static async orders(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const status = req.query.status || '';
      const limit = 20;
      const offset = (page - 1) * limit;

      let whereClause = '';
      const params = [];

      if (status) {
        whereClause = 'WHERE o.status = ?';
        params.push(status);
      }

      const orders = await databaseService.query(`
        SELECT o.*, p.name as product_name, u.username, u.telegram_id
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN users u ON o.user_id = u.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, [...params]);

      // 获取总数
      const totalResult = await databaseService.get(`
        SELECT COUNT(*) as count FROM orders o ${whereClause}
      `, params);
      
      const total = totalResult.count;
      const totalPages = Math.ceil(total / limit);

      res.render('admin/orders', {
        title: '订单管理',
        admin: req.session.admin,
        orders,
        currentPage: 'orders',
        currentStatus: status,
        pagination: {
          page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      logger.error('显示订单管理页面失败', { error: error.message });
      res.status(500).send('服务器错误');
    }
  }

  // 用户管理页面
  static async users(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || '';
      const limit = 20;
      const offset = (page - 1) * limit;

      let whereClause = '';
      const params = [];

      if (search) {
        whereClause = 'WHERE u.username LIKE ? OR u.telegram_id LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      const users = await databaseService.query(`
        SELECT u.*,
               COUNT(o.id) as order_count,
               SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        ${whereClause}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, [...params]);

      // 获取总数
      const totalResult = await databaseService.get(`
        SELECT COUNT(*) as count FROM users u ${whereClause}
      `, params);
      const total = totalResult.count;
      const totalPages = Math.ceil(total / limit);

      res.render('admin/users', {
        title: '用户管理',
        admin: req.session.admin,
        users,
        search,
        currentPage: 'users',
        pagination: {
          page,
          totalPages,
          total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      logger.error('显示用户管理页面失败', { error: error.message });
      res.status(500).send('服务器错误');
    }
  }

  // 卡密管理页面
  static async cards(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const productId = req.query.product_id || '';
      const status = req.query.status || 'available';
      const limit = 20;
      const offset = (page - 1) * limit;

      const options = {
        status,
        limit,
        offset
      };

      if (productId) {
        options.product_id = productId;
      }

      const cards = await Card.findAll(options);

      // 获取商品列表用于筛选
      const products = await Product.findAll();

      // 获取总数
      const totalOptions = { status };
      if (productId) {
        totalOptions.product_id = productId;
      }
      const allCards = await Card.findAll(totalOptions);
      const total = allCards.length;
      const totalPages = Math.ceil(total / limit);

      res.render('admin/cards', {
        title: '卡密管理',
        admin: req.session.admin,
        cards,
        products,
        currentPage: 'cards',
        currentProductId: productId,
        currentStatus: status,
        pagination: {
          page,
          totalPages,
          total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      logger.error('显示卡密管理页面失败', { error: error.message });
      res.status(500).send('服务器错误');
    }
  }

  // 统计报表页面
  static async reports(req, res) {
    try {
      const dateFrom = req.query.date_from || '';
      const dateTo = req.query.date_to || '';

      // 获取统计数据
      const stats = await AdminController.getReportStats(dateFrom, dateTo);

      res.render('admin/reports', {
        title: '统计报表',
        admin: req.session.admin,
        stats,
        currentPage: 'reports',
        dateFrom,
        dateTo
      });
    } catch (error) {
      logger.error('显示统计报表页面失败', { error: error.message });
      res.status(500).send('服务器错误');
    }
  }

  // 获取报表统计数据
  static async getReportStats(dateFrom, dateTo) {
    try {
      const options = {};
      if (dateFrom) options.date_from = dateFrom + ' 00:00:00';
      if (dateTo) options.date_to = dateTo + ' 23:59:59';

      // 订单统计
      const orderStats = await Order.getStats(options);

      // 按支付方式统计
      let paymentMethodQuery = `
        SELECT
          payment_method,
          COUNT(*) as count,
          SUM(total_amount) as total_amount
        FROM orders
        WHERE status = 'completed'
      `;
      const params = [];

      if (dateFrom) {
        paymentMethodQuery += ' AND created_at >= ?';
        params.push(dateFrom + ' 00:00:00');
      }
      if (dateTo) {
        paymentMethodQuery += ' AND created_at <= ?';
        params.push(dateTo + ' 23:59:59');
      }

      paymentMethodQuery += ' GROUP BY payment_method';

      const paymentMethodStats = await databaseService.query(paymentMethodQuery, params);

      // 每日销售统计
      let dailySalesQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as order_count,
          SUM(total_amount) as revenue
        FROM orders 
        WHERE status = 'completed'
      `;
      const dailyParams = [];

      if (dateFrom) {
        dailySalesQuery += ' AND created_at >= ?';
        dailyParams.push(dateFrom + ' 00:00:00');
      }
      if (dateTo) {
        dailySalesQuery += ' AND created_at <= ?';
        dailyParams.push(dateTo + ' 23:59:59');
      }

      dailySalesQuery += ' GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30';

      const dailySales = await databaseService.query(dailySalesQuery, dailyParams);

      return {
        orders: orderStats,
        payment_methods: paymentMethodStats,
        daily_sales: dailySales
      };
    } catch (error) {
      logger.error('获取报表统计失败', { error: error.message });
      return {};
    }
  }

  // 系统设置页面
  static async settings(req, res) {
    try {
      res.render('admin/settings', {
        title: '系统设置',
        admin: req.session.admin,
        currentPage: 'settings'
      });
    } catch (error) {
      logger.error('显示系统设置页面失败', { error: error.message });
      res.status(500).send('服务器错误');
    }
  }
}

module.exports = AdminController;
