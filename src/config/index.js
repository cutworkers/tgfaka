require('dotenv').config();

module.exports = {
  // Telegram Bot配置
  bot: {
    token: process.env.BOT_TOKEN,
    webhookUrl: process.env.BOT_WEBHOOK_URL,
  },

  // 数据库配置
  database: {
    path: process.env.DATABASE_PATH || './database/shop.db',
  },

  // Web服务配置
  server: {
    port: process.env.PORT || 3000,
    sessionSecret: process.env.SESSION_SECRET || 'default_secret',
  },

  // 管理员配置
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },

  // USDT支付配置
  usdt: {
    apiKey: process.env.TRON_API_KEY,
    walletAddress: process.env.USDT_WALLET_ADDRESS,
    network: process.env.TRON_NETWORK || 'mainnet',
    contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT TRC20
  },

  // 支付宝配置
  alipay: {
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY,
    publicKey: process.env.ALIPAY_PUBLIC_KEY,
    gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
    notifyUrl: process.env.ALIPAY_NOTIFY_URL,
  },

  // 系统配置
  system: {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    cardExpireHours: parseInt(process.env.CARD_EXPIRE_HOURS) || 24,
    orderTimeoutMinutes: parseInt(process.env.ORDER_TIMEOUT_MINUTES) || 30,
  },

  // 支付方式
  paymentMethods: {
    USDT: 'usdt',
    ALIPAY: 'alipay',
  },

  // 订单状态
  orderStatus: {
    PENDING: 'pending',
    PAID: 'paid',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired',
  },

  // 卡密状态
  cardStatus: {
    AVAILABLE: 'available',
    SOLD: 'sold',
    EXPIRED: 'expired',
  },
};
