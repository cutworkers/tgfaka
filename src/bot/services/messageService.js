const config = require('../../config');

class MessageService {
  // 获取欢迎消息
  async getWelcomeMessage(telegramUser) {
    const displayName = this.getUserDisplayName(telegramUser);
    
    let message = `🎉 欢迎使用卡密销售Bot，${displayName}！\n\n`;
    message += `🛍️ 这里有各种游戏充值卡、软件激活码等商品\n`;
    message += `💰 支持USDT和支付宝支付\n`;
    message += `🚀 自动发货，即买即得\n\n`;
    message += `请选择您需要的功能：`;
    
    return message;
  }

  // 获取帮助消息
  getHelpMessage() {
    let message = `❓ **使用帮助**\n\n`;
    message += `🛍️ **购买流程：**\n`;
    message += `1. 点击"商品列表"浏览商品\n`;
    message += `2. 选择商品并确认购买\n`;
    message += `3. 选择支付方式完成支付\n`;
    message += `4. 系统自动发货\n\n`;
    
    message += `💰 **支付方式：**\n`;
    message += `• USDT (TRC20)\n`;
    message += `• 支付宝\n\n`;
    
    message += `📋 **常用命令：**\n`;
    message += `/start - 开始使用\n`;
    message += `/products - 查看商品\n`;
    message += `/orders - 我的订单\n`;
    message += `/balance - 余额查询\n`;
    message += `/help - 显示帮助\n\n`;
    
    message += `❗ **注意事项：**\n`;
    message += `• 订单有效期为30分钟\n`;
    message += `• 卡密一经发出不支持退换\n`;
    message += `• 如有问题请联系客服\n\n`;
    
    message += `📞 **联系客服：** @your_support_username`;
    
    return message;
  }

  // 格式化余额信息
  formatBalance(user) {
    let message = `💰 **账户信息**\n\n`;
    message += `👤 用户: ${this.getUserDisplayName(user)}\n`;
    message += `💵 余额: ¥${user.balance}\n`;
    message += `💸 累计消费: ¥${user.total_spent}\n`;
    message += `📦 订单数量: ${user.order_count}笔\n`;
    message += `📅 注册时间: ${this.formatDate(user.created_at)}\n\n`;
    
    if (user.balance > 0) {
      message += `💡 您可以使用余额直接购买商品`;
    } else {
      message += `💡 余额不足时可选择在线支付`;
    }
    
    return message;
  }

  // 格式化商品列表
  formatProductList(products) {
    if (products.length === 0) {
      return '😔 暂无可用商品，请稍后再来看看';
    }

    let message = `🛍️ **热门商品**\n\n`;
    
    products.forEach((product, index) => {
      message += `${index + 1}. **${product.name}**\n`;
      message += `   💰 ¥${product.price}`;
      
      if (product.original_price && product.original_price > product.price) {
        const discount = Math.round((1 - product.price / product.original_price) * 100);
        message += ` ~~¥${product.original_price}~~ 🔥${discount}%OFF`;
      }
      
      message += `\n   📦 库存: ${product.available_cards}张`;
      
      if (product.description) {
        const shortDesc = product.description.length > 30 
          ? product.description.substring(0, 30) + '...'
          : product.description;
        message += `\n   📝 ${shortDesc}`;
      }
      
      message += `\n\n`;
    });

    message += `👆 点击上方按钮查看详情并购买`;
    
    return message;
  }

  // 格式化订单列表
  formatOrderList(orders) {
    if (orders.length === 0) {
      return '📋 您还没有任何订单\n\n💡 点击"商品列表"开始购买吧！';
    }

    let message = `📋 **我的订单** (最近${orders.length}笔)\n\n`;
    
    orders.forEach((order, index) => {
      const statusEmoji = this.getOrderStatusEmoji(order.status);
      const statusText = this.getOrderStatusText(order.status);
      
      message += `${index + 1}. ${statusEmoji} **${order.order_no}**\n`;
      message += `   📦 ${order.product_name} x${order.quantity}\n`;
      message += `   💰 ¥${order.total_amount} | ${statusText}\n`;
      message += `   📅 ${this.formatDate(order.created_at)}\n\n`;
    });

    message += `👆 点击订单号查看详情`;
    
    return message;
  }

  // 格式化支付信息
  formatPaymentInfo(order) {
    let message = `💳 **支付信息**\n\n`;
    message += `🆔 订单号: \`${order.order_no}\`\n`;
    message += `📦 商品: ${order.product_name} x${order.quantity}\n`;
    message += `💰 金额: ¥${order.total_amount}\n\n`;

    if (order.payment_method === 'usdt') {
      message += `💰 **USDT支付 (TRC20)**\n`;
      message += `📍 收款地址:\n\`${order.payment_address}\`\n\n`;
      message += `💵 支付金额: **${order.payment_amount} USDT**\n\n`;
      message += `⚠️ **重要提醒:**\n`;
      message += `• 请使用TRC20网络转账\n`;
      message += `• 请准确转账上述金额\n`;
      message += `• 转账后系统将自动确认\n`;
      message += `• 确认后立即自动发货\n\n`;
    } else if (order.payment_method === 'alipay') {
      message += `💰 **支付宝支付**\n`;
      message += `💵 支付金额: **¥${order.total_amount}**\n\n`;
      message += `⚠️ **支付说明:**\n`;
      message += `• 点击下方支付按钮\n`;
      message += `• 使用支付宝扫码支付\n`;
      message += `• 支付成功后自动发货\n\n`;
    }

    const expireTime = new Date(order.expire_at);
    const now = new Date();
    const remainingMinutes = Math.max(0, Math.floor((expireTime - now) / 60000));
    
    message += `⏰ 订单将在 **${remainingMinutes}分钟** 后过期`;
    
    return message;
  }

  // 格式化卡密信息
  formatCardInfo(order, cards) {
    let message = `🎫 **卡密信息**\n\n`;
    message += `🆔 订单号: \`${order.order_no}\`\n`;
    message += `📦 商品: ${order.product_name}\n`;
    message += `🔢 数量: ${cards.length}张\n`;
    message += `📅 购买时间: ${this.formatDate(order.completed_at)}\n\n`;

    message += `💳 **卡密详情:**\n`;
    cards.forEach((card, index) => {
      message += `\n**第${index + 1}张:**\n`;
      message += `🔢 卡号: \`${card.card_number}\`\n`;
      message += `🔐 密码: \`${card.card_password}\`\n`;
    });

    message += `\n⚠️ **重要提醒:**\n`;
    message += `• 请妥善保存卡密信息\n`;
    message += `• 卡密一经发出不支持退换\n`;
    message += `• 如有使用问题请联系客服\n`;
    message += `• 建议截图保存备用`;

    return message;
  }

  // 格式化错误消息
  formatErrorMessage(error, context = '') {
    let message = `❌ **操作失败**\n\n`;
    
    if (context) {
      message += `📍 操作: ${context}\n`;
    }
    
    message += `💬 错误信息: ${error}\n\n`;
    message += `💡 建议:\n`;
    message += `• 检查网络连接\n`;
    message += `• 稍后重试\n`;
    message += `• 联系客服获取帮助`;
    
    return message;
  }

  // 获取用户显示名称
  getUserDisplayName(user) {
    if (user.username) {
      return `@${user.username}`;
    }
    
    const parts = [];
    if (user.first_name) {
      parts.push(user.first_name);
    }
    if (user.last_name) {
      parts.push(user.last_name);
    }
    
    return parts.length > 0 ? parts.join(' ') : `用户${user.id}`;
  }

  // 获取订单状态表情符号
  getOrderStatusEmoji(status) {
    const statusEmojis = {
      pending: '⏳',
      paid: '💰',
      completed: '✅',
      cancelled: '❌',
      expired: '⏰'
    };
    return statusEmojis[status] || '❓';
  }

  // 获取订单状态文本
  getOrderStatusText(status) {
    const statusTexts = {
      pending: '待支付',
      paid: '已支付',
      completed: '已完成',
      cancelled: '已取消',
      expired: '已过期'
    };
    return statusTexts[status] || '未知状态';
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

  // 生成随机客服问候语
  getRandomGreeting() {
    const greetings = [
      '您好！有什么可以帮助您的吗？',
      '欢迎咨询！请问有什么问题？',
      '您好！我是客服，很高兴为您服务',
      '有什么疑问请随时告诉我'
    ];
    
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
}

module.exports = MessageService;
