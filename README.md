# Telegram Bot 卡密销售系统

基于Node.js + Express + Telegraf.js + SQLite构建的Telegram Bot卡密销售系统。

## 功能特性

- 🤖 **Telegram Bot交互**: 商品浏览、购买流程、订单查询
- 💳 **多种支付方式**: USDT(TRC20)、支付宝
- 🎮 **游戏充值卡**: 支持卡号+密码形式的卡密销售
- 🌐 **Web管理后台**: 商品管理、订单管理、用户管理、统计报表
- 📊 **实时监控**: 支付状态监控、库存预警
- 🔒 **安全可靠**: 数据加密、支付验证、订单超时处理

## 技术栈

- **后端**: Node.js + Express.js
- **数据库**: SQLite3
- **Bot框架**: Telegraf.js
- **模板引擎**: EJS
- **前端**: Bootstrap + Chart.js
- **支付**: TronGrid API + 支付宝开放平台

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

主要配置项：
- `BOT_TOKEN`: Telegram Bot Token
- `USDT_WALLET_ADDRESS`: USDT收款地址
- `ALIPAY_APP_ID`: 支付宝应用ID

### 3. 初始化数据库

```bash
npm run db:init
npm run db:seed
```

### 4. 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

### 5. 访问系统

- **管理后台**: http://localhost:3000/admin
- **API文档**: http://localhost:3000/api/docs
- **Telegram Bot**: 在Telegram中搜索你的Bot

## 项目结构

```
telegram_shop/
├── src/
│   ├── api/           # API接口
│   ├── bot/           # Telegram Bot逻辑
│   ├── web/           # Web管理后台
│   ├── database/      # 数据库相关
│   ├── services/      # 业务服务
│   ├── utils/         # 工具函数
│   ├── middleware/    # 中间件
│   └── config/        # 配置文件
├── views/             # EJS模板
├── public/            # 静态资源
├── database/          # SQLite数据库文件
└── logs/              # 日志文件
```

## 📚 完整文档

详细文档请查看 [docs](./docs/) 目录：

### 🚀 快速开始
- 📖 [安装指南](./docs/installation.md) - 系统安装和环境配置
- ⚡ [快速开始](./docs/quick-start.md) - 5分钟快速部署指南
- ⚙️ [配置说明](./docs/configuration.md) - 详细配置参数说明

### 📖 功能文档
- 🤖 [Telegram Bot](./docs/bot.md) - Bot功能和使用指南
- 🔌 [API文档](./docs/api.md) - 完整API接口文档
- 🚀 [部署指南](./docs/deployment.md) - 生产环境部署方案

### 🆘 帮助支持
- 🔧 [故障排除](./docs/troubleshooting.md) - 常见问题诊断和解决
- ❓ [FAQ](./docs/faq.md) - 常见问题解答
- 📋 [更新日志](./docs/changelog.md) - 版本更新记录

## 🎯 核心API接口

### 商品管理
- `GET /api/products` - 获取商品列表
- `POST /api/products` - 创建商品
- `PUT /api/products/:id` - 更新商品
- `DELETE /api/products/:id` - 删除商品

### 卡密管理
- `GET /api/cards` - 获取卡密列表
- `POST /api/cards` - 创建卡密
- `POST /api/cards/batch` - 批量创建卡密
- `POST /api/cards/import` - CSV导入卡密

### 支付接口
- `POST /api/payments/usdt/create` - 创建USDT支付
- `POST /api/payments/alipay/create` - 创建支付宝支付
- `POST /api/payments/alipay/notify` - 支付宝回调
- `GET /api/payments/usdt/rate` - USDT汇率

> 📋 完整API文档请查看 [API文档](./docs/api.md)

## 部署

### 使用PM2部署

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

### 使用Docker部署

```bash
docker build -t telegram-shop .
docker run -d -p 3000:3000 telegram-shop
```

## 许可证

MIT License
