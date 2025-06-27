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
    this.app.use(session({
      secret: config.server.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: config.system.nodeEnv === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24小时
      }
    }));

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
    // API路由
    this.app.use('/api', apiRoutes);
    
    // Web管理后台路由
    this.app.use('/', webRoutes);

    // Bot Webhook路由
    this.app.use('/webhook', botService.webhookCallback());

    // 404处理
    this.app.use((req, res) => {
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
    });
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
