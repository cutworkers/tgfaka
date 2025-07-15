const { Telegraf, Markup } = require('telegraf');
const config = require('../config');
const logger = require('../utils/logger');

// 导入Bot模块
const UserService = require('./services/userService');
const ProductService = require('./services/productService');
const OrderService = require('./services/orderService');
const MessageService = require('./services/messageService');

class BotService {
  constructor() {
    if (!config.bot.token) {
      logger.warn('Bot token未配置，Bot服务将不会启动');
      this.bot = null;
      return;
    }
    
    // 检测是否在Passenger环境中运行
    const isPassengerEnv = process.env.PASSENGER_ENV === 'true' || 
                           process.env.PASSENGER_BASE_URI !== undefined;
    
    logger.info('Bot初始化环境', {
      isPassengerEnv,
      webhookUrl: config.bot.webhookUrl,
      proxy: config.bot.proxy
    });
    
    // 初始化Bot
    if (config.bot.proxy === 'none') {
      this.bot = new Telegraf(config.bot.token);
    } else {
      const { SocksProxyAgent } = require('socks-proxy-agent');
      const agent = new SocksProxyAgent(config.bot.proxy);
      this.bot = new Telegraf(config.bot.token,{ telegram: { agent } });
    }
    
    this.userService = new UserService();
    this.productService = new ProductService();
    this.orderService = new OrderService();
    this.messageService = new MessageService();

    // 用户状态管理
    this.userStates = new Map();

    this.setupMiddleware();
    this.setupCommands();
    this.setupActions();
  }

  setupMiddleware() {
    if (!this.bot) return;

    // 用户注册中间件
    this.bot.use(async (ctx, next) => {
      if (ctx.from) {
        await this.userService.registerUser(ctx.from);
      }
      return next();
    });

    // 错误处理
    this.bot.catch((err, ctx) => {
      logger.error('Bot错误', {
        error: err.message,
        userId: ctx.from?.id,
        chatId: ctx.chat?.id
      });
      ctx.reply('抱歉，系统出现错误，请稍后再试。');
    });
  }

  setupCommands() {
    if (!this.bot) return;

    // 开始命令
    this.bot.start(async (ctx) => {
      const welcomeMessage = await this.messageService.getWelcomeMessage(ctx.from);
      const keyboard = this.getMainKeyboard();

      await ctx.reply(welcomeMessage, keyboard);
    });

    // 帮助命令
    this.bot.help(async (ctx) => {
      const helpMessage = this.messageService.getHelpMessage();
      await ctx.reply(helpMessage);
    });

    // 商品列表命令
    this.bot.command('products', async (ctx) => {
      await this.showProducts(ctx);
    });

    // 我的订单命令
    this.bot.command('orders', async (ctx) => {
      await this.showMyOrders(ctx);
    });

    // 余额查询命令
    this.bot.command('balance', async (ctx) => {
      await this.showBalance(ctx);
    });

    // 邮箱绑定命令
    this.bot.command('bind_email', async (ctx) => {
      await this.startEmailBinding(ctx);
    });

    // 查看个人信息命令
    this.bot.command('profile', async (ctx) => {
      await this.showProfile(ctx);
    });
  }

  setupActions() {
    if (!this.bot) return;

    // 主菜单按钮处理
    this.bot.hears('🛍️ 商品列表', async (ctx) => {
      await this.showProducts(ctx);
    });

    this.bot.hears('📋 我的订单', async (ctx) => {
      await this.showMyOrders(ctx);
    });

    this.bot.hears('💰 余额查询', async (ctx) => {
      await this.showBalance(ctx);
    });

    this.bot.hears('👤 个人信息', async (ctx) => {
      await this.showProfile(ctx);
    });

    this.bot.hears('❓ 帮助', async (ctx) => {
      const helpMessage = this.messageService.getHelpMessage();
      await ctx.reply(helpMessage);
    });

    // 处理文本消息（用于email绑定等状态处理）
    this.bot.on('text', async (ctx) => {
      await this.handleTextMessage(ctx);
    });

    // 回调查询处理
    this.bot.on('callback_query', async (ctx) => {
      const data = ctx.callbackQuery.data;

      try {
        if (data.startsWith('product_')) {
          await this.handleProductAction(ctx, data);
        } else if (data.startsWith('order_')) {
          await this.handleOrderAction(ctx, data);
        } else if (data.startsWith('buy_')) {
          await this.handleBuyAction(ctx, data);
        } else if (data.startsWith('payment_')) {
          await this.handlePaymentAction(ctx, data);
        } else if (data.startsWith('products_page_')) {
          await this.handleProductsPage(ctx, data);
        } else if (data.startsWith('orders_page_')) {
          await this.handleOrdersPage(ctx, data);
        } else if (data === 'main_menu') {
          await this.handleMainMenu(ctx);
        } else if (data === 'out_of_stock') {
          await ctx.answerCbQuery('商品暂时缺货，请稍后再试');
        } else {
          logger.warn('未处理的回调查询', { data, userId: ctx.from.id });
          await ctx.answerCbQuery('操作暂不支持');
        }
      } catch (error) {
        logger.error('回调查询处理失败', {
          error: error.message,
          data,
          userId: ctx.from.id
        });
        await ctx.answerCbQuery('操作失败，请稍后再试');
      }

      await ctx.answerCbQuery();
    });
  }

  // 获取主菜单键盘
  getMainKeyboard() {
    return Markup.keyboard([
      ['🛍️ 商品列表', '📋 我的订单'],
      ['💰 余额查询', '👤 个人信息'],
      ['❓ 帮助']
    ]).resize();
  }

  // 显示商品列表
  async showProducts(ctx, page = 1) {
    try {
      const products = await this.productService.getActiveProducts(page);

      if (products.length === 0) {
        await ctx.reply('暂无可用商品');
        return;
      }

      const message = this.productService.formatProductList(products);
      const keyboard = this.productService.getProductKeyboard(products, page);

      await ctx.reply(message, keyboard);
    } catch (error) {
      logger.error('显示商品列表失败', { error: error.message });
      await ctx.reply('获取商品列表失败，请稍后再试');
    }
  }

  // 显示我的订单
  async showMyOrders(ctx, page = 1) {
    try {
      const userId = await this.userService.getUserId(ctx.from.id);
      const orders = await this.orderService.getUserOrders(userId, page);

      if (orders.length === 0) {
        await ctx.reply('您还没有任何订单');
        return;
      }

      const message = this.orderService.formatOrderList(orders);
      const keyboard = this.orderService.getOrderKeyboard(orders, page);

      await ctx.reply(message, keyboard);
    } catch (error) {
      logger.error('显示订单列表失败', { error: error.message });
      await ctx.reply('获取订单列表失败，请稍后再试');
    }
  }

  // 显示余额
  async showBalance(ctx) {
    try {
      const user = await this.userService.getUser(ctx.from.id);
      const message = this.messageService.formatBalance(user);

      await ctx.reply(message);
    } catch (error) {
      logger.error('显示余额失败', { error: error.message });
      await ctx.reply('获取余额信息失败，请稍后再试');
    }
  }

  // 处理商品相关操作
  async handleProductAction(ctx, data) {
    const [action, productId, ...params] = data.split('_');

    try {
      switch (action) {
        case 'product':
          if (params[0] === 'detail') {
            await this.showProductDetail(ctx, productId);
          } else if (params[0] === 'buy') {
            await this.startBuyProcess(ctx, productId);
          }
          break;
      }
    } catch (error) {
      logger.error('处理商品操作失败', { error: error.message, data });
      await ctx.reply('操作失败，请稍后再试');
    }
  }

  // 处理订单相关操作
  async handleOrderAction(ctx, data) {
    const [action, orderId, ...params] = data.split('_');

    try {
      switch (action) {
        case 'order':
          if (params[0] === 'detail') {
            await this.showOrderDetail(ctx, orderId);
          } else if (params[0] === 'cancel') {
            await this.cancelOrder(ctx, orderId);
          }
          break;
      }
    } catch (error) {
      logger.error('处理订单操作失败', { error: error.message, data, orderId });

      // 在回调查询上下文中使用answerCbQuery
      await ctx.answerCbQuery('操作失败，请稍后再试');

      // 尝试编辑消息显示错误信息
      try {
        await ctx.editMessageText('❌ 操作失败，请稍后再试。', {
          reply_markup: {
            inline_keyboard: [[
              Markup.button.callback('📋 返回订单列表', 'orders_page_1'),
              Markup.button.callback('🏠 主菜单', 'main_menu')
            ]]
          }
        });
      } catch (editError) {
        logger.error('编辑错误消息失败', { error: editError.message });
      }
    }
  }

  // 显示商品详情
  async showProductDetail(ctx, productId) {
    try {
      const product = await this.productService.getProductById(productId);
      const message = this.productService.formatProductInfo(product, true);
      const keyboard = this.productService.getProductDetailKeyboard(product);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.error('显示商品详情失败', { error: error.message, productId });
      await ctx.reply('获取商品详情失败，请稍后再试');
    }
  }

  // 开始购买流程
  async startBuyProcess(ctx, productId, quantity = 1) {
    try {
      const userId = await this.userService.getUserId(ctx.from.id);
      const product = await this.productService.getProductById(productId);

      // 验证数量
      const validation = this.productService.validateQuantity(product, quantity);
      if (!validation.valid) {
        await ctx.answerCbQuery(validation.message);
        return;
      }

      // 显示支付方式选择
      await this.showPaymentMethods(ctx, productId, quantity);

    } catch (error) {
      logger.error('开始购买流程失败', { error: error.message, productId, quantity });
      await ctx.reply('购买失败，请稍后再试');
    }
  }

  // 显示支付方式选择
  async showPaymentMethods(ctx, productId, quantity) {
    try {
      const product = await this.productService.getProductById(productId);
      const { total_amount } = this.productService.calculateOrderAmount(product, quantity);

      let message = `💳 **选择支付方式**\n\n`;
      message += `📦 商品: ${product.name}\n`;
      message += `🔢 数量: ${quantity}张\n`;
      message += `💰 总金额: ¥${total_amount}\n\n`;
      message += `请选择您的支付方式：`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('💰 USDT支付', `payment_create_${productId}_${quantity}_usdt`),
          Markup.button.callback('💰 支付宝支付', `payment_create_${productId}_${quantity}_alipay`)
        ],
        [Markup.button.callback('⬅️ 返回商品详情', `product_${productId}_detail`)]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.error('显示支付方式失败', { error: error.message });
      await ctx.reply('显示支付方式失败，请稍后再试');
    }
  }

  // 处理购买相关操作
  async handleBuyAction(ctx, data) {
    const [action, productId, quantity] = data.split('_');

    try {
      if (action === 'buy') {
        await this.startBuyProcess(ctx, productId, parseInt(quantity));
      }
    } catch (error) {
      logger.error('处理购买操作失败', { error: error.message, data });
      await ctx.reply('操作失败，请稍后再试');
    }
  }

  // 处理支付相关操作
  async handlePaymentAction(ctx, data) {
    const [action, ...params] = data.split('_');

    try {
      if (action === 'payment') {
        if (params[0] === 'create') {
          const [, productId, quantity, paymentMethod] = params;
          await this.createPaymentOrder(ctx, productId, parseInt(quantity), paymentMethod);
        } else if (params[0] === 'check') {
          const [, orderId] = params;
          await this.checkPaymentStatus(ctx, orderId);
        }
      }
    } catch (error) {
      logger.error('处理支付操作失败', { error: error.message, data });
      await ctx.reply('支付操作失败，请稍后再试');
    }
  }

  // 创建支付订单
  async createPaymentOrder(ctx, productId, quantity, paymentMethod) {
    try {
      const userId = await this.userService.getUserId(ctx.from.id);

      // 验证用户状态
      await this.userService.validateUserStatus(ctx.from.id);

      // 创建订单
      const order = await this.orderService.createOrder(userId, productId, quantity, paymentMethod);

      // 显示支付信息
      await this.showPaymentInfo(ctx, order);

    } catch (error) {
      logger.error('创建支付订单失败', { error: error.message });
      await ctx.reply(`创建订单失败: ${error.message}`);
    }
  }

  // 显示支付信息
  async showPaymentInfo(ctx, order) {
    try {
      const message = this.messageService.formatPaymentInfo(order);

      const buttons = [];

      if (order.payment_method === 'usdt') {
        buttons.push([
          Markup.button.callback('🔄 检查支付状态', `payment_check_${order.id}`)
        ]);
      } else if (order.payment_method === 'alipay') {
        buttons.push([
          Markup.button.callback('💰 立即支付', `payment_alipay_${order.id}`)
        ]);
      }

      buttons.push([
        Markup.button.callback('❌ 取消订单', `order_${order.id}_cancel`),
        Markup.button.callback('📋 我的订单', 'orders_page_1')
      ]);

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.error('显示支付信息失败', { error: error.message });
      await ctx.reply('显示支付信息失败，请稍后再试');
    }
  }

  // 检查支付状态
  async checkPaymentStatus(ctx, orderId) {
    try {
      const order = await this.orderService.getOrderByNo(orderId);

      if (order.status === 'completed') {
        const orderDetail = await this.orderService.getOrderDetail(order.id);
        const message = this.messageService.formatCardInfo(orderDetail, orderDetail.cards);

        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              Markup.button.callback('📋 我的订单', 'orders_page_1').callback_data
            ]]
          }
        });
      } else if (order.status === 'expired') {
        await ctx.answerCbQuery('订单已过期');
      } else {
        await ctx.answerCbQuery('支付尚未确认，请稍后再试');
      }
    } catch (error) {
      logger.error('检查支付状态失败', { error: error.message });
      await ctx.answerCbQuery('检查支付状态失败');
    }
  }

  // 显示订单详情
  async showOrderDetail(ctx, orderId) {
    try {
      const orderDetail = await this.orderService.getOrderDetail(orderId);
      const message = this.orderService.formatOrderInfo(orderDetail, true);
      const keyboard = this.orderService.getOrderDetailKeyboard(orderDetail);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.error('显示订单详情失败', { error: error.message, orderId });

      // 在回调查询上下文中，应该使用answerCbQuery而不是reply
      await ctx.answerCbQuery('获取订单详情失败，请稍后再试');

      // 尝试编辑消息显示错误信息
      try {
        await ctx.editMessageText('❌ 获取订单详情失败，请稍后再试。', {
          reply_markup: {
            inline_keyboard: [[
              Markup.button.callback('📋 返回订单列表', 'orders_page_1'),
              Markup.button.callback('🏠 主菜单', 'main_menu')
            ]]
          }
        });
      } catch (editError) {
        logger.error('编辑错误消息失败', { error: editError.message });
      }
    }
  }

  // 取消订单
  async cancelOrder(ctx, orderId) {
    try {
      await this.orderService.cancelOrder(orderId, '用户取消');

      await ctx.answerCbQuery('订单已取消');
      await ctx.editMessageText('❌ 订单已取消', {
        reply_markup: {
          inline_keyboard: [[
            Markup.button.callback('📋 我的订单', 'orders_page_1').callback_data,
            Markup.button.callback('🏠 主菜单', 'main_menu').callback_data
          ]]
        }
      });
    } catch (error) {
      logger.error('取消订单失败', { error: error.message, orderId });
      await ctx.answerCbQuery(`取消失败: ${error.message}`);
    }
  }

  // 处理商品列表分页
  async handleProductsPage(ctx, data) {
    try {
      const page = parseInt(data.split('_')[2]) || 1;
      const products = await this.productService.getActiveProducts(page);

      if (products.length === 0) {
        await ctx.answerCbQuery('没有更多商品了');
        return;
      }

      const message = this.productService.formatProductList(products);
      const keyboard = this.productService.getProductKeyboard(products, page);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.error('处理商品分页失败', { error: error.message, data });
      await ctx.answerCbQuery('加载商品列表失败');
    }
  }

  // 处理订单列表分页
  async handleOrdersPage(ctx, data) {
    try {
      const page = parseInt(data.split('_')[2]) || 1;
      const userId = await this.userService.getUserId(ctx.from.id);
      const orders = await this.orderService.getUserOrders(userId, page);

      if (orders.length === 0) {
        await ctx.answerCbQuery('没有更多订单了');
        return;
      }

      const message = this.orderService.formatOrderList(orders);
      const keyboard = this.orderService.getOrderKeyboard(orders, page);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.error('处理订单分页失败', { error: error.message, data });
      await ctx.answerCbQuery('加载订单列表失败');
    }
  }

  // 处理返回主菜单
  async handleMainMenu(ctx) {
    try {
      const welcomeMessage = await this.messageService.getWelcomeMessage(ctx.from);
      const keyboard = this.getMainKeyboard();

      await ctx.editMessageText(welcomeMessage, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      logger.error('返回主菜单失败', { error: error.message });
      // 如果编辑消息失败，尝试发送新消息
      try {
        const welcomeMessage = await this.messageService.getWelcomeMessage(ctx.from);
        const keyboard = this.getMainKeyboard();
        await ctx.reply(welcomeMessage, keyboard);
      } catch (fallbackError) {
        logger.error('发送主菜单消息失败', { error: fallbackError.message });
        await ctx.answerCbQuery('返回主菜单失败');
      }
    }
  }

  // 开始邮箱绑定流程
  async startEmailBinding(ctx) {
    try {
      const user = await this.userService.getUser(ctx.from.id);

      let message = '📧 **邮箱绑定**\n\n';

      if (user.email) {
        message += `当前绑定邮箱: \`${user.email}\`\n\n`;
        message += '请发送新的邮箱地址来更新绑定，或发送 /cancel 取消操作。';
      } else {
        message += '请发送您的邮箱地址进行绑定。\n\n';
        message += '📝 **注意事项:**\n';
        message += '• 请确保邮箱地址正确\n';
        message += '• 邮箱将用于接收重要通知\n';
        message += '• 发送 /cancel 可取消操作';
      }

      // 设置用户状态为等待邮箱输入
      this.userStates.set(ctx.from.id, {
        state: 'waiting_email',
        timestamp: Date.now()
      });

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('开始邮箱绑定失败', { error: error.message });
      await ctx.reply('❌ 获取用户信息失败，请稍后再试。');
    }
  }

  // 处理文本消息
  async handleTextMessage(ctx) {
    const userId = ctx.from.id;
    const userState = this.userStates.get(userId);

    // 如果用户没有特殊状态，忽略文本消息
    if (!userState) {
      return;
    }

    // 检查状态是否过期（10分钟）
    if (Date.now() - userState.timestamp > 10 * 60 * 1000) {
      this.userStates.delete(userId);
      await ctx.reply('⏰ 操作已超时，请重新开始。');
      return;
    }

    try {
      switch (userState.state) {
        case 'waiting_email':
          await this.handleEmailInput(ctx, ctx.message.text);
          break;
        default:
          // 未知状态，清除
          this.userStates.delete(userId);
          break;
      }
    } catch (error) {
      logger.error('处理文本消息失败', {
        error: error.message,
        userId,
        state: userState.state
      });
      await ctx.reply('❌ 处理失败，请稍后再试。');
      this.userStates.delete(userId);
    }
  }

  // 处理邮箱输入
  async handleEmailInput(ctx, email) {
    const userId = ctx.from.id;

    try {
      // 检查是否是取消命令
      if (email.toLowerCase() === '/cancel') {
        this.userStates.delete(userId);
        await ctx.reply('❌ 邮箱绑定已取消。');
        return;
      }

      // 更新用户邮箱
      await this.userService.updateEmail(userId, email);

      // 清除用户状态
      this.userStates.delete(userId);

      // 发送成功消息
      let message = '✅ **邮箱绑定成功！**\n\n';
      message += `📧 绑定邮箱: \`${email}\`\n\n`;
      message += '您现在可以通过此邮箱接收重要通知。';

      await ctx.reply(message, { parse_mode: 'Markdown' });

      // 记录操作日志
      await this.userService.logUserAction(userId, 'bind_email', { email });

    } catch (error) {
      logger.error('处理邮箱输入失败', { error: error.message, userId, email });

      if (error.message === '邮箱格式不正确') {
        await ctx.reply('❌ 邮箱格式不正确，请重新输入有效的邮箱地址。\n\n发送 /cancel 可取消操作。');
      } else {
        await ctx.reply('❌ 邮箱绑定失败，请稍后再试。');
        this.userStates.delete(userId);
      }
    }
  }

  // 显示个人信息
  async showProfile(ctx) {
    try {
      const user = await this.userService.getUser(ctx.from.id);
      const stats = await user.getStats();

      let message = '👤 **个人信息**\n\n';
      message += `🆔 用户ID: \`${user.telegram_id}\`\n`;

      if (user.username) {
        message += `👤 用户名: @${user.username}\n`;
      }

      const displayName = this.userService.getUserDisplayName(ctx.from);
      message += `📝 昵称: ${displayName}\n`;

      if (user.email) {
        message += `📧 邮箱: \`${user.email}\`\n`;
      } else {
        message += `📧 邮箱: 未绑定\n`;
      }

      message += `💰 余额: ¥${user.balance}\n`;
      message += `💳 总消费: ¥${stats.total_spent || 0}\n`;
      message += `📦 订单数: ${stats.total_orders || 0}笔\n`;
      message += `📅 注册时间: ${this.formatDate(user.created_at)}\n\n`;

      message += '💡 **可用命令:**\n';
      message += '• /bind_email - 绑定邮箱\n';
      message += '• /balance - 查看余额\n';
      message += '• /orders - 我的订单';

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('显示个人信息失败', { error: error.message });
      await ctx.reply('❌ 获取个人信息失败，请稍后再试。');
    }
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

  async start() {
    if (!this.bot) {
      logger.warn('Bot未初始化，跳过启动');
      return;
    }

    try {
      // 检测是否在Passenger环境中运行
      const isPassengerEnv = process.env.PASSENGER_ENV === 'true' || 
                             process.env.PASSENGER_BASE_URI !== undefined;
      
      // 确保webhook URL已配置
      if (!config.bot.webhookUrl) {
        logger.error('Bot webhook URL未配置，无法启动webhook模式');
        if (isPassengerEnv) {
          logger.error('在Passenger环境中运行需要配置webhook URL');
          return;
        }
      }
      
      if ((config.system.nodeEnv === 'production' || isPassengerEnv) && config.bot.webhookUrl) {
        // 生产环境或Passenger环境使用Webhook
        await this.bot.telegram.setWebhook(config.bot.webhookUrl);
        logger.info('Bot Webhook设置成功', { 
          url: config.bot.webhookUrl,
          isPassengerEnv
        });
      } else {
        // 开发环境使用长轮询
        await this.bot.launch();
        logger.info('Bot长轮询启动成功');
      }
    } catch (error) {
      logger.error('Bot启动失败', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  webhookCallback() {
    if (!this.bot) {
      logger.warn('Bot未配置，webhook将返回404');
      return (req, res) => {
        logger.warn('Webhook请求但Bot未配置', {
          method: req.method,
          url: req.url,
          ip: req.ip,
          headers: req.headers
        });
        res.status(404).json({ error: 'Bot未配置' });
      };
    }

    logger.info('Bot webhook回调已配置', {
      botExists: !!this.bot,
      botToken: this.bot.token ? `${this.bot.token.substring(0, 10)}...` : 'none',
      isPassengerEnv: process.env.PASSENGER_ENV === 'true' || 
                      process.env.PASSENGER_BASE_URI !== undefined
    });

    // 创建webhook回调
    const originalCallback = this.bot.webhookCallback();

    return (req, res, next) => {
      logger.debug('Webhook请求接收', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        contentType: req.get('Content-Type'),
        bodySize: req.body ? JSON.stringify(req.body).length : 0
      });

      try {
        return originalCallback(req, res, next);
      } catch (error) {
        logger.error('Webhook处理错误', {
          error: error.message,
          stack: error.stack,
          method: req.method,
          url: req.url
        });
        res.status(500).json({ error: 'Webhook处理失败' });
      }
    };
  }

  async stop() {
    if (this.bot) {
      this.bot.stop('SIGINT');
      logger.info('Bot已停止');
    }
  }
}

module.exports = new BotService();

