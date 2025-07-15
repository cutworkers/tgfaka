const { Markup } = require('telegraf');
const Order = require('../../database/models/Order');
const Card = require('../../database/models/Card');
const Product = require('../../database/models/Product');
const User = require('../../database/models/User');
const logger = require('../../utils/logger');
const config = require('../../config');

class OrderService {
  // 创建订单
  async createOrder(userId, productId, quantity, paymentMethod) {
    try {
      // 获取商品信息
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('商品不存在');
      }

      // 检查库存
      const availableCards = await Card.findAvailableByProductId(productId, quantity);
      if (availableCards.length < quantity) {
        throw new Error('库存不足');
      }

      // 计算金额
      const unitPrice = product.price;
      const totalAmount = unitPrice * quantity;

      // 创建订单
      const orderData = {
        user_id: userId,
        product_id: productId,
        quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        timeout_minutes: config.system.orderTimeoutMinutes || 30
      };

      // 根据支付方式设置支付信息
      if (paymentMethod === 'usdt') {
        orderData.payment_address = config.usdt.walletAddress;
        orderData.payment_amount = this.convertToUSDT(totalAmount);
      }

      const order = await Order.create(orderData);

      logger.info('订单创建成功', {
        orderId: order.id,
        orderNo: order.order_no,
        userId,
        productId,
        quantity,
        totalAmount
      });

      return order;
    } catch (error) {
      logger.error('创建订单失败', {
        error: error.message,
        userId,
        productId,
        quantity,
        paymentMethod
      });
      throw error;
    }
  }

  // 获取用户订单列表
  async getUserOrders(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      return await Order.findByUserId(userId, {
        limit,
        offset
      });
    } catch (error) {
      logger.error('获取用户订单失败', { error: error.message, userId });
      throw error;
    }
  }

  // 根据订单号获取订单
  async getOrderByNo(orderNo) {
    try {
      const order = await Order.findByOrderNo(orderNo);
      if (!order) {
        throw new Error('订单不存在');
      }
      return order;
    } catch (error) {
      logger.error('获取订单失败', { error: error.message, orderNo });
      throw error;
    }
  }

  // 支付订单
  async payOrder(orderId, paymentData = {}) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('订单不存在');
      }

      if (order.status !== 'pending') {
        throw new Error('订单状态不正确');
      }

      if (order.isExpired()) {
        await order.markAsExpired();
        throw new Error('订单已过期');
      }

      // 标记为已支付
      await order.markAsPaid(paymentData);

      // 分配卡密
      await this.assignCardsToOrder(order);

      // 标记为已完成
      await order.markAsCompleted();

      // 更新用户统计
      const user = await User.findById(order.user_id);
      if (user) {
        await user.addSpent(order.total_amount);
      }

      logger.info('订单支付成功', {
        orderId: order.id,
        orderNo: order.order_no,
        amount: order.total_amount
      });

      return order;
    } catch (error) {
      logger.error('订单支付失败', {
        error: error.message,
        orderId,
        paymentData
      });
      throw error;
    }
  }

  // 为订单分配卡密
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

  // 取消订单
  async cancelOrder(orderId, reason = '用户取消') {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('订单不存在');
      }

      if (order.status !== 'pending') {
        throw new Error('只能取消待支付的订单');
      }

      await order.markAsCancelled(reason);

      logger.info('订单取消成功', {
        orderId: order.id,
        orderNo: order.order_no,
        reason
      });

      return order;
    } catch (error) {
      logger.error('取消订单失败', {
        error: error.message,
        orderId,
        reason
      });
      throw error;
    }
  }

  // 获取订单详情（包含卡密）
  async getOrderDetail(orderId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('订单不存在');
      }

      const orderData = order.toJSON();

      // 获取商品信息
      try {
        const product = await Product.findById(order.product_id);
        if (product) {
          orderData.product_name = product.name;
          orderData.product_description = product.description;
        } else {
          orderData.product_name = '商品已下架';
        }
      } catch (productError) {
        logger.warn('获取订单商品信息失败', {
          error: productError.message,
          orderId,
          productId: order.product_id
        });
        orderData.product_name = '未知商品';
      }

      // 如果订单已完成，获取卡密信息
      if (order.status === 'completed') {
        try {
          orderData.cards = await order.getCards();
        } catch (cardError) {
          logger.warn('获取订单卡密信息失败', {
            error: cardError.message,
            orderId
          });
          orderData.cards = [];
        }
      }

      return orderData;
    } catch (error) {
      logger.error('获取订单详情失败', { error: error.message, orderId });
      throw error;
    }
  }

  // 生成订单列表键盘
  getOrderKeyboard(orders, page = 1) {
    const buttons = [];

    // 订单按钮
    orders.forEach(order => {
      const statusEmoji = this.getStatusEmoji(order.status);
      buttons.push([
        Markup.button.callback(
          `${statusEmoji} ${order.order_no} - ¥${order.total_amount}`,
          `order_${order.id}_detail`
        )
      ]);
    });

    // 分页按钮
    const paginationRow = [];
    if (page > 1) {
      paginationRow.push(Markup.button.callback('⬅️ 上一页', `orders_page_${page - 1}`));
    }
    if (orders.length === 10) {
      paginationRow.push(Markup.button.callback('下一页 ➡️', `orders_page_${page + 1}`));
    }
    
    if (paginationRow.length > 0) {
      buttons.push(paginationRow);
    }

    // 返回主菜单按钮
    buttons.push([Markup.button.callback('🏠 返回主菜单', 'main_menu')]);

    return Markup.inlineKeyboard(buttons);
  }

  // 生成订单详情键盘
  getOrderDetailKeyboard(order) {
    const buttons = [];

    // 检查订单是否过期
    const isExpired = order.expire_at && new Date(order.expire_at) < new Date();

    if (order.status === 'pending' && !isExpired) {
      // 支付按钮
      if (order.payment_method === 'usdt') {
        buttons.push([
          Markup.button.callback('💰 继续USDT支付', `payment_create_${order.product_id}_${order.quantity}_usdt`)
        ]);
      } else if (order.payment_method === 'alipay') {
        buttons.push([
          Markup.button.callback('💰 继续支付宝支付', `payment_create_${order.product_id}_${order.quantity}_alipay`)
        ]);
      }

      // 检查支付状态按钮
      buttons.push([
        Markup.button.callback('🔄 检查支付状态', `payment_check_${order.order_no}`)
      ]);

      // 取消订单按钮
      buttons.push([
        Markup.button.callback('❌ 取消订单', `order_${order.id}_cancel`)
      ]);
    } else if (order.status === 'pending' && isExpired) {
      // 订单已过期，显示重新下单按钮
      buttons.push([
        Markup.button.callback('🔄 重新下单', `product_${order.product_id}_buy`)
      ]);
    }

    // 返回按钮
    buttons.push([
      Markup.button.callback('⬅️ 返回订单列表', 'orders_page_1'),
      Markup.button.callback('🏠 主菜单', 'main_menu')
    ]);

    return Markup.inlineKeyboard(buttons);
  }

  // 格式化订单信息
  formatOrderInfo(order, detailed = false) {
    const statusEmoji = this.getStatusEmoji(order.status);
    let statusText = this.getStatusText(order.status);

    // 检查订单是否过期
    const isExpired = order.expire_at && new Date(order.expire_at) < new Date();
    if (order.status === 'pending' && isExpired) {
      statusText = '已过期';
    }

    let message = `📋 **订单详情**\n\n`;
    message += `🆔 订单号: \`${order.order_no}\`\n`;
    message += `📦 商品: ${order.product_name || '未知商品'}\n`;
    message += `🔢 数量: ${order.quantity}张\n`;
    message += `💰 金额: ¥${order.total_amount}\n`;
    message += `💳 支付方式: ${this.getPaymentMethodText(order.payment_method)}\n`;
    message += `${statusEmoji} 状态: ${statusText}\n`;
    message += `📅 创建时间: ${this.formatDate(order.created_at)}\n`;

    if (detailed) {
      if (order.payment_address) {
        message += `\n💰 支付地址: \`${order.payment_address}\`\n`;
      }
      
      if (order.payment_amount) {
        message += `💵 支付金额: ${order.payment_amount} USDT\n`;
      }

      if (order.expire_at && order.status === 'pending') {
        if (isExpired) {
          message += `⏰ 已于 ${this.formatDate(order.expire_at)} 过期\n`;
        } else {
          message += `⏰ 过期时间: ${this.formatDate(order.expire_at)}\n`;
        }
      }

      if (order.paid_at) {
        message += `✅ 支付时间: ${this.formatDate(order.paid_at)}\n`;
      }

      if (order.completed_at) {
        message += `🎉 完成时间: ${this.formatDate(order.completed_at)}\n`;
      }

      // 显示卡密信息
      if (order.cards && order.cards.length > 0) {
        message += `\n🎫 **卡密信息:**\n`;
        order.cards.forEach((card, index) => {
          message += `${index + 1}. 卡号: \`${card.card_number}\`\n`;
          message += `   密码: \`${card.card_password}\`\n`;
        });
      }
    }

    return message;
  }

  // 格式化订单列表
  formatOrderList(orders) {
    if (orders.length === 0) {
      return '您还没有任何订单';
    }

    let message = '📋 **我的订单**\n\n';
    
    orders.forEach((order, index) => {
      const statusEmoji = this.getStatusEmoji(order.status);
      message += `${index + 1}. ${statusEmoji} ${order.order_no}\n`;
      message += `   📦 ${order.product_name} x${order.quantity}\n`;
      message += `   💰 ¥${order.total_amount}\n`;
      message += `   📅 ${this.formatDate(order.created_at)}\n\n`;
    });

    message += '点击下方按钮查看订单详情 👇';
    
    return message;
  }

  // 获取状态表情符号
  getStatusEmoji(status) {
    const statusEmojis = {
      pending: '⏳',
      paid: '💰',
      completed: '✅',
      cancelled: '❌',
      expired: '⏰'
    };
    return statusEmojis[status] || '❓';
  }

  // 获取状态文本
  getStatusText(status) {
    const statusTexts = {
      pending: '待支付',
      paid: '已支付',
      completed: '已完成',
      cancelled: '已取消',
      expired: '已过期'
    };
    return statusTexts[status] || '未知状态';
  }

  // 获取支付方式文本
  getPaymentMethodText(method) {
    const methodTexts = {
      usdt: 'USDT',
      alipay: '支付宝'
    };
    return methodTexts[method] || method;
  }

  // 格式化日期
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 转换为USDT金额
  convertToUSDT(cnyAmount) {
    const rate = parseFloat(config.usdt.rate || 6.5);
    return (cnyAmount / rate).toFixed(6);
  }
}

module.exports = OrderService;
