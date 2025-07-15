# 安装指南

本指南将帮助您在不同环境中安装和配置Telegram卡密销售系统。

## 📋 系统要求

### 最低要求
- **操作系统**: Linux (Ubuntu 18.04+), macOS (10.15+), Windows (10+)
- **Node.js**: 16.x 或更高版本
- **NPM**: 8.x 或更高版本
- **内存**: 最少 512MB RAM
- **存储**: 最少 1GB 可用空间

### 推荐配置
- **操作系统**: Ubuntu 20.04 LTS
- **Node.js**: 18.x LTS
- **NPM**: 9.x
- **内存**: 2GB+ RAM
- **存储**: 10GB+ SSD
- **网络**: 稳定的互联网连接

## 🛠️ 环境准备

### 1. 安装 Node.js

#### Ubuntu/Debian
```bash
# 使用 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

#### CentOS/RHEL
```bash
# 使用 NodeSource 仓库
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

#### macOS
```bash
# 使用 Homebrew
brew install node

# 或下载官方安装包
# https://nodejs.org/
```

#### Windows
1. 访问 [Node.js官网](https://nodejs.org/)
2. 下载 Windows 安装包
3. 运行安装程序
4. 验证安装：打开命令提示符，运行 `node --version`

### 2. 安装 Git
```bash
# Ubuntu/Debian
sudo apt-get install git

# CentOS/RHEL
sudo yum install git

# macOS
brew install git

# Windows
# 下载 Git for Windows: https://git-scm.com/
```

### 3. 安装 PM2 (生产环境推荐)
```bash
npm install -g pm2
```

## 📦 系统安装

### 1. 克隆项目
```bash
# 使用 HTTPS
git clone https://github.com/cutworkers/tgfaka.git

# 或使用 SSH
git clone git@github.com:cutworkers/tgfaka.git

# 进入项目目录
cd tgfaka
```

### 2. 安装依赖
```bash
# 安装生产依赖
npm ci --only=production

# 或安装所有依赖（包括开发依赖）
npm install
```

### 3. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
nano .env
# 或使用其他编辑器：vim .env, code .env
```

### 4. 数据库准备

#### 使用SQLite (默认)
无需额外配置，直接进行下一步。

#### 使用MySQL
如果选择使用MySQL，需要先安装并配置MySQL服务器：

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server

# CentOS/RHEL
sudo yum install mysql-server

# macOS (使用Homebrew)
brew install mysql

# Windows
# 下载并安装MySQL Community Server
```

创建数据库和用户：
```sql
-- 登录MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE telegram_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户并授权
CREATE USER 'shop_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON telegram_shop.* TO 'shop_user'@'localhost';
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

### 5. 初始化数据库
```bash
# 创建数据库表结构
npm run db:init

# 插入示例数据（可选）
npm run db:seed
```

### 6. 验证安装
```bash
# 运行健康检查
npm run test:basic

# 启动开发服务器
npm run dev
```

## 🔧 配置说明

### 必需配置项

编辑 `.env` 文件，配置以下必需项：

```bash
# Telegram Bot Token（必需）
BOT_TOKEN=your_telegram_bot_token_here

# 数据库配置
DATABASE_TYPE=sqlite  # 或 mysql
DATABASE_PATH=./database/production.db  # SQLite使用

# MySQL配置 (如果使用MySQL)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=telegram_shop
MYSQL_USERNAME=shop_user
MYSQL_PASSWORD=secure_password

# 管理员账户
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# 会话密钥
SESSION_SECRET=your_random_session_secret
```

### 支付配置

#### USDT支付配置
```bash
USDT_API_KEY=your_trongrid_api_key
USDT_WALLET_ADDRESS=your_usdt_wallet_address
USDT_RATE=6.5
```

#### 支付宝配置
```bash
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PRIVATE_KEY=your_alipay_private_key
ALIPAY_PUBLIC_KEY=alipay_public_key
ALIPAY_NOTIFY_URL=https://your-domain.com/api/payments/alipay/notify
```

## 🚀 启动服务

### 开发环境
```bash
npm run dev
```

### 生产环境
```bash
# 使用 PM2
npm run pm2:start

# 或直接启动
npm start
```

## ✅ 验证安装

### 1. 检查服务状态
```bash
# 访问健康检查接口
curl http://localhost:3000/api/health

# 预期响应
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 123.456
}
```

### 2. 访问管理后台
1. 打开浏览器访问 `http://localhost:3000/admin`
2. 使用配置的管理员账户登录
3. 查看仪表板数据

### 3. 测试 Telegram Bot
1. 在 Telegram 中搜索您的 Bot
2. 发送 `/start` 命令
3. 验证 Bot 响应正常

## 🔧 常见问题

### Node.js 版本问题
```bash
# 检查 Node.js 版本
node --version

# 如果版本过低，请升级
npm install -g n
n latest
```

### 权限问题
```bash
# Linux/macOS 权限问题
sudo chown -R $USER:$USER /path/to/tgfaka
chmod +x scripts/*.sh
```

### 端口占用
```bash
# 检查端口占用
netstat -tulpn | grep :3000

# 或使用 lsof
lsof -i :3000

# 修改端口
echo "PORT=3001" >> .env
```

### 数据库权限
```bash
# 确保数据库目录可写
mkdir -p database
chmod 755 database
```

## 📚 下一步

安装完成后，建议阅读：

1. [快速开始](./quick-start.md) - 快速配置和使用
2. [配置说明](./configuration.md) - 详细配置参数
3. [管理后台](./admin.md) - 管理界面使用指南

## 🆘 获取帮助

如果安装过程中遇到问题：

1. 查看 [故障排除](./troubleshooting.md)
2. 检查系统日志：`tail -f logs/error.log`
3. 联系技术支持
