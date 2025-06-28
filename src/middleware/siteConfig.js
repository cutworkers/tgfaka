const SystemConfig = require('../database/models/SystemConfig');
const logger = require('../utils/logger');

// 配置缓存，避免每次请求都查询数据库
let configCache = {};
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

/**
 * 站点配置中间件
 * 为所有页面注入站点配置信息
 */
async function siteConfigMiddleware(req, res, next) {
  try {
    // 只为页面请求（非API请求）注入配置
    if (req.path.startsWith('/api/')) {
      return next();
    }

    // 检查缓存是否过期
    const now = Date.now();
    if (now - lastCacheUpdate > CACHE_DURATION) {
      await refreshConfigCache();
      lastCacheUpdate = now;
    }

    // 为响应对象添加站点配置
    const originalRender = res.render;
    res.render = function(view, locals = {}, callback) {
      // 合并站点配置到模板变量中
      const mergedLocals = {
        ...locals,
        siteConfig: configCache,
        siteName: configCache.site_name || 'Telegram卡密销售系统',
        siteDescription: configCache.site_description || '专业的卡密销售平台'
      };

      // 调用原始的render方法
      return originalRender.call(this, view, mergedLocals, callback);
    };

    next();
  } catch (error) {
    logger.error('站点配置中间件错误', { error: error.message });
    // 即使配置获取失败，也要继续处理请求，使用默认值
    const originalRender = res.render;
    res.render = function(view, locals = {}, callback) {
      const mergedLocals = {
        ...locals,
        siteConfig: {
          site_name: 'Telegram卡密销售系统',
          site_description: '专业的卡密销售平台',
          welcome_message: '欢迎使用卡密销售系统！',
          auto_delivery: true,
          order_timeout_minutes: 30,
          card_expire_hours: 24
        },
        siteName: 'Telegram卡密销售系统',
        siteDescription: '专业的卡密销售平台'
      };
      return originalRender.call(this, view, mergedLocals, callback);
    };
    next();
  }
}

/**
 * 刷新配置缓存
 */
async function refreshConfigCache() {
  try {
    // 获取常用配置
    const commonKeys = [
      'site_name',
      'site_description',
      'welcome_message',
      'auto_delivery',
      'order_timeout_minutes',
      'card_expire_hours',
      'min_usdt_amount',
      'usdt_rate'
    ];

    const configs = await SystemConfig.getMultiple(commonKeys);
    
    // 更新缓存
    configCache = {
      ...configCache,
      ...configs
    };

    logger.debug('站点配置缓存已刷新', { configCount: Object.keys(configs).length });
  } catch (error) {
    logger.error('刷新配置缓存失败', { error: error.message });
    // 如果刷新失败，保持现有缓存
  }
}

/**
 * 手动刷新配置缓存
 * 可以在配置更新后调用此方法立即刷新缓存
 */
function invalidateCache() {
  lastCacheUpdate = 0;
  logger.info('站点配置缓存已失效，下次请求时将重新加载');
}

/**
 * 获取当前缓存的配置
 */
function getCachedConfig() {
  return { ...configCache };
}

/**
 * 初始化配置缓存
 * 在应用启动时调用
 */
async function initializeCache() {
  try {
    await refreshConfigCache();
    lastCacheUpdate = Date.now();
    logger.info('站点配置缓存初始化完成');
  } catch (error) {
    logger.error('站点配置缓存初始化失败', { error: error.message });
    // 设置默认配置
    configCache = {
      site_name: 'Telegram卡密销售系统',
      site_description: '专业的卡密销售平台',
      welcome_message: '欢迎使用卡密销售系统！',
      auto_delivery: true,
      order_timeout_minutes: 30,
      card_expire_hours: 24
    };
  }
}

module.exports = {
  siteConfigMiddleware,
  refreshConfigCache,
  invalidateCache,
  getCachedConfig,
  initializeCache
};
