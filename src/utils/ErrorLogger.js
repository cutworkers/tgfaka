const logger = require('./logger');
const OperationLogService = require('../services/OperationLogService');

/**
 * 增强的错误日志记录器
 * 提供更详细的错误上下文信息，便于问题排查
 */
class ErrorLogger {
  /**
   * 记录详细的错误信息
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   * @param {string} context.operation - 操作名称
   * @param {Object} context.user - 用户信息
   * @param {Object} context.request - 请求信息
   * @param {Object} context.data - 相关数据
   */
  static async logError(error, context = {}) {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorInfo = {
      errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      ...context
    };

    // 记录到应用日志
    logger.error('详细错误信息', errorInfo);

    // 记录到操作日志（如果有用户上下文）
    if (context.user || context.operation) {
      try {
        await OperationLogService.log({
          user_type: context.user?.type || 'system',
          user_id: context.user?.id,
          action: 'error_occurred',
          target_type: 'system',
          target_id: null,
          details: {
            errorId,
            operation: context.operation,
            errorMessage: error.message,
            errorCode: error.code,
            requestPath: context.request?.path,
            requestMethod: context.request?.method
          },
          ip_address: context.request?.ip,
          user_agent: context.request?.userAgent
        });
      } catch (logError) {
        logger.warn('操作日志记录失败', { error: logError.message });
      }
    }

    return errorId;
  }

  /**
   * 记录商品相关错误
   */
  static async logProductError(error, productData, operation, userInfo = {}, requestInfo = {}) {
    return await this.logError(error, {
      operation: `product_${operation}`,
      category: 'product',
      user: userInfo,
      request: requestInfo,
      data: {
        productId: productData?.id,
        productName: productData?.name,
        productType: productData?.type,
        hasPostData: !!productData?.post_data
      }
    });
  }

  /**
   * 记录发卡相关错误
   */
  static async logDeliveryError(error, deliveryData, userInfo = {}) {
    return await this.logError(error, {
      operation: 'card_delivery',
      category: 'delivery',
      user: userInfo,
      data: {
        deliveryId: deliveryData?.deliveryId,
        orderId: deliveryData?.orderId,
        productId: deliveryData?.productId,
        productType: deliveryData?.productType,
        quantity: deliveryData?.quantity,
        deliveryMethod: deliveryData?.deliveryMethod
      }
    });
  }

  /**
   * 记录API调用错误
   */
  static async logApiError(error, apiData, userInfo = {}) {
    return await this.logError(error, {
      operation: 'api_call',
      category: 'external_api',
      user: userInfo,
      data: {
        apiUrl: apiData?.url,
        apiMethod: apiData?.method || 'POST',
        orderId: apiData?.orderId,
        productId: apiData?.productId,
        requestTime: apiData?.requestTime,
        responseStatus: apiData?.responseStatus,
        timeout: apiData?.timeout
      }
    });
  }

  /**
   * 记录数据库错误
   */
  static async logDatabaseError(error, operation, data = {}, userInfo = {}) {
    return await this.logError(error, {
      operation: `database_${operation}`,
      category: 'database',
      user: userInfo,
      data: {
        table: data.table,
        query: data.query,
        params: data.params,
        affectedRows: data.affectedRows
      }
    });
  }

  /**
   * 记录支付相关错误
   */
  static async logPaymentError(error, paymentData, userInfo = {}) {
    return await this.logError(error, {
      operation: 'payment_processing',
      category: 'payment',
      user: userInfo,
      data: {
        orderId: paymentData?.orderId,
        paymentMethod: paymentData?.paymentMethod,
        amount: paymentData?.amount,
        currency: paymentData?.currency,
        transactionId: paymentData?.transactionId,
        gateway: paymentData?.gateway
      }
    });
  }

  /**
   * 记录认证相关错误
   */
  static async logAuthError(error, authData, requestInfo = {}) {
    return await this.logError(error, {
      operation: 'authentication',
      category: 'security',
      request: requestInfo,
      data: {
        authType: authData?.type,
        username: authData?.username,
        attemptCount: authData?.attemptCount,
        lastAttempt: authData?.lastAttempt
      }
    });
  }

  /**
   * 记录配置相关错误
   */
  static async logConfigError(error, configData, userInfo = {}) {
    return await this.logError(error, {
      operation: 'configuration',
      category: 'config',
      user: userInfo,
      data: {
        configKey: configData?.key,
        configType: configData?.type,
        configValue: configData?.value ? '[HIDDEN]' : null,
        operation: configData?.operation
      }
    });
  }

  /**
   * 创建错误摘要报告
   */
  static async generateErrorSummary(timeRange = 3600000) { // 默认1小时
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeRange);

    try {
      const logs = await OperationLogService.getLogs({
        action: 'error_occurred',
        start_date: startTime.toISOString(),
        end_date: endTime.toISOString(),
        limit: 1000
      });

      const summary = {
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          durationMinutes: timeRange / 60000
        },
        totalErrors: logs.length,
        errorsByCategory: {},
        errorsByOperation: {},
        topErrors: {},
        recentErrors: logs.slice(0, 10)
      };

      // 按分类统计
      logs.forEach(log => {
        const category = log.details?.category || 'unknown';
        summary.errorsByCategory[category] = (summary.errorsByCategory[category] || 0) + 1;
      });

      // 按操作统计
      logs.forEach(log => {
        const operation = log.details?.operation || 'unknown';
        summary.errorsByOperation[operation] = (summary.errorsByOperation[operation] || 0) + 1;
      });

      // 按错误消息统计
      logs.forEach(log => {
        const message = log.details?.errorMessage || 'unknown';
        summary.topErrors[message] = (summary.topErrors[message] || 0) + 1;
      });

      // 排序
      summary.errorsByCategory = Object.fromEntries(
        Object.entries(summary.errorsByCategory).sort(([,a], [,b]) => b - a)
      );
      summary.errorsByOperation = Object.fromEntries(
        Object.entries(summary.errorsByOperation).sort(([,a], [,b]) => b - a)
      );
      summary.topErrors = Object.fromEntries(
        Object.entries(summary.topErrors).sort(([,a], [,b]) => b - a).slice(0, 10)
      );

      return summary;

    } catch (error) {
      logger.error('生成错误摘要失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 检查错误趋势
   */
  static async checkErrorTrends(timeRange = 3600000) {
    try {
      const summary = await this.generateErrorSummary(timeRange);
      const alerts = [];

      // 检查错误率
      if (summary.totalErrors > 50) {
        alerts.push({
          type: 'high_error_count',
          message: `错误数量过高: ${summary.totalErrors} 个错误在 ${timeRange/60000} 分钟内`,
          severity: 'high'
        });
      }

      // 检查特定类别错误
      Object.entries(summary.errorsByCategory).forEach(([category, count]) => {
        if (count > 20) {
          alerts.push({
            type: 'category_error_spike',
            message: `${category} 类别错误激增: ${count} 个`,
            severity: 'medium'
          });
        }
      });

      // 检查重复错误
      Object.entries(summary.topErrors).forEach(([message, count]) => {
        if (count > 10) {
          alerts.push({
            type: 'repeated_error',
            message: `重复错误: "${message}" 出现 ${count} 次`,
            severity: 'medium'
          });
        }
      });

      if (alerts.length > 0) {
        logger.warn('错误趋势告警', { alerts, summary });
      }

      return { summary, alerts };

    } catch (error) {
      logger.error('错误趋势检查失败', { error: error.message });
      throw error;
    }
  }
}

module.exports = ErrorLogger;
