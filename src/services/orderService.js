const Order = require('../database/models/Order');
const Card = require('../database/models/Card');
const Product = require('../database/models/Product');
const User = require('../database/models/User');
const logger = require('../utils/logger');

class OrderService {
  // 分配卡密给订单
  async assignCardsToOrder(order) {
    try {
      const availableCards = await Card.findAvailableByProductId(
        order.product_id,
        order.quantity
      );

      if (availableCards.length < order.quantity) {
        throw new Error('可用卡密不足');
      }

      const cardIds = availableCards.slice(0, order.quantity).map(card => card.id);
      await order.assignCards(cardIds);

      logger.info('卡密分配成功', {
        orderId: order.id,
        cardIds
      });

      return cardIds;
    } catch (error) {
      logger.error('卡密分配失败', {
        error: error.message,
        orderId: order.id
      });
      throw error;
    }
  }

  // 处理订单超时
  async handleExpiredOrders() {
    try {
      const expiredCount = await Order.updateExpiredOrders();
      
      if (expiredCount > 0) {
        logger.info('处理过期订单', { count: expiredCount });
      }
      
      return expiredCount;
    } catch (error) {
      logger.error('处理过期订单失败', { error: error.message });
      return 0;
    }
  }

  // 获取订单统计
  async getOrderStats(options = {}) {
    try {
      return await Order.getStats(options);
    } catch (error) {
      logger.error('获取订单统计失败', { error: error.message });
      throw error;
    }
  }

  // 发送订单通知
  async sendOrderNotification(order, type = 'completed') {
    try {
      // 这里可以集成邮件、短信或其他通知方式
      logger.info('发送订单通知', {
        orderId: order.id,
        type,
        userId: order.user_id
      });
    } catch (error) {
      logger.error('发送订单通知失败', {
        error: error.message,
        orderId: order.id
      });
    }
  }
}

module.exports = OrderService;
