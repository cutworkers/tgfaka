# 部署指南

本指南详细介绍如何在生产环境中部署Telegram卡密销售系统。

## 🎯 部署架构

### 推荐架构
```
Internet
    ↓
[Nginx] (反向代理 + SSL)
    ↓
[PM2] (进程管理 + 负载均衡)
    ↓
[Node.js App] (应用实例)
    ↓
[SQLite] (数据库)
```

### 服务器要求
- **CPU**: 2核心以上
- **内存**: 4GB以上
- **存储**: 20GB SSD
- **网络**: 100Mbps带宽
- **操作系统**: Ubuntu 20.04 LTS (推荐)

## 🚀 自动化部署

### 使用部署脚本
```bash
# 克隆项目
git clone https://github.com/cutworkers/tgfaka.git
cd tgfaka

# 运行自动部署脚本
chmod +x scripts/deploy.sh
./scripts/deploy.sh production
```

### 部署脚本功能
- ✅ 环境检查和依赖验证
- ✅ 数据库自动备份
- ✅ 依赖安装和更新
- ✅ 数据库初始化
- ✅ 应用构建和启动
- ✅ 健康检查验证
- ✅ 部署后清理

## 🔧 手动部署步骤

### 1. 服务器准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要软件
sudo apt install -y curl wget git nginx sqlite3

# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2
sudo npm install -g pm2
```

### 2. 创建部署用户
```bash
# 创建专用用户
sudo adduser deploy
sudo usermod -aG sudo deploy

# 切换到部署用户
sudo su - deploy
```

### 3. 部署应用
```bash
# 克隆项目
git clone https://github.com/cutworkers/tgfaka.git
cd tgfaka

# 安装依赖
npm ci --only=production

# 配置环境变量
cp .env.example .env
nano .env
```

### 4. 配置环境变量
```bash
# 生产环境配置
NODE_ENV=production
PORT=3000
DATABASE_PATH=/home/deploy/tgfaka/database/production.db

# Telegram Bot配置
BOT_TOKEN=your_real_bot_token
BOT_WEBHOOK_URL=https://your-domain.com/webhook

# 支付配置
USDT_API_KEY=your_trongrid_api_key
USDT_WALLET_ADDRESS=your_usdt_wallet
ALIPAY_APP_ID=your_alipay_app_id

# 安全配置
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=$(openssl rand -base64 32)
API_KEY=$(openssl rand -base64 32)
```

### 5. 初始化数据库
```bash
# 创建数据库目录
mkdir -p database

# 初始化数据库
npm run db:init

# 创建管理员账户
npm run db:seed
```

### 6. 启动应用
```bash
# 使用PM2启动
pm2 start ecosystem.config.js --env production

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u deploy --hp /home/deploy
```

## 🌐 Nginx配置

### 1. 安装SSL证书
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 2. 配置Nginx
```bash
# 复制配置文件
sudo cp nginx.conf /etc/nginx/sites-available/tgfaka

# 编辑配置文件
sudo nano /etc/nginx/sites-available/tgfaka

# 启用站点
sudo ln -s /etc/nginx/sites-available/tgfaka /etc/nginx/sites-enabled/

# 删除默认站点
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

### 3. Nginx配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 安全配置

### 1. 防火墙设置
```bash
# 启用UFW防火墙
sudo ufw enable

# 允许SSH
sudo ufw allow ssh

# 允许HTTP和HTTPS
sudo ufw allow 80
sudo ufw allow 443

# 检查状态
sudo ufw status
```

### 2. 系统安全
```bash
# 禁用root登录
sudo nano /etc/ssh/sshd_config
# 设置: PermitRootLogin no

# 重启SSH服务
sudo systemctl restart ssh

# 设置自动安全更新
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### 3. 应用安全
```bash
# 设置文件权限
chmod 600 .env
chmod 755 database/
chmod 644 database/*.db

# 设置日志目录权限
mkdir -p logs
chmod 755 logs/
```

## 📊 监控配置

### 1. PM2监控
```bash
# 安装PM2监控
pm2 install pm2-server-monit

# 查看监控面板
pm2 monit
```

### 2. 系统监控
```bash
# 安装htop
sudo apt install htop

# 安装iotop
sudo apt install iotop

# 查看系统资源
htop
iotop
```

### 3. 日志监控
```bash
# 查看应用日志
pm2 logs telegram-shop

# 查看Nginx日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 查看系统日志
sudo journalctl -f
```

## 💾 备份策略

### 1. 自动备份脚本
```bash
# 创建备份脚本
nano /home/deploy/backup.sh

#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp /home/deploy/tgfaka/database/production.db $BACKUP_DIR/db_$DATE.db

# 备份配置文件
cp /home/deploy/tgfaka/.env $BACKUP_DIR/env_$DATE

# 压缩备份
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/db_$DATE.db $BACKUP_DIR/env_$DATE

# 清理临时文件
rm $BACKUP_DIR/db_$DATE.db $BACKUP_DIR/env_$DATE

# 删除30天前的备份
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +30 -delete

# 设置执行权限
chmod +x /home/deploy/backup.sh
```

### 2. 定时备份
```bash
# 编辑crontab
crontab -e

# 添加定时任务（每天凌晨2点备份）
0 2 * * * /home/deploy/backup.sh
```

## 🔄 更新部署

### 1. 零停机更新
```bash
# 拉取最新代码
git pull origin main

# 安装新依赖
npm ci --only=production

# 重启应用
pm2 reload telegram-shop
```

### 2. 回滚部署
```bash
# 查看Git历史
git log --oneline

# 回滚到指定版本
git reset --hard commit_hash

# 重启应用
pm2 restart telegram-shop
```

## 📈 性能优化

### 1. PM2集群模式
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'telegram-shop',
    script: './src/app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

### 2. Nginx优化
```nginx
# 启用Gzip压缩
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 6;

# 设置缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 🆘 故障排除

### 常见问题

#### 应用无法启动
```bash
# 检查日志
pm2 logs telegram-shop

# 检查端口占用
netstat -tulpn | grep :3000

# 检查权限
ls -la database/
```

#### Nginx配置错误
```bash
# 测试配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

#### SSL证书问题
```bash
# 检查证书状态
sudo certbot certificates

# 续期证书
sudo certbot renew --dry-run
```

## 📚 相关文档

- [监控运维](./monitoring.md)
- [备份恢复](./backup.md)
- [故障排除](./troubleshooting.md)
- [性能优化](./performance.md)
