# 常见问题解答 (FAQ)

本文档收集了用户和开发者最常遇到的问题及解决方案。

## 🚀 安装和部署

### Q: 安装时提示Node.js版本过低怎么办？
**A:** 系统要求Node.js 16.x或更高版本。

```bash
# 检查当前版本
node --version

# Ubuntu/Debian升级方法
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 使用nvm管理版本
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Q: npm install失败怎么办？
**A:** 常见解决方法：

```bash
# 清理缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules package-lock.json
npm install

# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com
npm install
```

### Q: 数据库初始化失败？
**A:** 检查以下几点：

1. 确保database目录存在且可写
2. 检查SQLite是否正确安装
3. 查看错误日志

```bash
# 创建数据库目录
mkdir -p database
chmod 755 database

# 手动初始化
node src/database/init.js

# 查看详细错误
DEBUG=* npm run db:init
```

## 🤖 Telegram Bot

### Q: Bot无法响应消息？
**A:** 检查以下配置：

1. **Token配置**：确保BOT_TOKEN正确
2. **网络连接**：测试API连接
3. **Webhook设置**：生产环境需要配置Webhook

```bash
# 测试Bot Token
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe

# 检查Webhook状态
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo

# 设置Webhook
curl -X POST https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook \
  -d "url=https://your-domain.com/webhook"
```

### Q: Bot命令菜单不显示？
**A:** 需要向@BotFather设置命令：

1. 找到@BotFather
2. 发送 `/setcommands`
3. 选择你的Bot
4. 输入命令列表：

```
start - 开始使用
products - 浏览商品
orders - 我的订单
balance - 余额查询
help - 帮助信息
```

### Q: Bot发送的消息格式错误？
**A:** 检查Markdown格式：

```javascript
// 正确的Markdown格式
const message = `
**粗体文本**
*斜体文本*
\`代码文本\`
[链接文本](https://example.com)
`;

// 发送时指定parse_mode
await ctx.reply(message, { parse_mode: 'Markdown' });
```

## 💰 支付系统

### Q: USDT支付无法监控到？
**A:** 检查以下配置：

1. **API Key**：确保TronGrid API Key有效
2. **钱包地址**：确认收款地址正确
3. **网络设置**：mainnet/testnet配置
4. **监控服务**：确保定时任务运行

```bash
# 测试API连接
curl -H "TRON-PRO-API-KEY: your_api_key" \
  https://api.trongrid.io/v1/accounts/your_address/transactions

# 检查定时任务
pm2 logs telegram-shop | grep "USDT监控"

# 手动触发监控
curl -X POST http://localhost:3000/api/admin/usdt/check
```

### Q: 支付宝回调失败？
**A:** 常见原因和解决方法：

1. **回调地址**：确保HTTPS且可访问
2. **签名验证**：检查公私钥配置
3. **参数格式**：确认参数名称正确

```bash
# 测试回调地址
curl -X POST https://your-domain.com/api/payments/alipay/notify \
  -d "test=1"

# 查看回调日志
tail -f logs/payment.log | grep "alipay"

# 验证签名配置
node -e "
const crypto = require('crypto');
const sign = crypto.createSign('RSA-SHA256');
console.log('签名测试通过');
"
```

### Q: 订单一直显示待支付？
**A:** 可能的原因：

1. **支付监控未启动**
2. **金额不匹配**
3. **网络确认延迟**
4. **回调处理失败**

```bash
# 检查监控状态
curl http://localhost:3000/api/health

# 手动确认支付
curl -X POST http://localhost:3000/api/payments/confirm \
  -H "Content-Type: application/json" \
  -d '{"order_id": 123}'

# 查看订单状态
sqlite3 database/production.db "SELECT * FROM orders WHERE id = 123;"
```

## 🎫 卡密管理

### Q: 批量导入卡密失败？
**A:** 检查CSV格式：

```csv
card_number,card_password,expire_at
CARD001,PASS001,2024-12-31 23:59:59
CARD002,PASS002,2024-12-31 23:59:59
```

常见问题：
- 文件编码必须是UTF-8
- 日期格式必须是 YYYY-MM-DD HH:mm:ss
- 不能有空行或特殊字符

### Q: 卡密重复怎么办？
**A:** 系统会自动检测重复：

```bash
# 查询重复卡密
sqlite3 database/production.db "
SELECT card_number, COUNT(*) 
FROM cards 
GROUP BY card_number 
HAVING COUNT(*) > 1;
"

# 删除重复卡密（保留最新的）
sqlite3 database/production.db "
DELETE FROM cards 
WHERE id NOT IN (
  SELECT MAX(id) 
  FROM cards 
  GROUP BY card_number
);
"
```

### Q: 卡密自动过期不工作？
**A:** 检查定时任务：

```bash
# 查看定时任务状态
pm2 logs telegram-shop | grep "过期卡密"

# 手动执行过期检查
curl -X POST http://localhost:3000/api/admin/cards/expire-check

# 查看过期卡密
sqlite3 database/production.db "
SELECT COUNT(*) FROM cards 
WHERE status = 'expired';
"
```

## 🌐 Web管理后台

### Q: 无法登录管理后台？
**A:** 检查以下问题：

1. **账户配置**：确认用户名密码
2. **会话配置**：检查SESSION_SECRET
3. **数据库**：确认管理员账户存在

```bash
# 重置管理员密码
node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('new_password', 12);
console.log('新密码哈希:', hash);
"

# 更新数据库
sqlite3 database/production.db "
UPDATE admins 
SET password_hash = 'new_hash' 
WHERE username = 'admin';
"
```

### Q: 管理后台样式错误？
**A:** 检查静态资源：

1. **CDN连接**：确保网络可访问Bootstrap CDN
2. **本地资源**：检查public目录
3. **缓存问题**：清除浏览器缓存

```bash
# 测试CDN连接
curl -I https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css

# 检查静态文件
ls -la public/

# 强制刷新浏览器
Ctrl + F5 (Windows/Linux)
Cmd + Shift + R (Mac)
```

### Q: 数据统计不准确？
**A:** 可能的原因：

1. **缓存问题**：清除统计缓存
2. **数据同步**：检查数据一致性
3. **时区问题**：确认时区设置

```bash
# 清除缓存
redis-cli FLUSHDB

# 重新计算统计
curl -X POST http://localhost:3000/api/admin/stats/refresh

# 检查时区
date
timedatectl status
```

## 🔧 系统运维

### Q: 系统内存占用过高？
**A:** 优化建议：

```bash
# 查看内存使用
free -h
ps aux --sort=-%mem | head

# PM2内存限制
pm2 start ecosystem.config.js --max-memory-restart 1G

# 清理日志
find logs/ -name "*.log" -mtime +7 -delete

# 数据库优化
sqlite3 database/production.db "VACUUM;"
```

### Q: 日志文件过大？
**A:** 配置日志轮转：

```bash
# 安装logrotate
sudo apt install logrotate

# 创建配置文件
sudo nano /etc/logrotate.d/telegram-shop

# 配置内容
/home/deploy/telegram-shop/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}

# 测试配置
sudo logrotate -d /etc/logrotate.d/telegram-shop
```

### Q: 数据库锁定错误？
**A:** SQLite并发问题：

```bash
# 检查数据库状态
sqlite3 database/production.db ".timeout 30000"

# 备份数据库
cp database/production.db database/backup_$(date +%Y%m%d).db

# 修复数据库
sqlite3 database/production.db "PRAGMA integrity_check;"
sqlite3 database/production.db "VACUUM;"
```

## 🔒 安全问题

### Q: 如何加强系统安全？
**A:** 安全建议：

1. **更改默认密码**
2. **启用HTTPS**
3. **配置防火墙**
4. **定期更新**
5. **监控日志**

```bash
# 生成强密码
openssl rand -base64 32

# 配置防火墙
sudo ufw enable
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443

# 检查安全日志
sudo tail -f /var/log/auth.log
tail -f logs/security.log
```

### Q: 发现异常访问怎么办？
**A:** 应急处理：

```bash
# 查看访问日志
tail -f /var/log/nginx/access.log | grep "suspicious_ip"

# 封禁IP
sudo ufw deny from suspicious_ip

# 检查系统进程
ps aux | grep -v grep | grep suspicious

# 更改密码
echo "ADMIN_PASSWORD=new_secure_password" >> .env
pm2 restart telegram-shop
```

## 📞 获取帮助

### 在线资源
- 📖 [完整文档](./README.md)
- 🔧 [故障排除](./troubleshooting.md)
- 💬 [GitHub Issues](https://github.com/your-repo/issues)

### 联系支持
- 📧 邮箱: support@example.com
- 💬 Telegram: @support_bot
- 🌐 官网: https://your-website.com

### 社区支持
- 💬 Telegram群: @telegram_shop_community
- 📱 QQ群: 123456789
- 🐦 Twitter: @telegram_shop

---

💡 **提示**: 如果问题仍未解决，请提供详细的错误日志和系统信息，这将帮助我们更快地定位问题。
