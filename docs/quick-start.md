# 快速开始指南

本指南将帮助您在5分钟内快速部署和运行Telegram卡密销售系统。

## ⚡ 5分钟快速部署

### 步骤1: 环境准备 (1分钟)
```bash
# 确保已安装 Node.js 16+
node --version

# 克隆项目
git clone https://github.com/your-username/telegram-shop.git
cd telegram-shop
```

### 步骤2: 安装配置 (2分钟)
```bash
# 安装依赖
npm install

# 复制配置文件
cp .env.example .env

# 快速配置（最小配置）
echo "BOT_TOKEN=your_bot_token_here" >> .env
echo "ADMIN_PASSWORD=admin123" >> .env
```

### 步骤3: 初始化数据 (1分钟)
```bash
# 初始化数据库
npm run db:init

# 添加示例数据
npm run db:seed
```

### 步骤4: 启动服务 (1分钟)
```bash
# 启动开发服务器
npm run dev
```

### 步骤5: 验证部署 (30秒)
```bash
# 检查服务状态
curl http://localhost:3000/api/health

# 访问管理后台
# 浏览器打开: http://localhost:3000/admin
# 用户名: admin
# 密码: admin123
```

## 🎯 核心功能演示

### 1. 管理后台登录
1. 访问 `http://localhost:3000/admin`
2. 使用默认账户登录：
   - 用户名: `admin`
   - 密码: `admin123`

### 2. 添加商品
1. 进入"商品管理"页面
2. 点击"添加商品"按钮
3. 填写商品信息：
   ```
   商品名称: Steam充值卡
   价格: 100.00
   描述: Steam平台充值卡，面值100元
   ```

### 3. 导入卡密
1. 进入"卡密管理"页面
2. 点击"批量导入"
3. 下载CSV模板
4. 填写卡密信息并上传

### 4. 配置Telegram Bot
1. 向 @BotFather 申请Bot Token
2. 更新 `.env` 文件中的 `BOT_TOKEN`
3. 重启服务：`npm run dev`
4. 在Telegram中测试Bot

## 🔧 基础配置

### Telegram Bot设置
```bash
# 编辑 .env 文件
nano .env

# 添加Bot Token
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# 设置Webhook（生产环境）
BOT_WEBHOOK_URL=https://your-domain.com/webhook
```

### 支付配置（可选）
```bash
# USDT支付
USDT_WALLET_ADDRESS=your_usdt_address
USDT_RATE=6.5

# 支付宝支付
ALIPAY_APP_ID=your_app_id
```

## 📱 Telegram Bot使用

### 用户操作流程
1. **启动Bot**: 发送 `/start`
2. **浏览商品**: 点击"🛍️ 商品列表"
3. **选择商品**: 点击商品查看详情
4. **购买商品**: 选择数量和支付方式
5. **完成支付**: 按提示完成支付
6. **获取卡密**: 支付成功后自动发送

### Bot命令列表
- `/start` - 开始使用
- `/products` - 查看商品
- `/orders` - 我的订单
- `/balance` - 余额查询
- `/help` - 帮助信息

## 🎛️ 管理后台功能

### 仪表板
- 实时销售统计
- 订单状态概览
- 库存预警提醒
- 用户增长数据

### 商品管理
- 添加/编辑商品
- 设置价格和库存
- 商品分类管理
- 销售统计查看

### 订单管理
- 订单列表查看
- 订单状态管理
- 支付确认操作
- 订单详情查看

### 卡密管理
- 卡密列表查看
- 批量导入卡密
- 库存状态管理
- 过期卡密处理

## 🔄 常用操作

### 添加新商品
1. 登录管理后台
2. 商品管理 → 添加商品
3. 填写商品信息并保存
4. 导入对应的卡密

### 批量导入卡密
1. 下载CSV模板
2. 按格式填写卡密数据：
   ```csv
   card_number,card_password,expire_at
   CARD001,PASS001,2024-12-31 23:59:59
   CARD002,PASS002,2024-12-31 23:59:59
   ```
3. 上传CSV文件
4. 确认导入结果

### 处理订单
1. 查看待处理订单
2. 验证支付状态
3. 手动确认支付（如需要）
4. 系统自动发货

### 查看统计
1. 访问仪表板
2. 查看实时数据
3. 导出报表数据
4. 分析销售趋势

## 🚨 重要提醒

### 安全设置
```bash
# 修改默认密码
echo "ADMIN_PASSWORD=your_secure_password" >> .env

# 设置会话密钥
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env

# 设置API密钥
echo "API_KEY=$(openssl rand -base64 32)" >> .env
```

### 生产环境部署
```bash
# 使用PM2启动
npm install -g pm2
npm run pm2:start

# 配置Nginx反向代理
sudo cp nginx.conf /etc/nginx/sites-available/telegram-shop
sudo ln -s /etc/nginx/sites-available/telegram-shop /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 📊 监控检查

### 服务状态检查
```bash
# 检查应用状态
curl http://localhost:3000/api/health

# 检查PM2状态
pm2 status

# 查看日志
tail -f logs/combined.log
```

### 数据库检查
```bash
# 检查数据库文件
ls -la database/

# 查看表结构
sqlite3 database/production.db ".schema"

# 检查数据
sqlite3 database/production.db "SELECT COUNT(*) FROM products;"
```

## 🎯 下一步操作

快速部署完成后，建议：

1. **安全配置**: 阅读 [安全配置](./security.md)
2. **详细配置**: 查看 [配置说明](./configuration.md)
3. **生产部署**: 参考 [部署指南](./deployment.md)
4. **功能定制**: 了解 [开发指南](./development.md)

## 🆘 遇到问题？

- 📖 查看 [故障排除](./troubleshooting.md)
- 🔍 搜索 [FAQ](./faq.md)
- 📞 联系技术支持

---

🎉 **恭喜！您的Telegram卡密销售系统已经成功运行！**
