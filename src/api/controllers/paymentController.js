const USDTService = require('../../services/payment/usdtService');
const AlipayService = require('../../services/payment/alipayService');
const Order = require('../../database/models/Order');
const databaseService = require('../../database');
const logger = require('../../utils/logger');

class PaymentController {
  constructor() {
    this.usdtService = new USDTService();
    this.alipayService = new AlipayService();
  }

  // 创建USDT支付
  static async createUSDTPayment(req, res) {
    try {
      const { order_id } = req.body;

      if (!order_id) {
        return res.status(400).json({
          success: false,
          message: '订单ID为必填字段'
        });
      }

      const order = await Order.findById(order_id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '订单状态不正确'
        });
      }

      if (order.isExpired()) {
        await order.markAsExpired();
        return res.status(400).json({
          success: false,
          message: '订单已过期'
        });
      }

      const usdtService = new USDTService();
      const usdtAmount = await usdtService.convertCNYToUSDT(order.total_amount);

      // 更新订单支付信息
      await order.update({
        payment_address: usdtService.walletAddress,
        payment_amount: usdtAmount
      });

      res.json({
        success: true,
        data: {
          order_no: order.order_no,
          payment_address: usdtService.walletAddress,
          payment_amount: usdtAmount,
          network: 'TRC20',
          expire_at: order.expire_at
        }
      });

    } catch (error) {
      logger.error('创建USDT支付失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '创建USDT支付失败',
        error: error.message
      });
    }
  }

  // 创建支付宝支付
  static async createAlipayPayment(req, res) {
    try {
      const { order_id } = req.body;

      if (!order_id) {
        return res.status(400).json({
          success: false,
          message: '订单ID为必填字段'
        });
      }

      const order = await Order.findById(order_id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '订单状态不正确'
        });
      }

      if (order.isExpired()) {
        await order.markAsExpired();
        return res.status(400).json({
          success: false,
          message: '订单已过期'
        });
      }

      const alipayService = new AlipayService();
      const paymentResult = await alipayService.createPayment(order);

      if (paymentResult.success) {
        res.json({
          success: true,
          data: {
            order_no: order.order_no,
            qr_code: paymentResult.qr_code,
            expire_at: order.expire_at
          }
        });
      } else {
        throw new Error('创建支付宝支付失败');
      }

    } catch (error) {
      logger.error('创建支付宝支付失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '创建支付宝支付失败',
        error: error.message
      });
    }
  }

  // 支付宝回调处理
  static async alipayNotify(req, res) {
    try {
      const alipayService = new AlipayService();
      const result = await alipayService.handleNotify(req.body);

      if (result.success) {
        res.send('success');
      } else {
        res.send('fail');
      }

    } catch (error) {
      logger.error('处理支付宝回调失败', { error: error.message });
      res.send('fail');
    }
  }

  // 查询支付状态
  static async queryPaymentStatus(req, res) {
    try {
      const { order_no, payment_method } = req.params;

      const order = await Order.findByOrderNo(order_no);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      let paymentStatus = {
        order_no: order.order_no,
        status: order.status,
        payment_method: order.payment_method,
        total_amount: order.total_amount,
        created_at: order.created_at,
        paid_at: order.paid_at,
        completed_at: order.completed_at
      };

      if (payment_method === 'alipay' && order.payment_method === 'alipay') {
        const alipayService = new AlipayService();
        const alipayResult = await alipayService.queryPayment(order_no);
        
        if (alipayResult.success) {
          paymentStatus.alipay_status = alipayResult.trade_status;
          paymentStatus.alipay_trade_no = alipayResult.trade_no;
        }
      }

      res.json({
        success: true,
        data: paymentStatus
      });

    } catch (error) {
      logger.error('查询支付状态失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '查询支付状态失败',
        error: error.message
      });
    }
  }

  // 手动确认支付（管理员功能）
  static async confirmPayment(req, res) {
    try {
      const { order_id } = req.body;

      const order = await Order.findById(order_id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '只能确认待支付的订单'
        });
      }

      // 标记为已支付
      await order.markAsPaid({
        txid: 'MANUAL_CONFIRM',
        confirmed_by: 'admin'
      });

      // 分配卡密并完成订单
      const orderService = new (require('../../services/orderService'))();
      await orderService.assignCardsToOrder(order);
      await order.markAsCompleted();

      logger.info('手动确认支付成功', {
        orderId: order.id,
        orderNo: order.order_no
      });

      res.json({
        success: true,
        message: '支付确认成功',
        data: order.toJSON()
      });

    } catch (error) {
      logger.error('手动确认支付失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '确认支付失败',
        error: error.message
      });
    }
  }

  // 获取支付统计
  static async getPaymentStats(req, res) {
    try {
      const { date_from, date_to } = req.query;

      const stats = await Order.getStats({
        date_from,
        date_to
      });

      // 按支付方式分组统计
      const paymentMethodStats = await databaseService.query(`
        SELECT
          payment_method,
          COUNT(*) as count,
          SUM(total_amount) as total_amount,
          AVG(total_amount) as avg_amount
        FROM orders
        WHERE status = 'completed'
        ${date_from ? 'AND created_at >= ?' : ''}
        ${date_to ? 'AND created_at <= ?' : ''}
        GROUP BY payment_method
      `, [date_from, date_to].filter(Boolean));

      res.json({
        success: true,
        data: {
          overall_stats: stats,
          payment_method_stats: paymentMethodStats
        }
      });

    } catch (error) {
      logger.error('获取支付统计失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取支付统计失败',
        error: error.message
      });
    }
  }

  // 获取USDT汇率
  static async getUSDTRate(req, res) {
    try {
      const usdtService = new USDTService();
      const rate = await usdtService.getUSDTRate();

      res.json({
        success: true,
        data: {
          rate,
          currency: 'CNY',
          updated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('获取USDT汇率失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取USDT汇率失败',
        error: error.message
      });
    }
  }
}

module.exports = PaymentController;
