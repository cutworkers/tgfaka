const databaseService = require('../index');

class SystemConfig {
  constructor(data = {}) {
    this.id = data.id;
    this.config_key = data.config_key;
    this.config_value = data.config_value;
    this.config_type = data.config_type || 'string';
    this.description = data.description;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 配置缓存
  static cache = new Map();

  // 根据key查找配置
  static async findByKey(key) {
    // 先检查缓存
    if (SystemConfig.cache.has(key)) {
      return SystemConfig.cache.get(key);
    }

    const row = await databaseService.get(
      'SELECT * FROM system_config WHERE config_key = ?',
      [key]
    );
    
    if (row) {
      const config = new SystemConfig(row);
      // 缓存配置
      SystemConfig.cache.set(key, config);
      return config;
    }
    
    return null;
  }

  // 获取所有配置
  static async findAll(options = {}) {
    let sql = 'SELECT * FROM system_config';
    const params = [];

    if (options.keys && Array.isArray(options.keys)) {
      const placeholders = options.keys.map(() => '?').join(',');
      sql += ` WHERE config_key IN (${placeholders})`;
      params.push(...options.keys);
    }

    sql += ' ORDER BY config_key ASC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      
      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = await databaseService.query(sql, params);
    const configs = rows.map(row => new SystemConfig(row));
    
    // 更新缓存
    configs.forEach(config => {
      SystemConfig.cache.set(config.config_key, config);
    });
    
    return configs;
  }

  // 创建或更新配置
  static async set(key, value, type = 'string', description = '') {
    const existingConfig = await SystemConfig.findByKey(key);
    
    if (existingConfig) {
      return await existingConfig.update({ 
        config_value: value, 
        config_type: type,
        description: description || existingConfig.description
      });
    } else {
      return await SystemConfig.create({
        config_key: key,
        config_value: value,
        config_type: type,
        description
      });
    }
  }

  // 获取配置值（自动类型转换）
  static async get(key, defaultValue = null) {
    const config = await SystemConfig.findByKey(key);
    
    if (!config) {
      return defaultValue;
    }
    
    return config.getParsedValue();
  }

  // 批量获取配置
  static async getMultiple(keys) {
    const configs = await SystemConfig.findAll({ keys });
    const result = {};
    
    keys.forEach(key => {
      const config = configs.find(c => c.config_key === key);
      result[key] = config ? config.getParsedValue() : null;
    });
    
    return result;
  }

  // 创建新配置
  static async create(configData) {
    const result = await databaseService.run(
      `INSERT INTO system_config (config_key, config_value, config_type, description)
       VALUES (?, ?, ?, ?)`,
      [
        configData.config_key,
        configData.config_value,
        configData.config_type || 'string',
        configData.description || ''
      ]
    );
    
    const config = await SystemConfig.findByKey(configData.config_key);
    return config;
  }

  // 更新配置
  async update(updateData) {
    const fields = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'id' && key !== 'config_key') {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });
    
    if (fields.length === 0) return this;
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(this.config_key);
    
    await databaseService.run(
      `UPDATE system_config SET ${fields.join(', ')} WHERE config_key = ?`,
      values
    );
    
    // 清除缓存
    SystemConfig.cache.delete(this.config_key);
    
    return await SystemConfig.findByKey(this.config_key);
  }

  // 删除配置
  async delete() {
    await databaseService.run('DELETE FROM system_config WHERE config_key = ?', [this.config_key]);
    
    // 清除缓存
    SystemConfig.cache.delete(this.config_key);
  }

  // 获取解析后的值
  getParsedValue() {
    if (!this.config_value) return null;
    
    switch (this.config_type) {
      case 'number':
        return parseFloat(this.config_value);
      case 'boolean':
        return this.config_value.toLowerCase() === 'true';
      case 'json':
        try {
          return JSON.parse(this.config_value);
        } catch (e) {
          return null;
        }
      case 'string':
      default:
        return this.config_value;
    }
  }

  // 设置值（自动类型转换）
  setValue(value) {
    switch (this.config_type) {
      case 'number':
        this.config_value = String(value);
        break;
      case 'boolean':
        this.config_value = String(Boolean(value));
        break;
      case 'json':
        this.config_value = JSON.stringify(value);
        break;
      case 'string':
      default:
        this.config_value = String(value);
        break;
    }
  }

  // 清除所有缓存
  static clearCache() {
    SystemConfig.cache.clear();
  }

  // 预加载常用配置到缓存
  static async preloadCache() {
    const commonKeys = [
      'site_name',
      'order_timeout_minutes',
      'card_expire_hours',
      'min_usdt_amount',
      'usdt_rate',
      'auto_delivery',
      'welcome_message'
    ];
    
    await SystemConfig.findAll({ keys: commonKeys });
  }

  // 转换为JSON对象
  toJSON() {
    return {
      id: this.id,
      config_key: this.config_key,
      config_value: this.config_value,
      config_type: this.config_type,
      description: this.description,
      parsed_value: this.getParsedValue(),
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  // 转换为安全的JSON对象（用于API响应）
  toSafeJSON() {
    return this.toJSON();
  }
}

module.exports = SystemConfig;
