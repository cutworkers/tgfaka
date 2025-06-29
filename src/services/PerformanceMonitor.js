const logger = require('../utils/logger');
const OperationLogService = require('./OperationLogService');

/**
 * 性能监控服务
 * 监控POST API调用的性能指标
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.apiCallHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * 记录API调用开始
   * @param {string} callId - 调用ID
   * @param {Object} callInfo - 调用信息
   */
  startApiCall(callId, callInfo) {
    const startTime = Date.now();
    
    this.metrics.set(callId, {
      ...callInfo,
      startTime,
      status: 'started'
    });

    logger.debug('API调用开始监控', {
      callId,
      url: callInfo.url,
      orderId: callInfo.orderId,
      startTime
    });
  }

  /**
   * 记录API调用结束
   * @param {string} callId - 调用ID
   * @param {Object} result - 调用结果
   */
  endApiCall(callId, result) {
    const endTime = Date.now();
    const callData = this.metrics.get(callId);
    
    if (!callData) {
      logger.warn('未找到API调用记录', { callId });
      return;
    }

    const duration = endTime - callData.startTime;
    const finalData = {
      ...callData,
      endTime,
      duration,
      success: result.success,
      responseStatus: result.responseStatus,
      responseSize: result.responseSize,
      error: result.error,
      status: 'completed'
    };

    // 更新指标
    this.metrics.set(callId, finalData);

    // 添加到历史记录
    this.addToHistory(finalData);

    // 记录性能日志
    logger.info('API调用性能监控', {
      callId,
      url: callData.url,
      orderId: callData.orderId,
      duration,
      success: result.success,
      responseStatus: result.responseStatus,
      responseSize: result.responseSize
    });

    // 记录操作日志
    this.recordOperationLog(finalData);

    // 检查性能阈值
    this.checkPerformanceThresholds(finalData);

    // 清理内存
    this.metrics.delete(callId);
  }

  /**
   * 添加到历史记录
   */
  addToHistory(callData) {
    this.apiCallHistory.push({
      timestamp: callData.endTime,
      url: callData.url,
      orderId: callData.orderId,
      productId: callData.productId,
      duration: callData.duration,
      success: callData.success,
      responseStatus: callData.responseStatus,
      responseSize: callData.responseSize,
      error: callData.error
    });

    // 保持历史记录大小
    if (this.apiCallHistory.length > this.maxHistorySize) {
      this.apiCallHistory.shift();
    }
  }

  /**
   * 记录操作日志
   */
  async recordOperationLog(callData) {
    try {
      await OperationLogService.logPostApiCall({
        orderId: callData.orderId,
        productId: callData.productId,
        url: callData.url,
        method: 'POST',
        requestTimeMs: callData.duration,
        responseStatus: callData.responseStatus,
        responseSize: callData.responseSize,
        success: callData.success,
        error: callData.error,
        errorCode: callData.errorCode
      });
    } catch (error) {
      logger.warn('性能监控操作日志记录失败', { error: error.message });
    }
  }

  /**
   * 检查性能阈值
   */
  checkPerformanceThresholds(callData) {
    const { duration, success, url } = callData;

    // 响应时间阈值检查
    if (duration > 10000) { // 10秒
      logger.warn('API响应时间过长', {
        url,
        orderId: callData.orderId,
        duration,
        threshold: 10000
      });
    } else if (duration > 5000) { // 5秒
      logger.info('API响应时间较长', {
        url,
        orderId: callData.orderId,
        duration,
        threshold: 5000
      });
    }

    // 失败率检查
    if (!success) {
      const recentCalls = this.getRecentCalls(url, 10);
      const failureRate = recentCalls.filter(call => !call.success).length / recentCalls.length;
      
      if (failureRate > 0.5) { // 失败率超过50%
        logger.error('API失败率过高', {
          url,
          failureRate: (failureRate * 100).toFixed(2) + '%',
          recentCallsCount: recentCalls.length
        });
      }
    }
  }

  /**
   * 获取最近的API调用记录
   */
  getRecentCalls(url, count = 10) {
    return this.apiCallHistory
      .filter(call => call.url === url)
      .slice(-count);
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(timeRange = 3600000) { // 默认1小时
    const now = Date.now();
    const startTime = now - timeRange;
    
    const recentCalls = this.apiCallHistory.filter(
      call => call.timestamp >= startTime
    );

    if (recentCalls.length === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0
      };
    }

    const successfulCalls = recentCalls.filter(call => call.success);
    const durations = recentCalls.map(call => call.duration);

    return {
      totalCalls: recentCalls.length,
      successfulCalls: successfulCalls.length,
      failedCalls: recentCalls.length - successfulCalls.length,
      successRate: (successfulCalls.length / recentCalls.length * 100).toFixed(2) + '%',
      averageResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      maxResponseTime: Math.max(...durations),
      minResponseTime: Math.min(...durations),
      timeRange: timeRange / 1000 / 60 + ' minutes'
    };
  }

  /**
   * 获取URL统计
   */
  getUrlStats(timeRange = 3600000) {
    const now = Date.now();
    const startTime = now - timeRange;
    
    const recentCalls = this.apiCallHistory.filter(
      call => call.timestamp >= startTime
    );

    const urlStats = {};
    
    recentCalls.forEach(call => {
      if (!urlStats[call.url]) {
        urlStats[call.url] = {
          totalCalls: 0,
          successfulCalls: 0,
          totalDuration: 0,
          maxDuration: 0,
          minDuration: Infinity
        };
      }

      const stats = urlStats[call.url];
      stats.totalCalls++;
      stats.totalDuration += call.duration;
      stats.maxDuration = Math.max(stats.maxDuration, call.duration);
      stats.minDuration = Math.min(stats.minDuration, call.duration);
      
      if (call.success) {
        stats.successfulCalls++;
      }
    });

    // 计算平均值和成功率
    Object.keys(urlStats).forEach(url => {
      const stats = urlStats[url];
      stats.averageDuration = Math.round(stats.totalDuration / stats.totalCalls);
      stats.successRate = (stats.successfulCalls / stats.totalCalls * 100).toFixed(2) + '%';
      stats.minDuration = stats.minDuration === Infinity ? 0 : stats.minDuration;
      delete stats.totalDuration; // 清理临时字段
    });

    return urlStats;
  }

  /**
   * 清理过期数据
   */
  cleanup(maxAge = 86400000) { // 默认24小时
    const cutoff = Date.now() - maxAge;
    this.apiCallHistory = this.apiCallHistory.filter(
      call => call.timestamp >= cutoff
    );

    logger.debug('性能监控数据清理完成', {
      remainingRecords: this.apiCallHistory.length,
      maxAge: maxAge / 1000 / 60 / 60 + ' hours'
    });
  }
}

// 创建全局实例
const performanceMonitor = new PerformanceMonitor();

// 定期清理数据
setInterval(() => {
  performanceMonitor.cleanup();
}, 3600000); // 每小时清理一次

module.exports = performanceMonitor;
