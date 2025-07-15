const express = require('express');
const path = require('path');
const session = require('express-session');
const config = require('./config');
const logger = require('./utils/logger');

// 导入路由和服务
const webRoutes = require('./web/routes');
const apiRoutes = require('./api/routes');
const botService = require('./bot');
const databaseService = require('./database');
const Scheduler = require('./services/scheduler');
const { siteConfigMiddleware, initializeCache } = require('./middleware/siteConfig');
const errorMonitoringTask = require('./services/ErrorMonitoringTask');
const SessionDiagnostic = require('./utils/SessionDiagnostic');

// 检测Passenger环境
const isPassengerEnv = process.env.PASSENGER_ENV === 'true' || 
                       process.env.PASSENGER_BASE_URI !== undefined;

class App {
  constructor() {
    this.app = express();
    this.scheduler = new Scheduler();
    this.init();
  }

  async init() {
    try {
      // 初始化数据库
      await databaseService.init();
      logger.info('数据库初始化完成');

      // 初始化站点配置缓存
      await initializeCache();

      // 配置Express
      this.configureExpress();

      // 配置路由
      this.configureRoutes();

      // 启动Bot（如果配置了Token）
      try {
        await botService.start();
        logger.info('Telegram Bot启动完成');
      } catch (error) {
        logger.warn('Telegram Bot启动失败，将跳过Bot功能', { error: error.message });
      }

      // 启动Web服务器
      this.startServer();

      // 启动定时任务
      this.scheduler.start();
      logger.info('定时任务启动完成');

      // 启动错误监控任务
      errorMonitoringTask.start();
      logger.info('错误监控任务启动完成');

    } catch (error) {
      logger.error('应用启动失败', { error: error.message });
      process.exit(1);
    }
  }

  configureExpress() {
    // 设置视图引擎
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, '../views'));

    // 中间件
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, '../public')));

    // Session配置
    // 智能session配置
    const sessionConfig = {
      secret: config.server.sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: 'telegram-shop-session', // 自定义session名称
      cookie: {
        secure: false, // 默认false，支持HTTP和HTTPS
        httpOnly: true, // 防止XSS攻击
        maxAge: 24 * 60 * 60 * 1000, // 24小时
        sameSite: 'lax' // CSRF保护
      }
    };

    // 如果明确配置了HTTPS，则启用secure
    if (process.env.FORCE_HTTPS === 'true') {
      sessionConfig.cookie.secure = true;
    }

    this.app.use(session(sessionConfig));

    // Session诊断中间件（仅在开发和调试时启用）
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_SESSION === 'true') {
      this.app.use(SessionDiagnostic.diagnoseSession.bind(SessionDiagnostic));
    }
    this.app.use(SessionDiagnostic.adminSessionDiagnostic.bind(SessionDiagnostic));

    // 站点配置中间件
    this.app.use(siteConfigMiddleware);

    // 请求日志
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  configureRoutes() {
    // 添加路由调试端点（仅在非生产环境或启用调试时可用）
    if (config.system.nodeEnv !== 'production' || process.env.DEBUG_ROUTES === 'true') {
      this.app.get('/debug/routes', (req, res) => {
        const routes = [];
        
        // 收集Express路由
        this.app._router.stack.forEach(middleware => {
          if (middleware.route) {
            // 直接路由
            routes.push({
              path: middleware.route.path,
              method: Object.keys(middleware.route.methods)[0].toUpperCase(),
              type: 'express'
            });
          } else if (middleware.name === 'router') {
            // 路由器实例
            middleware.handle.stack.forEach(handler => {
              if (handler.route) {
                routes.push({
                  path: handler.route.path,
                  method: Object.keys(handler.route.methods)[0].toUpperCase(),
                  type: 'express'
                });
              }
            });
          }
        });
        
        // 添加Bot webhook路由信息
        if (botService.bot) {
          routes.push({
            path: '/webhook',
            method: 'POST',
            type: 'telegram-bot',
            webhookUrl: config.bot.webhookUrl || 'not-configured'
          });
        }
        
        res.json({
          routes,
          environment: {
            nodeEnv: config.system.nodeEnv,
            isPassengerEnv: process.env.PASSENGER_ENV === 'true' || 
                            process.env.PASSENGER_BASE_URI !== undefined,
            port: config.system.port
          }
        });
      });
      
      // 添加webhook测试端点
      this.app.get('/debug/webhook-test', async (req, res) => {
        try {
          if (!botService.bot) {
            return res.status(404).json({ error: 'Bot未配置' });
          }
          
          const webhookInfo = await botService.bot.telegram.getWebhookInfo();
          
          // 尝试发送测试消息
          let testMessageResult = 'N/A';
          try {
            if (config.bot.adminIds && config.bot.adminIds.length > 0) {
              const adminId = config.bot.adminIds[0];
              await botService.bot.telegram.sendMessage(
                adminId, 
                `测试消息: ${new Date().toISOString()}`
              );
              testMessageResult = '成功';
            } else {
              testMessageResult = '未配置管理员ID';
            }
          } catch (msgError) {
            testMessageResult = `错误: ${msgError.message}`;
          }
          
          res.json({
            webhook: webhookInfo,
            testMessage: testMessageResult,
            botInfo: await botService.bot.telegram.getMe()
          });
        } catch (error) {
          res.status(500).json({ 
            error: error.message,
            stack: config.system.nodeEnv !== 'production' ? error.stack : undefined
          });
        }
      });
    }

    // 健康检查路由（直接在根级别添加）
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        routes: {
          api: '/api/*',
          webhook: '/webhook',
          admin: '/admin/*'
        }
      });
    });

    // API路由
    this.app.use('/api', apiRoutes);

    // Bot Webhook路由（必须在根路径路由之前）
    const webhookHandler = botService.webhookCallback();
    logger.info('注册Webhook路由', {
      path: '/webhook',
      handlerType: typeof webhookHandler,
      botConfigured: !!botService.bot,
      botServiceType: typeof botService,
      botServiceKeys: Object.keys(botService)
    });

    this.app.use('/webhook', webhookHandler);

    // 验证webhook路由注册
    setTimeout(() => {
      const routes = [];
      this.app._router.stack.forEach((middleware) => {
        if (middleware.regexp && middleware.regexp.source.includes('webhook')) {
          routes.push({
            path: middleware.regexp.source,
            name: middleware.name || 'anonymous'
          });
        }
      });
      logger.info('Webhook路由验证', { registeredRoutes: routes });
    }, 100);

    // Web管理后台路由（使用根路径，必须在webhook之后）
    this.app.use('/', webRoutes);

    // 404处理
    this.app.use((req, res) => {
      logger.warn('404请求', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      res.status(404).json({ error: '页面不存在' });
    });

    // 错误处理
    this.app.use((err, req, res, next) => {
      logger.error('服务器错误', { error: err.message, stack: err.stack });
      res.status(500).json({ error: '服务器内部错误' });
    });
  }

  startServer() {
    const port = config.server.port;
    this.app.listen(port, () => {
      logger.info(`服务器启动成功，端口: ${port}`);
      logger.info(`管理后台: http://localhost:${port}/admin`);
      logger.info(`API文档: http://localhost:${port}/api/docs`);
      logger.info(`健康检查: http://localhost:${port}/health`);

      // 验证关键路由
      this.verifyRoutes(port);
    });
  }

  // 验证关键路由是否正确注册
  verifyRoutes(port) {
    // 在Passenger环境下跳过TCP连接检查
    if (isPassengerEnv) {
      logger.info('在Passenger环境中运行，跳过TCP连接健康检查');
      return;
    }
    
    // 原有的健康检查逻辑
    const axios = require('axios');
    const baseUrl = `http://localhost:${port}`;
    
    // 异步检查关键路由
    setTimeout(async () => {
      try {
        // 健康检查
        await axios.get(`${baseUrl}/health`);
        logger.info('✅ 健康检查 (/health) - 正常');
      } catch (error) {
        logger.error('❌ 健康检查 (/health) - 错误:', error.message);
      }
      
      // 其他路由检查...
    }, 1000);
  }
}

// 启动应用
const appInstance = new App();
global.appInstance = appInstance;

// 优雅关闭
process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在关闭服务...');

  // 停止定时任务
  if (global.appInstance && global.appInstance.scheduler) {
    global.appInstance.scheduler.stop();
  }

  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在关闭服务...');

  // 停止定时任务
  if (global.appInstance && global.appInstance.scheduler) {
    global.appInstance.scheduler.stop();
  }

  process.exit(0);
});


