const SystemConfig = require('../../database/models/SystemConfig');
const logger = require('../../utils/logger');
const { invalidateCache } = require('../../middleware/siteConfig');

class SystemConfigController {
  // 获取所有配置
  static async getConfigs(req, res) {
    try {
      const { keys } = req.query;
      
      let options = {};
      if (keys) {
        options.keys = keys.split(',');
      }
      
      const configs = await SystemConfig.findAll(options);
      
      // 按分类组织配置
      const categorizedConfigs = SystemConfigController.categorizeConfigs(configs);
      
      res.json({
        success: true,
        data: {
          configs: configs.map(config => config.toJSON()),
          categorized: categorizedConfigs
        }
      });
      
    } catch (error) {
      logger.error('获取系统配置失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取系统配置失败',
        error: error.message
      });
    }
  }

  // 获取单个配置
  static async getConfig(req, res) {
    try {
      const { key } = req.params;
      const config = await SystemConfig.findByKey(key);
      
      if (!config) {
        return res.status(404).json({
          success: false,
          message: '配置项不存在'
        });
      }
      
      res.json({
        success: true,
        data: config.toJSON()
      });
      
    } catch (error) {
      logger.error('获取配置项失败', { key: req.params.key, error: error.message });
      res.status(500).json({
        success: false,
        message: '获取配置项失败',
        error: error.message
      });
    }
  }

  // 更新单个配置
  static async updateConfig(req, res) {
    try {
      const { key } = req.params;
      const { value, type, description } = req.body;
      
      if (value === undefined) {
        return res.status(400).json({
          success: false,
          message: '配置值不能为空'
        });
      }
      
      const config = await SystemConfig.set(key, value, type, description);

      // 如果是站点相关配置，立即失效缓存
      if (key.startsWith('site_') || key === 'welcome_message' || key === 'auto_delivery') {
        invalidateCache();
      }

      logger.info('更新系统配置成功', { key, value, type });

      res.json({
        success: true,
        message: '配置更新成功',
        data: config.toJSON()
      });
      
    } catch (error) {
      logger.error('更新配置失败', { key: req.params.key, error: error.message });
      res.status(500).json({
        success: false,
        message: '更新配置失败',
        error: error.message
      });
    }
  }

  // 批量更新配置
  static async batchUpdateConfigs(req, res) {
    try {
      const { configs } = req.body;
      
      if (!Array.isArray(configs)) {
        return res.status(400).json({
          success: false,
          message: '配置数据格式错误'
        });
      }
      
      const updatedConfigs = [];
      let shouldInvalidateCache = false;

      for (const configData of configs) {
        const { key, value, type, description } = configData;

        if (!key || value === undefined) {
          continue;
        }

        try {
          const config = await SystemConfig.set(key, value, type, description);
          updatedConfigs.push(config.toJSON());

          // 检查是否需要失效缓存
          if (key.startsWith('site_') || key === 'welcome_message' || key === 'auto_delivery') {
            shouldInvalidateCache = true;
          }
        } catch (error) {
          logger.warn('批量更新配置项失败', { key, error: error.message });
        }
      }

      // 如果有站点相关配置更新，失效缓存
      if (shouldInvalidateCache) {
        invalidateCache();
      }

      logger.info('批量更新系统配置成功', { count: updatedConfigs.length });
      
      res.json({
        success: true,
        message: `成功更新 ${updatedConfigs.length} 个配置项`,
        data: updatedConfigs
      });
      
    } catch (error) {
      logger.error('批量更新配置失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '批量更新配置失败',
        error: error.message
      });
    }
  }

  // 创建新配置
  static async createConfig(req, res) {
    try {
      const { key, value, type = 'string', description = '' } = req.body;
      
      if (!key || value === undefined) {
        return res.status(400).json({
          success: false,
          message: '配置键和值为必填字段'
        });
      }
      
      // 检查配置是否已存在
      const existingConfig = await SystemConfig.findByKey(key);
      if (existingConfig) {
        return res.status(400).json({
          success: false,
          message: '配置项已存在'
        });
      }
      
      const config = await SystemConfig.create({
        config_key: key,
        config_value: value,
        config_type: type,
        description
      });
      
      logger.info('创建系统配置成功', { key, type });
      
      res.status(201).json({
        success: true,
        message: '配置创建成功',
        data: config.toJSON()
      });
      
    } catch (error) {
      logger.error('创建配置失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '创建配置失败',
        error: error.message
      });
    }
  }

  // 删除配置
  static async deleteConfig(req, res) {
    try {
      const { key } = req.params;
      const config = await SystemConfig.findByKey(key);
      
      if (!config) {
        return res.status(404).json({
          success: false,
          message: '配置项不存在'
        });
      }
      
      await config.delete();
      
      logger.info('删除系统配置成功', { key });
      
      res.json({
        success: true,
        message: '配置删除成功'
      });
      
    } catch (error) {
      logger.error('删除配置失败', { key: req.params.key, error: error.message });
      res.status(500).json({
        success: false,
        message: '删除配置失败',
        error: error.message
      });
    }
  }

  // 清除配置缓存
  static async clearCache(req, res) {
    try {
      SystemConfig.clearCache();
      
      logger.info('清除配置缓存成功');
      
      res.json({
        success: true,
        message: '配置缓存清除成功'
      });
      
    } catch (error) {
      logger.error('清除配置缓存失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '清除配置缓存失败',
        error: error.message
      });
    }
  }

  // 配置分类
  static categorizeConfigs(configs) {
    const categories = {
      basic: {
        name: '基础设置',
        icon: 'fas fa-cog',
        configs: []
      },
      payment: {
        name: '支付设置',
        icon: 'fas fa-credit-card',
        configs: []
      },
      bot: {
        name: 'Bot设置',
        icon: 'fas fa-robot',
        configs: []
      },
      system: {
        name: '系统设置',
        icon: 'fas fa-server',
        configs: []
      },
      other: {
        name: '其他设置',
        icon: 'fas fa-ellipsis-h',
        configs: []
      }
    };

    configs.forEach(config => {
      const key = config.config_key;
      
      if (key.includes('site_') || key.includes('welcome_') || key.includes('auto_')) {
        categories.basic.configs.push(config.toJSON());
      } else if (key.includes('usdt_') || key.includes('alipay_') || key.includes('payment_')) {
        categories.payment.configs.push(config.toJSON());
      } else if (key.includes('bot_') || key.includes('telegram_')) {
        categories.bot.configs.push(config.toJSON());
      } else if (key.includes('order_') || key.includes('card_') || key.includes('timeout_')) {
        categories.system.configs.push(config.toJSON());
      } else {
        categories.other.configs.push(config.toJSON());
      }
    });

    return categories;
  }
}

module.exports = SystemConfigController;
