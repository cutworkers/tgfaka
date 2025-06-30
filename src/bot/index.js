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

    this.bot.hears('❓ 帮助', async (ctx) => {
      const helpMessage = this.messageService.getHelpMessage();
      await ctx.reply(helpMessage);
    });

    // 回调查询处理
    this.bot.on('callback_query', async (ctx) => {
      const data = ctx.callbackQuery.data;

      if (data.startsWith('product_')) {
        await this.handleProductAction(ctx, data);
      } else if (data.startsWith('order_')) {
        await this.handleOrderAction(ctx, data);
      } else if (data.startsWith('buy_')) {
        await this.handleBuyAction(ctx, data);
      } else if (data.startsWith('payment_')) {
        await this.handlePaymentAction(ctx, data);
      }

      await ctx.answerCbQuery();
    });
  }

  // 获取主菜单键盘
  getMainKeyboard() {
    return Markup.keyboard([
      ['🛍️ 商品列表', '📋 我的订单'],
      ['💰 余额查询', '❓ 帮助']
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

      const message = this.messageService.formatProductList(products);
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

      const message = this.messageService.formatOrderList(orders);
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
      logger.error('处理订单操作失败', { error: error.message, data });
      await ctx.reply('操作失败，请稍后再试');
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
      await ctx.reply('获取订单详情失败，请稍后再试');
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

  async start() {
    if (!this.bot) {
      logger.warn('Bot未初始化，跳过启动');
      return;
    }

    try {
      if (config.system.nodeEnv === 'production' && config.bot.webhookUrl) {
        // 生产环境使用Webhook
        await this.bot.telegram.setWebhook(config.bot.webhookUrl);
        logger.info('Bot Webhook设置成功', { url: config.bot.webhookUrl });
      } else {
        // 开发环境使用长轮询
        await this.bot.launch();
        logger.info('Bot长轮询启动成功');
      }
    } catch (error) {
      logger.error('Bot启动失败', { error: error.message });
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
          ip: req.ip
        });
        res.status(404).json({ error: 'Bot未配置' });
      };
    }

    logger.info('Bot webhook回调已配置');
    return this.bot.webhookCallback('/webhook');
  }

  async stop() {
    if (this.bot) {
      this.bot.stop('SIGINT');
      logger.info('Bot已停止');
    }
  }
}

module.exports = new BotService();
