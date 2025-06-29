const databaseService = require('../database');
const logger = require('../utils/logger');

/**
 * 操作日志服务
 * 记录系统中的重要操作，特别是商品类型相关的操作
 */
class OperationLogService {
  /**
   * 记录操作日志
   * @param {Object} logData - 日志数据
   * @param {string} logData.user_type - 用户类型 ('user' | 'admin')
   * @param {number} logData.user_id - 用户ID
   * @param {string} logData.action - 操作类型
   * @param {string} logData.target_type - 目标类型 ('product' | 'order' | 'card' 等)
   * @param {number} logData.target_id - 目标ID
   * @param {Object} logData.details - 详细信息
   * @param {string} logData.ip_address - IP地址
   * @param {string} logData.user_agent - 用户代理
   */
  static async log(logData) {
    try {
      const {
        user_type,
        user_id,
        action,
        target_type,
        target_id,
        details = {},
        ip_address,
        user_agent
      } = logData;

      // 验证必填字段
      if (!user_type || !action) {
        throw new Error('user_type和action为必填字段');
      }

      // 插入操作日志
      const result = await databaseService.run(
        `INSERT INTO operation_logs (
          user_type, user_id, action, target_type, target_id, 
          details, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          user_type,
          user_id,
          action,
          target_type,
          target_id,
          JSON.stringify(details),
          ip_address,
          user_agent
        ]
      );

      // 同时记录到应用日志
      logger.info('操作日志记录', {
        logId: result.id,
        userType: user_type,
        userId: user_id,
        action,
        targetType: target_type,
        targetId: target_id,
        details,
        ipAddress: ip_address
      });

      return result.id;

    } catch (error) {
      logger.error('操作日志记录失败', {
        error: error.message,
        logData
      });
      throw error;
    }
  }

  /**
   * 记录商品相关操作
   */
  static async logProductOperation(action, productData, userInfo = {}, additionalDetails = {}) {
    const details = {
      productName: productData.name,
      productType: productData.type,
      productPrice: productData.price,
      ...additionalDetails
    };

    if (productData.type === 'post' && productData.post_data) {
      try {
        const postConfig = JSON.parse(productData.post_data);
        details.postApiUrl = postConfig.url;
        details.hasPostConfig = true;
      } catch (error) {
        details.hasPostConfig = false;
        details.postConfigError = error.message;
      }
    }

    return await this.log({
      user_type: userInfo.user_type || 'admin',
      user_id: userInfo.user_id,
      action: `product_${action}`,
      target_type: 'product',
      target_id: productData.id,
      details,
      ip_address: userInfo.ip_address,
      user_agent: userInfo.user_agent
    });
  }

  /**
   * 记录发卡操作
   */
  static async logCardDelivery(deliveryData, userInfo = {}) {
    const details = {
      orderId: deliveryData.orderId,
      productId: deliveryData.productId,
      productName: deliveryData.productName,
      productType: deliveryData.productType,
      deliveryMethod: deliveryData.deliveryMethod,
      requestedQuantity: deliveryData.requestedQuantity,
      deliveredQuantity: deliveryData.deliveredQuantity,
      executionTimeMs: deliveryData.executionTimeMs,
      success: deliveryData.success
    };

    if (deliveryData.productType === 'post') {
      details.apiUrl = deliveryData.apiUrl;
      details.apiResponseTime = deliveryData.apiResponseTime;
    }

    if (!deliveryData.success && deliveryData.error) {
      details.error = deliveryData.error;
    }

    return await this.log({
      user_type: userInfo.user_type || 'user',
      user_id: userInfo.user_id,
      action: 'card_delivery',
      target_type: 'order',
      target_id: deliveryData.orderId,
      details,
      ip_address: userInfo.ip_address,
      user_agent: userInfo.user_agent
    });
  }

  /**
   * 记录POST API调用
   */
  static async logPostApiCall(apiData, userInfo = {}) {
    const details = {
      orderId: apiData.orderId,
      productId: apiData.productId,
      apiUrl: apiData.url,
      httpMethod: apiData.method || 'POST',
      requestTimeMs: apiData.requestTimeMs,
      responseStatus: apiData.responseStatus,
      responseSize: apiData.responseSize,
      success: apiData.success
    };

    if (!apiData.success && apiData.error) {
      details.error = apiData.error;
      details.errorCode = apiData.errorCode;
    }

    return await this.log({
      user_type: userInfo.user_type || 'system',
      user_id: userInfo.user_id,
      action: 'post_api_call',
      target_type: 'api',
      target_id: apiData.productId,
      details,
      ip_address: userInfo.ip_address,
      user_agent: userInfo.user_agent
    });
  }

  /**
   * 获取操作日志
   */
  static async getLogs(options = {}) {
    const {
      user_type,
      user_id,
      action,
      target_type,
      target_id,
      start_date,
      end_date,
      limit = 100,
      offset = 0
    } = options;

    let sql = `
      SELECT * FROM operation_logs 
      WHERE 1=1
    `;
    const params = [];

    if (user_type) {
      sql += ' AND user_type = ?';
      params.push(user_type);
    }

    if (user_id) {
      sql += ' AND user_id = ?';
      params.push(user_id);
    }

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }

    if (target_type) {
      sql += ' AND target_type = ?';
      params.push(target_type);
    }

    if (target_id) {
      sql += ' AND target_id = ?';
      params.push(target_id);
    }

    if (start_date) {
      sql += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND created_at <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = await databaseService.query(sql, params);
    
    // 解析details字段
    return logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : {}
    }));
  }

  /**
   * 获取操作统计
   */
  static async getStatistics(options = {}) {
    const {
      start_date,
      end_date,
      user_type,
      action
    } = options;

    let sql = `
      SELECT 
        action,
        target_type,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM operation_logs 
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      sql += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND created_at <= ?';
      params.push(end_date);
    }

    if (user_type) {
      sql += ' AND user_type = ?';
      params.push(user_type);
    }

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }

    sql += ' GROUP BY action, target_type, DATE(created_at) ORDER BY date DESC, count DESC';

    return await databaseService.query(sql, params);
  }
}

module.exports = OperationLogService;
