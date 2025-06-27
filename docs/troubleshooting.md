# 故障排除指南

本文档提供系统常见问题的诊断和解决方案。

## 🔍 问题诊断流程

### 1. 收集信息
```bash
# 系统信息
uname -a
node --version
npm --version

# 应用状态
pm2 status
pm2 logs telegram-shop --lines 50

# 系统资源
free -h
df -h
top
```

### 2. 检查日志
```bash
# 应用日志
tail -f logs/combined.log
tail -f logs/error.log

# 系统日志
sudo journalctl -u nginx -f
sudo tail -f /var/log/syslog
```

### 3. 网络连接
```bash
# 端口检查
netstat -tulpn | grep :3000
ss -tulpn | grep :3000

# 服务连通性
curl http://localhost:3000/api/health
curl -I https://your-domain.com
```

## 🚨 常见问题解决

### 应用无法启动

#### 症状
- PM2显示应用状态为stopped
- 访问应用返回连接拒绝
- 日志显示启动错误

#### 诊断步骤
```bash
# 检查PM2状态
pm2 status

# 查看启动日志
pm2 logs telegram-shop --lines 100

# 手动启动测试
cd /path/to/telegram-shop
NODE_ENV=production node src/app.js
```

#### 常见原因和解决方案

**1. 端口被占用**
```bash
# 查找占用进程
lsof -i :3000
netstat -tulpn | grep :3000

# 杀死占用进程
kill -9 PID

# 或更改端口
echo "PORT=3001" >> .env
```

**2. 环境变量缺失**
```bash
# 检查必需变量
grep -E "BOT_TOKEN|DATABASE_PATH" .env

# 补充缺失变量
echo "BOT_TOKEN=your_token" >> .env
echo "DATABASE_PATH=./database/production.db" >> .env
```

**3. 数据库文件权限**
```bash
# 检查权限
ls -la database/

# 修复权限
chmod 755 database/
chmod 644 database/*.db
chown -R $USER:$USER database/
```

**4. 依赖包问题**
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 检查Node.js版本
node --version  # 需要16+
```

### Bot无响应

#### 症状
- 用户发送消息Bot无反应
- Bot命令不执行
- Webhook接收不到消息

#### 诊断步骤
```bash
# 测试Bot Token
curl https://api.telegram.org/bot<TOKEN>/getMe

# 检查Webhook状态
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# 查看Bot日志
tail -f logs/bot.log
pm2 logs telegram-shop | grep -i bot
```

#### 解决方案

**1. Token配置错误**
```bash
# 验证Token格式
echo $BOT_TOKEN | grep -E '^[0-9]+:[A-Za-z0-9_-]+$'

# 重新配置
nano .env
# BOT_TOKEN=correct_token_here
pm2 restart telegram-shop
```

**2. Webhook配置问题**
```bash
# 删除现有Webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/deleteWebhook

# 重新设置Webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=https://your-domain.com/webhook"

# 验证设置
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

**3. SSL证书问题**
```bash
# 检查证书有效性
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# 更新证书
sudo certbot renew
sudo systemctl reload nginx
```

### 支付系统故障

#### USDT支付监控失败

**症状**: 用户转账后订单状态不更新

**诊断**:
```bash
# 检查API连接
curl -H "TRON-PRO-API-KEY: $USDT_API_KEY" \
  https://api.trongrid.io/v1/accounts/$USDT_WALLET_ADDRESS

# 查看监控日志
pm2 logs telegram-shop | grep -i usdt

# 检查定时任务
pm2 show telegram-shop | grep -A 5 "cron"
```

**解决方案**:
```bash
# 手动触发监控
curl -X POST http://localhost:3000/api/admin/payments/usdt/check

# 重启监控服务
pm2 restart telegram-shop

# 验证配置
node -e "
const config = require('./src/config');
console.log('USDT配置:', config.usdt);
"
```

#### 支付宝回调失败

**症状**: 支付成功但订单状态未更新

**诊断**:
```bash
# 检查回调日志
tail -f logs/payment.log | grep alipay

# 测试回调接口
curl -X POST https://your-domain.com/api/payments/alipay/notify \
  -d "test_data=1"

# 检查Nginx配置
sudo nginx -t
```

**解决方案**:
```bash
# 验证签名配置
node -e "
const crypto = require('crypto');
const privateKey = process.env.ALIPAY_PRIVATE_KEY;
console.log('私钥长度:', privateKey ? privateKey.length : 'undefined');
"

# 检查回调URL可访问性
curl -I https://your-domain.com/api/payments/alipay/notify

# 重新配置支付宝应用
# 登录支付宝开放平台，检查应用配置
```

### 数据库问题

#### 数据库锁定

**症状**: 
- 操作超时
- "database is locked" 错误
- 查询无响应

**解决方案**:
```bash
# 检查数据库进程
lsof database/production.db

# 强制解锁（谨慎使用）
sqlite3 database/production.db "BEGIN IMMEDIATE; ROLLBACK;"

# 备份并重建
cp database/production.db database/backup_$(date +%Y%m%d).db
sqlite3 database/production.db "VACUUM;"

# 检查数据库完整性
sqlite3 database/production.db "PRAGMA integrity_check;"
```

#### 数据库损坏

**症状**: 
- 查询返回错误结果
- 数据不一致
- 完整性检查失败

**解决方案**:
```bash
# 停止应用
pm2 stop telegram-shop

# 备份当前数据库
cp database/production.db database/corrupted_$(date +%Y%m%d).db

# 尝试修复
sqlite3 database/production.db "PRAGMA integrity_check;"
sqlite3 database/production.db "REINDEX;"
sqlite3 database/production.db "VACUUM;"

# 如果无法修复，从备份恢复
cp database/backup_latest.db database/production.db

# 重启应用
pm2 start telegram-shop
```

### 性能问题

#### 内存泄漏

**症状**: 
- 内存使用持续增长
- 应用响应变慢
- 系统OOM错误

**诊断**:
```bash
# 监控内存使用
watch -n 1 'ps aux --sort=-%mem | head -10'

# 检查Node.js堆内存
curl http://localhost:3000/api/health | jq '.memory'

# 分析内存使用
node --inspect src/app.js
# 然后在Chrome中打开 chrome://inspect
```

**解决方案**:
```bash
# 设置内存限制
pm2 start ecosystem.config.js --max-memory-restart 1G

# 优化数据库查询
sqlite3 database/production.db "ANALYZE;"

# 清理日志文件
find logs/ -name "*.log" -mtime +7 -delete

# 重启应用
pm2 restart telegram-shop
```

#### 响应缓慢

**症状**: 
- API响应时间长
- Bot响应延迟
- 页面加载慢

**诊断**:
```bash
# 检查系统负载
uptime
iostat 1 5

# 分析慢查询
sqlite3 database/production.db "EXPLAIN QUERY PLAN SELECT * FROM orders;"

# 网络延迟测试
ping your-domain.com
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/health
```

**解决方案**:
```bash
# 添加数据库索引
sqlite3 database/production.db "
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_cards_product_id ON cards(product_id);
"

# 启用PM2集群模式
pm2 delete telegram-shop
pm2 start ecosystem.config.js --instances max

# 优化Nginx配置
sudo nano /etc/nginx/sites-available/telegram-shop
# 添加缓存和压缩配置
sudo systemctl reload nginx
```

### 网络问题

#### SSL证书过期

**症状**: 
- HTTPS访问失败
- Webhook接收失败
- 浏览器安全警告

**解决方案**:
```bash
# 检查证书状态
sudo certbot certificates

# 手动续期
sudo certbot renew --dry-run
sudo certbot renew

# 重启Nginx
sudo systemctl reload nginx

# 验证证书
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

#### 域名解析问题

**症状**: 
- 域名无法访问
- DNS解析失败
- 间歇性连接问题

**诊断和解决**:
```bash
# 检查DNS解析
nslookup your-domain.com
dig your-domain.com

# 检查域名配置
whois your-domain.com

# 测试不同DNS服务器
nslookup your-domain.com 8.8.8.8
nslookup your-domain.com 1.1.1.1

# 清除DNS缓存
sudo systemctl restart systemd-resolved
```

## 🛠️ 调试工具

### 日志分析
```bash
# 实时日志监控
tail -f logs/combined.log | grep ERROR

# 日志统计
grep "ERROR" logs/combined.log | wc -l
grep "$(date +%Y-%m-%d)" logs/combined.log | grep ERROR

# 日志分析脚本
cat > analyze_logs.sh << 'EOF'
#!/bin/bash
echo "=== 错误统计 ==="
grep -c "ERROR" logs/combined.log
echo "=== 最近错误 ==="
grep "ERROR" logs/combined.log | tail -10
echo "=== 支付相关错误 ==="
grep -i "payment.*error" logs/combined.log | tail -5
EOF
chmod +x analyze_logs.sh
```

### 性能监控
```bash
# 系统资源监控
htop
iotop
nethogs

# 应用性能监控
pm2 monit

# 数据库性能
sqlite3 database/production.db "
.timer on
SELECT COUNT(*) FROM orders;
.timer off
"
```

### 网络诊断
```bash
# 端口扫描
nmap -p 80,443,3000 your-domain.com

# 连接测试
telnet your-domain.com 80
telnet your-domain.com 443

# HTTP响应测试
curl -I http://your-domain.com
curl -I https://your-domain.com
```

## 📞 获取帮助

### 收集诊断信息
在寻求帮助时，请提供以下信息：

```bash
# 生成诊断报告
cat > diagnostic_report.sh << 'EOF'
#!/bin/bash
echo "=== 系统信息 ==="
uname -a
echo "=== Node.js版本 ==="
node --version
npm --version
echo "=== 应用状态 ==="
pm2 status
echo "=== 最近错误日志 ==="
tail -50 logs/error.log
echo "=== 系统资源 ==="
free -h
df -h
echo "=== 网络状态 ==="
netstat -tulpn | grep :3000
EOF

chmod +x diagnostic_report.sh
./diagnostic_report.sh > diagnostic_$(date +%Y%m%d_%H%M%S).txt
```

### 联系支持
- 📧 技术支持: tech@example.com
- 💬 Telegram: @support_bot
- 🐛 GitHub Issues: https://github.com/your-repo/issues

提交问题时请包含：
1. 问题详细描述
2. 重现步骤
3. 错误日志
4. 系统环境信息
5. 诊断报告
