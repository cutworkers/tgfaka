# 配置说明

本文档详细说明Telegram卡密销售系统的所有配置选项。

## 📁 配置文件

### 主配置文件
- `.env` - 环境变量配置
- `src/config/index.js` - 应用配置
- `ecosystem.config.js` - PM2配置
- `nginx.conf` - Nginx配置

## 🔧 环境变量配置

### 系统基础配置

```bash
# 运行环境
NODE_ENV=production          # 运行环境: development, staging, production
PORT=3000                   # 应用端口
LOG_LEVEL=info              # 日志级别: error, warn, info, debug

# 数据库配置
DATABASE_TYPE=sqlite                    # 数据库类型: sqlite, mysql
DATABASE_PATH=./database/production.db  # SQLite数据库文件路径

# MySQL数据库配置 (当DATABASE_TYPE=mysql时使用)
MYSQL_HOST=localhost                    # MySQL服务器地址
MYSQL_PORT=3306                        # MySQL端口
MYSQL_DATABASE=telegram_shop            # 数据库名称
MYSQL_USERNAME=root                     # 用户名
MYSQL_PASSWORD=your_mysql_password      # 密码
MYSQL_CHARSET=utf8mb4                   # 字符集
MYSQL_TIMEZONE=+08:00                   # 时区
MYSQL_CONNECTION_LIMIT=10               # 连接池最大连接数
```

### 数据库选择指南

#### SQLite (默认)
- **适用场景**: 小型部署、开发测试、单机应用
- **优点**: 无需额外安装、配置简单、文件存储
- **缺点**: 并发性能有限、不支持分布式

#### MySQL
- **适用场景**: 生产环境、高并发、分布式部署
- **优点**: 高性能、支持集群、事务完整性好
- **缺点**: 需要额外安装配置MySQL服务器

#### 配置示例

**SQLite配置**:
```bash
DATABASE_TYPE=sqlite
DATABASE_PATH=./database/shop.db
```

**MySQL配置**:
```bash
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=telegram_shop
MYSQL_USERNAME=shop_user
MYSQL_PASSWORD=secure_password
```

### Telegram Bot配置

```bash
# Bot基础配置
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz  # Bot Token (必需)
BOT_WEBHOOK_URL=https://your-domain.com/webhook   # Webhook URL (生产环境)

# Bot功能配置
BOT_ADMIN_IDS=123456789,987654321  # 管理员Telegram ID列表
BOT_MAX_BUTTONS_PER_ROW=2          # 每行最大按钮数
BOT_PAGE_SIZE=10                   # 分页大小
```

### USDT支付配置

```bash
# TronGrid API配置
USDT_API_KEY=your_trongrid_api_key              # TronGrid API密钥
USDT_WALLET_ADDRESS=TXXXxxxXXXxxxXXX            # USDT收款地址
USDT_CONTRACT_ADDRESS=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t  # USDT合约地址
USDT_NETWORK=mainnet                            # 网络: mainnet, testnet
USDT_RATE=6.5                                   # USDT汇率 (CNY)

# 支付监控配置
USDT_MONITOR_INTERVAL=60000      # 监控间隔(毫秒)
USDT_CONFIRMATION_BLOCKS=1       # 确认区块数
USDT_PAYMENT_TIMEOUT=1800        # 支付超时(秒)
```

### 支付宝配置

```bash
# 支付宝应用配置
ALIPAY_APP_ID=2021000000000000                    # 应用ID
ALIPAY_PRIVATE_KEY=MIIEvQIBADANBgkqhkiG9w0...    # 应用私钥
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQEF...   # 支付宝公钥
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do  # 网关地址

# 回调配置
ALIPAY_NOTIFY_URL=https://your-domain.com/api/payments/alipay/notify  # 异步通知地址
ALIPAY_RETURN_URL=https://your-domain.com/payment/success             # 同步跳转地址

# 支付配置
ALIPAY_TIMEOUT_EXPRESS=30m       # 订单超时时间
ALIPAY_PRODUCT_CODE=QUICK_WAP_WAY  # 产品码
```

### 管理员配置

```bash
# 管理员账户
ADMIN_USERNAME=admin                    # 管理员用户名
ADMIN_PASSWORD=your_secure_password     # 管理员密码 (建议使用强密码)
ADMIN_EMAIL=admin@example.com          # 管理员邮箱

# 会话配置
SESSION_SECRET=your_random_session_secret  # 会话密钥 (必须随机生成)
SESSION_MAX_AGE=86400000                   # 会话过期时间(毫秒)
SESSION_SECURE=true                        # HTTPS环境设为true
```

### 安全配置

```bash
# API安全
API_KEY=your_api_key                    # API密钥
API_RATE_LIMIT_WINDOW=900000           # 限流窗口(毫秒)
API_RATE_LIMIT_MAX=100                 # 限流最大请求数

# 加密配置
ENCRYPTION_KEY=your_32_char_encryption_key  # 数据加密密钥
HASH_SALT_ROUNDS=12                         # 密码哈希轮数

# CORS配置
CORS_ORIGIN=https://your-domain.com     # 允许的源
CORS_CREDENTIALS=true                   # 允许凭证
```

### 邮件配置 (可选)

```bash
# SMTP配置
SMTP_HOST=smtp.gmail.com        # SMTP服务器
SMTP_PORT=587                   # SMTP端口
SMTP_SECURE=false               # 是否使用SSL
SMTP_USER=your_email@gmail.com  # 邮箱账户
SMTP_PASS=your_email_password   # 邮箱密码

# 邮件模板
EMAIL_FROM=noreply@your-domain.com     # 发件人地址
EMAIL_FROM_NAME=Telegram Shop          # 发件人名称
```

### Redis配置 (可选)

```bash
# Redis连接
REDIS_HOST=localhost            # Redis主机
REDIS_PORT=6379                # Redis端口
REDIS_PASSWORD=your_password    # Redis密码
REDIS_DB=0                     # Redis数据库编号

# Redis配置
REDIS_KEY_PREFIX=telegram_shop: # 键前缀
REDIS_TTL=3600                 # 默认TTL(秒)
```

### 文件上传配置

```bash
# 上传限制
MAX_UPLOAD_SIZE=10MB           # 最大上传文件大小
UPLOAD_PATH=./uploads          # 上传文件存储路径
ALLOWED_FILE_TYPES=csv,xlsx,jpg,png,gif  # 允许的文件类型

# 图片处理
IMAGE_MAX_WIDTH=1920           # 图片最大宽度
IMAGE_MAX_HEIGHT=1080          # 图片最大高度
IMAGE_QUALITY=80               # 图片压缩质量
```

### 监控配置

```bash
# 应用监控
SENTRY_DSN=https://xxx@sentry.io/xxx    # Sentry错误监控
PROMETHEUS_PORT=9090                    # Prometheus指标端口
GRAFANA_PASSWORD=your_grafana_password  # Grafana密码

# 健康检查
HEALTH_CHECK_INTERVAL=30000    # 健康检查间隔(毫秒)
HEALTH_CHECK_TIMEOUT=5000      # 健康检查超时(毫秒)
```

### 备份配置

```bash
# 备份设置
BACKUP_ENABLED=true                    # 是否启用自动备份
BACKUP_SCHEDULE=0 2 * * *             # 备份计划(cron表达式)
BACKUP_RETENTION_DAYS=30              # 备份保留天数
BACKUP_PATH=./backups                 # 备份存储路径

# 远程备份
BACKUP_S3_BUCKET=your-backup-bucket   # S3存储桶
BACKUP_S3_REGION=us-east-1            # S3区域
BACKUP_S3_ACCESS_KEY=your_access_key  # S3访问密钥
BACKUP_S3_SECRET_KEY=your_secret_key  # S3密钥
```

### 业务配置

```bash
# 订单配置
ORDER_TIMEOUT_MINUTES=30       # 订单超时时间(分钟)
ORDER_PREFIX=ORD              # 订单号前缀
ORDER_NUMBER_LENGTH=12        # 订单号长度

# 卡密配置
CARD_BATCH_SIZE=1000          # 批量导入最大数量
CARD_EXPIRE_DAYS=365          # 默认过期天数
CARD_AUTO_EXPIRE_CHECK=true   # 自动过期检查

# 库存配置
STOCK_LOW_THRESHOLD=10        # 低库存阈值
STOCK_ALERT_ENABLED=true      # 库存预警
```

## 🔧 应用配置文件

### src/config/index.js

```javascript
module.exports = {
  // 系统配置
  system: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 3000,
    logLevel: process.env.LOG_LEVEL || 'info',
    orderTimeoutMinutes: parseInt(process.env.ORDER_TIMEOUT_MINUTES) || 30
  },

  // 数据库配置
  database: {
    path: process.env.DATABASE_PATH || './database/development.db'
  },

  // Bot配置
  bot: {
    token: process.env.BOT_TOKEN,
    webhookUrl: process.env.BOT_WEBHOOK_URL,
    adminIds: process.env.BOT_ADMIN_IDS?.split(',') || []
  },

  // 支付配置
  usdt: {
    apiKey: process.env.USDT_API_KEY,
    walletAddress: process.env.USDT_WALLET_ADDRESS,
    contractAddress: process.env.USDT_CONTRACT_ADDRESS,
    network: process.env.USDT_NETWORK || 'testnet',
    rate: parseFloat(process.env.USDT_RATE) || 6.5
  },

  alipay: {
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY,
    publicKey: process.env.ALIPAY_PUBLIC_KEY,
    gateway: process.env.ALIPAY_GATEWAY,
    notifyUrl: process.env.ALIPAY_NOTIFY_URL
  }
};
```

## 🔒 安全最佳实践

### 1. 密码安全
```bash
# 生成强密码
openssl rand -base64 32

# 生成会话密钥
openssl rand -base64 64

# 生成API密钥
uuidgen
```

### 2. 文件权限
```bash
# 设置配置文件权限
chmod 600 .env
chmod 600 src/config/production.js

# 设置目录权限
chmod 755 database/
chmod 755 logs/
chmod 755 uploads/
```

### 3. 环境隔离
```bash
# 开发环境
cp .env.example .env.development

# 测试环境
cp .env.example .env.staging

# 生产环境
cp .env.example .env.production
```

## 📊 配置验证

### 启动时检查
系统启动时会自动验证关键配置：

```javascript
// 必需配置检查
const requiredConfigs = [
  'BOT_TOKEN',
  'DATABASE_PATH',
  'SESSION_SECRET'
];

// 生产环境额外检查
if (NODE_ENV === 'production') {
  requiredConfigs.push(
    'ADMIN_PASSWORD',
    'API_KEY',
    'BOT_WEBHOOK_URL'
  );
}
```

### 配置测试命令
```bash
# 验证配置
npm run config:validate

# 测试数据库连接
npm run db:test

# 测试Bot连接
npm run bot:test

# 测试支付配置
npm run payment:test
```

## 🔄 配置更新

### 热更新配置
某些配置支持热更新，无需重启：

```bash
# 更新日志级别
curl -X POST http://localhost:3000/api/admin/config \
  -H "Content-Type: application/json" \
  -d '{"logLevel": "debug"}'

# 更新USDT汇率
curl -X POST http://localhost:3000/api/admin/config \
  -H "Content-Type: application/json" \
  -d '{"usdtRate": 6.8}'
```

### 配置重载
```bash
# 重载配置文件
pm2 reload telegram-shop

# 或发送信号
kill -USR2 $(pgrep -f "telegram-shop")
```

## 📚 相关文档

- [安装指南](./installation.md)
- [部署指南](./deployment.md)
- [安全配置](./security.md)
- [故障排除](./troubleshooting.md)
