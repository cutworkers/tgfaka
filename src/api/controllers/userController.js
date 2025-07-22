const User = require('../../database/models/User');
const Order = require('../../database/models/Order');
const logger = require('../../utils/logger');

class UserController {
  // 获取用户详情及其订单信息
  static async getUserDetails(req, res) {
    try {
      const { id } = req.params;
      const { include_orders = 'true', orders_limit = 10, orders_page = 1 } = req.query;

      // 查找用户
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 获取用户基本信息
      const userData = user.toJSON();

      // 获取用户统计信息
      const userStats = await user.getStats();
      userData.stats = userStats;

      // 如果需要包含订单信息
      if (include_orders === 'true') {
        const ordersOffset = (parseInt(orders_page) - 1) * parseInt(orders_limit);
        
        // 获取用户订单列表
        const orders = await Order.findByUserId(id, {
          limit: parseInt(orders_limit),
          offset: ordersOffset
        });

        // 获取订单总数
        const allOrders = await Order.findByUserId(id);
        const totalOrders = allOrders.length;

        userData.orders = {
          list: orders.map(order => order.toJSON()),
          pagination: {
            page: parseInt(orders_page),
            limit: parseInt(orders_limit),
            total: totalOrders,
            pages: Math.ceil(totalOrders / parseInt(orders_limit))
          }
        };
      }

      logger.info('获取用户详情成功', { userId: id });

      res.json({
        success: true,
        data: userData
      });

    } catch (error) {
      logger.error('获取用户详情失败', { 
        userId: req.params.id, 
        error: error.message 
      });
      res.status(500).json({
        success: false,
        message: '获取用户详情失败',
        error: error.message
      });
    }
  }

  // 获取用户列表
  static async getUsers(req, res) {
    try {
      const { 
        status, 
        telegram_id, 
        username,
        page = 1, 
        limit = 20 
      } = req.query;

      const offset = (page - 1) * limit;
      
      let query = 'SELECT * FROM users WHERE 1=1';
      const params = [];

      // 添加筛选条件
      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
      
      if (telegram_id) {
        query += ' AND telegram_id = ?';
        params.push(telegram_id);
      }
      
      if (username) {
        query += ' AND username LIKE ?';
        params.push(`%${username}%`);
      }

      // 添加排序和分页
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const users = await require('../../database/index').query(query, params);

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
      const countParams = [];
      
      if (status) {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }
      
      if (telegram_id) {
        countQuery += ' AND telegram_id = ?';
        countParams.push(telegram_id);
      }
      
      if (username) {
        countQuery += ' AND username LIKE ?';
        countParams.push(`%${username}%`);
      }

      const countResult = await require('../../database/index').get(countQuery, countParams);
      const total = countResult.total;

      res.json({
        success: true,
        data: {
          users: users.map(user => new User(user).toJSON()),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('获取用户列表失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取用户列表失败',
        error: error.message
      });
    }
  }

  // 更新用户信息
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // 查找用户
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 更新用户信息
      const updatedUser = await user.update(updateData);

      logger.info('用户信息更新成功', { userId: id, updateData });

      res.json({
        success: true,
        data: updatedUser.toJSON(),
        message: '用户信息更新成功'
      });

    } catch (error) {
      logger.error('更新用户信息失败', { 
        userId: req.params.id, 
        error: error.message 
      });
      res.status(500).json({
        success: false,
        message: '更新用户信息失败',
        error: error.message
      });
    }
  }

  // 获取用户统计信息
  static async getUserStats(req, res) {
    try {
      const { id } = req.params;

      // 查找用户
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 获取用户统计信息
      const stats = await user.getStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('获取用户统计失败', { 
        userId: req.params.id, 
        error: error.message 
      });
      res.status(500).json({
        success: false,
        message: '获取用户统计失败',
        error: error.message
      });
    }
  }
}

module.exports = UserController;