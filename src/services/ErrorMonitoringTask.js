const cron = require('node-cron');
const logger = require('../utils/logger');
const ErrorLogger = require('../utils/ErrorLogger');
const performanceMonitor = require('./PerformanceMonitor');

/**
 * 错误监控定时任务
 * 定期检查系统错误趋势和性能指标
 */
class ErrorMonitoringTask {
  constructor() {
    this.isRunning = false;
    this.tasks = [];
  }

  /**
   * 启动监控任务
   */
  start() {
    if (this.isRunning) {
      logger.warn('错误监控任务已在运行');
      return;
    }

    logger.info('启动错误监控任务');
    this.isRunning = true;

    // 每15分钟检查错误趋势
    const errorTrendTask = cron.schedule('*/15 * * * *', async () => {
      await this.checkErrorTrends();
    }, {
      scheduled: false
    });

    // 每小时生成错误摘要
    const errorSummaryTask = cron.schedule('0 * * * *', async () => {
      await this.generateHourlyErrorSummary();
    }, {
      scheduled: false
    });

    // 每天生成性能报告
    const performanceReportTask = cron.schedule('0 0 * * *', async () => {
      await this.generateDailyPerformanceReport();
    }, {
      scheduled: false
    });

    // 每5分钟清理过期数据
    const cleanupTask = cron.schedule('*/5 * * * *', async () => {
      await this.cleanupExpiredData();
    }, {
      scheduled: false
    });

    this.tasks = [
      { name: 'errorTrend', task: errorTrendTask },
      { name: 'errorSummary', task: errorSummaryTask },
      { name: 'performanceReport', task: performanceReportTask },
      { name: 'cleanup', task: cleanupTask }
    ];

    // 启动所有任务
    this.tasks.forEach(({ name, task }) => {
      task.start();
      logger.info(`错误监控子任务启动: ${name}`);
    });
  }

  /**
   * 停止监控任务
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('停止错误监控任务');
    this.isRunning = false;

    this.tasks.forEach(({ name, task }) => {
      task.stop();
      logger.info(`错误监控子任务停止: ${name}`);
    });

    this.tasks = [];
  }

  /**
   * 检查错误趋势
   */
  async checkErrorTrends() {
    try {
      logger.debug('开始检查错误趋势');

      const { summary, alerts } = await ErrorLogger.checkErrorTrends(900000); // 15分钟

      if (alerts.length > 0) {
        logger.warn('错误趋势告警', {
          alertCount: alerts.length,
          totalErrors: summary.totalErrors,
          alerts: alerts.map(alert => ({
            type: alert.type,
            severity: alert.severity,
            message: alert.message
          }))
        });

        // 发送告警通知（可以集成邮件、短信等）
        await this.sendAlerts(alerts, summary);
      } else {
        logger.debug('错误趋势检查完成，无异常');
      }

    } catch (error) {
      logger.error('错误趋势检查失败', { error: error.message });
    }
  }

  /**
   * 生成小时错误摘要
   */
  async generateHourlyErrorSummary() {
    try {
      logger.debug('生成小时错误摘要');

      const summary = await ErrorLogger.generateErrorSummary(3600000); // 1小时

      logger.info('小时错误摘要', {
        timeRange: summary.timeRange,
        totalErrors: summary.totalErrors,
        topCategories: Object.entries(summary.errorsByCategory).slice(0, 3),
        topOperations: Object.entries(summary.errorsByOperation).slice(0, 3)
      });

      // 如果错误数量超过阈值，记录警告
      if (summary.totalErrors > 20) {
        logger.warn('小时错误数量过高', {
          totalErrors: summary.totalErrors,
          threshold: 20
        });
      }

    } catch (error) {
      logger.error('生成小时错误摘要失败', { error: error.message });
    }
  }

  /**
   * 生成每日性能报告
   */
  async generateDailyPerformanceReport() {
    try {
      logger.debug('生成每日性能报告');

      // 获取24小时的性能统计
      const performanceStats = performanceMonitor.getPerformanceStats(86400000); // 24小时
      const urlStats = performanceMonitor.getUrlStats(86400000);

      // 获取24小时的错误摘要
      const errorSummary = await ErrorLogger.generateErrorSummary(86400000);

      const report = {
        date: new Date().toISOString().split('T')[0],
        performance: performanceStats,
        topUrls: Object.entries(urlStats).slice(0, 5),
        errors: {
          total: errorSummary.totalErrors,
          byCategory: errorSummary.errorsByCategory,
          topErrors: Object.entries(errorSummary.topErrors).slice(0, 5)
        }
      };

      logger.info('每日性能报告', report);

      // 可以将报告保存到文件或发送邮件
      await this.savePerformanceReport(report);

    } catch (error) {
      logger.error('生成每日性能报告失败', { error: error.message });
    }
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData() {
    try {
      logger.debug('开始清理过期数据');

      // 清理性能监控数据
      performanceMonitor.cleanup(86400000); // 保留24小时

      logger.debug('过期数据清理完成');

    } catch (error) {
      logger.error('清理过期数据失败', { error: error.message });
    }
  }

  /**
   * 发送告警通知
   */
  async sendAlerts(alerts, summary) {
    try {
      // 这里可以集成各种通知方式
      // 例如：邮件、短信、Webhook等

      logger.info('发送错误告警通知', {
        alertCount: alerts.length,
        highSeverityCount: alerts.filter(a => a.severity === 'high').length,
        mediumSeverityCount: alerts.filter(a => a.severity === 'medium').length
      });

      // 示例：记录到特殊的告警日志
      alerts.forEach(alert => {
        logger.warn(`[ALERT] ${alert.type}: ${alert.message}`, {
          severity: alert.severity,
          summary: {
            totalErrors: summary.totalErrors,
            timeRange: summary.timeRange
          }
        });
      });

    } catch (error) {
      logger.error('发送告警通知失败', { error: error.message });
    }
  }

  /**
   * 保存性能报告
   */
  async savePerformanceReport(report) {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      const reportsDir = path.join(process.cwd(), 'logs', 'reports');
      
      // 确保目录存在
      try {
        await fs.access(reportsDir);
      } catch {
        await fs.mkdir(reportsDir, { recursive: true });
      }

      const filename = `performance-report-${report.date}.json`;
      const filepath = path.join(reportsDir, filename);

      await fs.writeFile(filepath, JSON.stringify(report, null, 2));

      logger.info('性能报告已保存', { filepath });

    } catch (error) {
      logger.error('保存性能报告失败', { error: error.message });
    }
  }

  /**
   * 获取监控状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      taskCount: this.tasks.length,
      tasks: this.tasks.map(({ name }) => name)
    };
  }
}

// 创建全局实例
const errorMonitoringTask = new ErrorMonitoringTask();

module.exports = errorMonitoringTask;
