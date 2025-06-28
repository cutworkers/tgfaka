const express = require('express');
const router = express.Router();
const AdminController = require('./controllers/adminController');

// 中间件：检查管理员登录状态
const requireAuth = (req, res, next) => {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }
  next();
};

// 首页重定向到管理后台
router.get('/', (req, res) => {
  res.redirect('/admin');
});

// 管理后台登录相关路由
router.get('/admin/login', AdminController.loginPage);
router.post('/admin/login', AdminController.login);
router.get('/admin/logout', AdminController.logout);

// 管理后台主要路由（需要登录）
router.get('/admin', requireAuth, (req, res) => {
  res.redirect('/admin/dashboard');
});

router.get('/admin/dashboard', requireAuth, AdminController.dashboard);
router.get('/admin/products', requireAuth, AdminController.products);
router.get('/admin/orders', requireAuth, AdminController.orders);
router.get('/admin/users', requireAuth, AdminController.users);
router.get('/admin/cards', requireAuth, AdminController.cards);
router.get('/admin/settings', requireAuth, AdminController.settings);
router.get('/admin/reports', requireAuth, AdminController.reports);

module.exports = router;
