const logger = require('../utils/logger');

// 简单的API密钥认证中间件
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validApiKey = process.env.API_KEY || 'default_api_key_change_me';

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: '缺少API密钥'
    });
  }

  if (apiKey !== validApiKey) {
    logger.warn('无效的API密钥访问', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      apiKey: apiKey.substr(0, 8) + '...'
    });
    
    return res.status(401).json({
      success: false,
      message: 'API密钥无效'
    });
  }

  next();
};

// 管理员认证中间件
const adminAuth = (req, res, next) => {
  if (!req.session || !req.session.admin) {
    return res.status(401).json({
      success: false,
      message: '需要管理员权限'
    });
  }

  next();
};

// 请求日志中间件
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('API请求', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });

  next();
};

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  logger.error('API错误', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Multer错误处理
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: '文件大小超出限制'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: '不支持的文件类型'
    });
  }

  // 默认错误响应
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// 速率限制中间件（简单实现）
const rateLimiter = (() => {
  const requests = new Map();
  const WINDOW_SIZE = 15 * 60 * 1000; // 15分钟
  const MAX_REQUESTS = 1000; // 每15分钟最多1000次请求

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const userRequests = requests.get(ip);
    
    // 清理过期请求
    const validRequests = userRequests.filter(time => now - time < WINDOW_SIZE);
    requests.set(ip, validRequests);
    
    if (validRequests.length >= MAX_REQUESTS) {
      return res.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后再试'
      });
    }
    
    validRequests.push(now);
    next();
  };
})();

// 参数验证中间件
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

module.exports = {
  apiKeyAuth,
  adminAuth,
  requestLogger,
  errorHandler,
  rateLimiter,
  validateParams
};
