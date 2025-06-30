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
    // 路由诊断（仅用于调试）
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_ROUTES === 'true') {
      this.app.get('/debug/routes', (req, res) => {
        const routes = [];
        this.app._router.stack.forEach((middleware) => {
          if (middleware.route) {
            routes.push({
              path: middleware.route.path,
              methods: Object.keys(middleware.route.methods)
            });
          } else if (middleware.name === 'router') {
            middleware.handle.stack.forEach((handler) => {
              if (handler.route) {
                routes.push({
                  path: handler.route.path,
                  methods: Object.keys(handler.route.methods)
                });
              }
            });
          }
        });
        res.json({ routes });
      });

      this.app.get('/debug/session', (req, res) => {
        const report = SessionDiagnostic.generateHealthReport(req);
        res.json({
          session: req.session,
          health: report,
          cookies: req.headers.cookie,
          headers: {
            host: req.get('Host'),
            protocol: req.protocol,
            secure: req.secure
          }
        });
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
    // 延迟验证，确保服务器完全启动
    setTimeout(async () => {
      const axios = require('axios');
      const baseURL = `http://localhost:${port}`;

      const routes = [
        { path: '/health', name: '健康检查' },
        { path: '/api/health', name: 'API健康检查' },
        { path: '/api/docs', name: 'API文档' }
      ];

      logger.info('开始验证关键路由...');

      for (const route of routes) {
        try {
          const response = await axios.get(`${baseURL}${route.path}`, {
            timeout: 2000,
            validateStatus: () => true
          });

          if (response.status === 200) {
            logger.info(`✅ ${route.name} (${route.path}) - 正常`);
          } else {
            logger.warn(`⚠️  ${route.name} (${route.path}) - 状态码: ${response.status}`);
          }
        } catch (error) {
          logger.error(`❌ ${route.name} (${route.path}) - 错误: ${error.message}`);
        }
      }

      // 验证Webhook路由
      try {
        const response = await axios.post(`${baseURL}/webhook`, {}, {
          timeout: 2000,
          validateStatus: () => true
        });

        if (response.status === 404 && response.data?.error === 'Bot未配置') {
          logger.info('✅ Webhook路由 (/webhook) - Bot未配置（正常）');
        } else if (response.status === 200) {
          logger.info('✅ Webhook路由 (/webhook) - Bot已配置并正常');
        } else {
          logger.warn(`⚠️  Webhook路由 (/webhook) - 状态码: ${response.status}`);
        }
      } catch (error) {
        logger.error(`❌ Webhook路由 (/webhook) - 错误: ${error.message}`);
      }

      logger.info('路由验证完成');
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
