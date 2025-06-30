const Order = require('../../database/models/Order');
const Product = require('../../database/models/Product');
const User = require('../../database/models/User');
const logger = require('../../utils/logger');

class OrderController {
  // 获取订单列表
  static async getOrders(req, res) {
    try {
      const {
        status,
        user_id,
        product_id,
        product_name,
        payment_method,
        date_from,
        date_to,
        page = 1,
        limit = 20
      } = req.query;

      const offset = (page - 1) * limit;
      
      const options = {
        status,
        user_id,
        product_id,
        product_name,
        payment_method,
        date_from,
        date_to,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const orders = await Order.findAll(options);
      
      // 获取总数
      const totalOptions = { status, user_id, product_id, payment_method, date_from, date_to };
      const allOrders = await Order.findAll(totalOptions);
      const total = allOrders.length;

      res.json({
        success: true,
        data: {
          orders: orders.map(order => order.toJSON()),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('获取订单列表失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取订单列表失败',
        error: error.message
      });
    }
  }

  // 获取单个订单详情
  static async getOrder(req, res) {
    try {
      const { id } = req.params;
      const order = await Order.findById(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      const orderData = order.toJSON();
      
      // 如果订单已完成，获取卡密信息
      if (order.status === 'completed') {
        orderData.cards = await order.getCards();
      }

      res.json({
        success: true,
        data: orderData
      });

    } catch (error) {
      logger.error('获取订单详情失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取订单详情失败',
        error: error.message
      });
    }
  }

  // 根据订单号获取订单
  static async getOrderByNo(req, res) {
    try {
      const { order_no } = req.params;
      const order = await Order.findByOrderNo(order_no);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      const orderData = order.toJSON();
      
      // 如果订单已完成，获取卡密信息
      if (order.status === 'completed') {
        orderData.cards = await order.getCards();
      }

      res.json({
        success: true,
        data: orderData
      });

    } catch (error) {
      logger.error('根据订单号获取订单失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取订单失败',
        error: error.message
      });
    }
  }

  // 创建订单
  static async createOrder(req, res) {
    try {
      const { user_id, product_id, quantity = 1, payment_method } = req.body;

      // 验证必填字段
      if (!user_id || !product_id || !payment_method) {
        return res.status(400).json({
          success: false,
          message: '用户ID、商品ID和支付方式为必填字段'
        });
      }

      // 验证商品存在
      const product = await Product.findById(product_id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      if (product.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: '商品已下架'
        });
      }

      // 验证用户存在
      const user = await User.findById(user_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 检查库存
      const availableCount = await product.getAvailableCardCount();
      if (availableCount < quantity) {
        return res.status(400).json({
          success: false,
          message: '库存不足'
        });
      }

      // 计算金额
      const unitPrice = product.price;
      const totalAmount = unitPrice * quantity;

      // 创建订单
      const orderData = {
        user_id,
        product_id,
        quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        payment_method,
        timeout_minutes: 30
      };

      const order = await Order.create(orderData);

      logger.info('订单创建成功', {
        orderId: order.id,
        orderNo: order.order_no,
        userId: user_id,
        productId: product_id,
        quantity,
        totalAmount
      });

      res.status(201).json({
        success: true,
        data: order.toJSON(),
        message: '订单创建成功'
      });

    } catch (error) {
      logger.error('创建订单失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '创建订单失败',
        error: error.message
      });
    }
  }

  // 更新订单状态
  static async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, payment_txid, notes } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: '状态为必填字段'
        });
      }

      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      const updateData = { status };
      if (payment_txid) updateData.payment_txid = payment_txid;
      if (notes) updateData.notes = notes;

      const updatedOrder = await order.updateStatus(status, updateData);

      logger.info('订单状态更新成功', {
        orderId: id,
        oldStatus: order.status,
        newStatus: status
      });

      res.json({
        success: true,
        data: updatedOrder.toJSON(),
        message: '订单状态更新成功'
      });

    } catch (error) {
      logger.error('更新订单状态失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '更新订单状态失败',
        error: error.message
      });
    }
  }

  // 取消订单
  static async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const { reason = '用户取消' } = req.body;

      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '只能取消待支付的订单'
        });
      }

      const cancelledOrder = await order.markAsCancelled(reason);

      logger.info('订单取消成功', {
        orderId: id,
        reason
      });

      res.json({
        success: true,
        data: cancelledOrder.toJSON(),
        message: '订单取消成功'
      });

    } catch (error) {
      logger.error('取消订单失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '取消订单失败',
        error: error.message
      });
    }
  }

  // 获取订单统计
  static async getOrderStats(req, res) {
    try {
      const { user_id, date_from, date_to } = req.query;

      const options = {};
      if (user_id) options.user_id = user_id;
      if (date_from) options.date_from = date_from;
      if (date_to) options.date_to = date_to;

      const stats = await Order.getStats(options);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('获取订单统计失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取订单统计失败',
        error: error.message
      });
    }
  }

  // 获取用户订单
  static async getUserOrders(req, res) {
    try {
      const { user_id } = req.params;
      const { status, page = 1, limit = 10 } = req.query;

      const offset = (page - 1) * limit;
      
      const options = {
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const orders = await Order.findByUserId(user_id, options);

      res.json({
        success: true,
        data: {
          orders: orders.map(order => order.toJSON()),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      logger.error('获取用户订单失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取用户订单失败',
        error: error.message
      });
    }
  }
}

module.exports = OrderController;
