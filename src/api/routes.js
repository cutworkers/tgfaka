const express = require('express');
const router = express.Router();

// 导入控制器
const CardController = require('./controllers/cardController');
const ProductController = require('./controllers/productController');
const OrderController = require('./controllers/orderController');
const ImportController = require('./controllers/importController');
const PaymentController = require('./controllers/paymentController');
const SystemConfigController = require('./controllers/systemConfigController');
const UserController = require('./controllers/userController');

// 导入中间件
const { requestLogger, errorHandler, rateLimiter } = require('../middleware/auth');

// 应用全局中间件
router.use(requestLogger);
router.use(rateLimiter);

// 卡密相关路由
router.get('/cards', CardController.getCards);
router.get('/cards/stats', CardController.getCardStats);
router.get('/cards/:id', CardController.getCard);
router.post('/cards', CardController.createCard);
router.post('/cards/batch', CardController.createBatchCards);
router.put('/cards/:id', CardController.updateCard);
router.delete('/cards/:id', CardController.deleteCard);
router.delete('/cards/batch/:batch_id', CardController.deleteBatch);

// 卡密导入相关路由
router.post('/cards/import', ImportController.uploadMiddleware, ImportController.importCards);
router.get('/cards/import/template', ImportController.downloadTemplate);
router.get('/cards/import/history', ImportController.getImportHistory);

// 商品相关路由
router.get('/products', ProductController.getProducts);
router.get('/products/:id', ProductController.getProduct);
router.get('/products/:id/cards', ProductController.getProductCards);
router.get('/products/:id/stats', ProductController.getProductStats);
router.post('/products', ProductController.createProduct);
router.put('/products/:id', ProductController.updateProduct);
router.put('/products/:id/stock', ProductController.updateStock);
router.delete('/products/:id', ProductController.deleteProduct);

// 订单相关路由
router.get('/orders', OrderController.getOrders);
router.get('/orders/:id', OrderController.getOrder);
router.get('/orders/no/:order_no', OrderController.getOrderByNo);
router.get('/orders/stats', OrderController.getOrderStats);
router.get('/users/:user_id/orders', OrderController.getUserOrders);
router.post('/orders', OrderController.createOrder);
router.put('/orders/:id/status', OrderController.updateOrderStatus);
router.delete('/orders/:id', OrderController.cancelOrder);

// 用户相关路由
router.get('/users', UserController.getUsers);
router.get('/users/:id', UserController.getUserDetails);
router.get('/users/:id/stats', UserController.getUserStats);
router.put('/users/:id', UserController.updateUser);

// 支付相关路由
router.post('/payments/usdt/create', PaymentController.createUSDTPayment);
router.post('/payments/alipay/create', PaymentController.createAlipayPayment);
router.post('/payments/alipay/notify', PaymentController.alipayNotify);
router.get('/payments/:payment_method/:order_no/status', PaymentController.queryPaymentStatus);
router.post('/payments/confirm', PaymentController.confirmPayment);
router.get('/payments/stats', PaymentController.getPaymentStats);
router.get('/payments/usdt/rate', PaymentController.getUSDTRate);

// API文档路由
router.get('/docs', (req, res) => {
  res.json({
    message: 'Telegram Card Shop API',
    version: '1.0.0',
    endpoints: {
      // 卡密管理
      cards: {
        'GET /api/cards': '获取卡密列表',
        'GET /api/cards/:id': '获取卡密详情',
        'GET /api/cards/stats': '获取卡密统计',
        'POST /api/cards': '创建单个卡密',
        'POST /api/cards/batch': '批量创建卡密',
        'PUT /api/cards/:id': '更新卡密',
        'DELETE /api/cards/:id': '删除卡密',
        'DELETE /api/cards/batch/:batch_id': '批量删除卡密'
      },
      // 商品管理
      products: {
        'GET /api/products': '获取商品列表',
        'GET /api/products/:id': '获取商品详情',
        'GET /api/products/:id/cards': '获取商品卡密',
        'GET /api/products/:id/stats': '获取商品统计',
        'POST /api/products': '创建商品',
        'PUT /api/products/:id': '更新商品',
        'PUT /api/products/:id/stock': '更新库存',
        'DELETE /api/products/:id': '删除商品'
      },
      // 支付管理
      payments: {
        'POST /api/payments/usdt/create': '创建USDT支付',
        'POST /api/payments/alipay/create': '创建支付宝支付',
        'POST /api/payments/alipay/notify': '支付宝回调',
        'GET /api/payments/:method/:order_no/status': '查询支付状态',
        'POST /api/payments/confirm': '手动确认支付',
        'GET /api/payments/stats': '支付统计',
        'GET /api/payments/usdt/rate': 'USDT汇率'
      },
      // 订单管理
      orders: {
        'GET /api/orders': '获取订单列表',
        'GET /api/orders/:id': '获取订单详情',
        'GET /api/orders/no/:order_no': '根据订单号获取订单',
        'GET /api/orders/stats': '获取订单统计',
        'GET /api/users/:user_id/orders': '获取用户订单',
        'POST /api/orders': '创建订单',
        'PUT /api/orders/:id/status': '更新订单状态',
        'DELETE /api/orders/:id': '取消订单'
      },
      // 用户管理
      users: {
        'GET /api/users': '获取用户列表',
        'GET /api/users/:id': '获取用户详情及订单信息',
        'GET /api/users/:id/stats': '获取用户统计信息',
        'PUT /api/users/:id': '更新用户信息'
      }
    }
  });
});

// 系统配置相关路由
router.get('/system/config', SystemConfigController.getConfigs);
router.get('/system/config/:key', SystemConfigController.getConfig);
router.post('/system/config', SystemConfigController.createConfig);
router.put('/system/config/:key', SystemConfigController.updateConfig);
router.post('/system/config/batch', SystemConfigController.batchUpdateConfigs);
router.delete('/system/config/:key', SystemConfigController.deleteConfig);
router.post('/system/config/cache/clear', SystemConfigController.clearCache);

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

module.exports = router;
