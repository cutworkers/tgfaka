const cron = require('node-cron');
const USDTService = require('./payment/usdtService');
const OrderService = require('./orderService');
const Card = require('../database/models/Card');
const logger = require('../utils/logger');

class Scheduler {
  constructor() {
    this.usdtService = new USDTService();
    this.orderService = new OrderService();
    this.jobs = new Map();
  }

  // 启动所有定时任务
  start() {
    try {
      // 每分钟监控USDT支付
      this.scheduleUSDTMonitoring();
      
      // 每5分钟处理过期订单
      this.scheduleExpiredOrdersCleanup();
      
      // 每小时更新过期卡密
      this.scheduleExpiredCardsUpdate();
      
      // 每天生成统计报告
      this.scheduleDailyReport();

      logger.info('定时任务启动成功');
    } catch (error) {
      logger.error('定时任务启动失败', { error: error.message });
    }
  }

  // 停止所有定时任务
  stop() {
    try {
      this.jobs.forEach((job, name) => {
        job.stop();
        logger.info('定时任务已停止', { name });
      });
      
      this.jobs.clear();
      logger.info('所有定时任务已停止');
    } catch (error) {
      logger.error('停止定时任务失败', { error: error.message });
    }
  }

  // USDT支付监控
  scheduleUSDTMonitoring() {
    const job = cron.schedule('*/1 * * * *', async () => {
      try {
        await this.usdtService.monitorPayments();
      } catch (error) {
        logger.error('USDT支付监控任务失败', { error: error.message });
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    this.jobs.set('usdt_monitoring', job);
    job.start();
    logger.info('USDT支付监控任务已启动 (每分钟执行)');
  }

  // 过期订单清理
  scheduleExpiredOrdersCleanup() {
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        const expiredCount = await this.orderService.handleExpiredOrders();
        if (expiredCount > 0) {
          logger.info('过期订单清理完成', { count: expiredCount });
        }
      } catch (error) {
        logger.error('过期订单清理任务失败', { error: error.message });
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    this.jobs.set('expired_orders_cleanup', job);
    job.start();
    logger.info('过期订单清理任务已启动 (每5分钟执行)');
  }

  // 过期卡密更新
  scheduleExpiredCardsUpdate() {
    const job = cron.schedule('0 * * * *', async () => {
      try {
        const expiredCount = await Card.updateExpiredCards();
        if (expiredCount > 0) {
          logger.info('过期卡密更新完成', { count: expiredCount });
        }
      } catch (error) {
        logger.error('过期卡密更新任务失败', { error: error.message });
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    this.jobs.set('expired_cards_update', job);
    job.start();
    logger.info('过期卡密更新任务已启动 (每小时执行)');
  }

  // 每日统计报告
  scheduleDailyReport() {
    const job = cron.schedule('0 0 * * *', async () => {
      try {
        await this.generateDailyReport();
      } catch (error) {
        logger.error('每日统计报告任务失败', { error: error.message });
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    this.jobs.set('daily_report', job);
    job.start();
    logger.info('每日统计报告任务已启动 (每天0点执行)');
  }

  // 生成每日统计报告
  async generateDailyReport() {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const dateFrom = yesterday.toISOString().split('T')[0] + ' 00:00:00';
      const dateTo = yesterday.toISOString().split('T')[0] + ' 23:59:59';

      // 获取订单统计
      const orderStats = await this.orderService.getOrderStats({
        date_from: dateFrom,
        date_to: dateTo
      });

      // 获取卡密统计
      const cardStats = await Card.getStats();

      const report = {
        date: yesterday.toISOString().split('T')[0],
        orders: {
          total: orderStats.total,
          completed: orderStats.completed,
          revenue: orderStats.total_revenue,
          pending: orderStats.pending,
          cancelled: orderStats.cancelled,
          expired: orderStats.expired
        },
        cards: {
          total: cardStats.total,
          available: cardStats.available,
          sold: cardStats.sold,
          expired: cardStats.expired
        },
        generated_at: new Date().toISOString()
      };

      logger.info('每日统计报告', report);

      // 这里可以发送报告到邮箱或其他通知渠道
      await this.sendDailyReport(report);

    } catch (error) {
      logger.error('生成每日统计报告失败', { error: error.message });
    }
  }

  // 发送每日报告
  async sendDailyReport(report) {
    try {
      // 这里可以集成邮件发送、钉钉通知等
      logger.info('每日报告已生成', {
        date: report.date,
        revenue: report.orders.revenue,
        completedOrders: report.orders.completed
      });
    } catch (error) {
      logger.error('发送每日报告失败', { error: error.message });
    }
  }

  // 手动执行USDT监控
  async manualUSDTCheck() {
    try {
      logger.info('手动执行USDT支付监控');
      await this.usdtService.monitorPayments();
      return { success: true, message: 'USDT监控执行完成' };
    } catch (error) {
      logger.error('手动USDT监控失败', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  // 手动清理过期订单
  async manualExpiredOrdersCleanup() {
    try {
      logger.info('手动执行过期订单清理');
      const expiredCount = await this.orderService.handleExpiredOrders();
      return { 
        success: true, 
        message: `清理了${expiredCount}个过期订单`,
        count: expiredCount 
      };
    } catch (error) {
      logger.error('手动过期订单清理失败', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  // 获取任务状态
  getJobsStatus() {
    const status = {};
    
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    });

    return status;
  }

  // 重启特定任务
  restartJob(jobName) {
    try {
      const job = this.jobs.get(jobName);
      if (job) {
        job.stop();
        job.start();
        logger.info('定时任务重启成功', { jobName });
        return { success: true, message: `任务${jobName}重启成功` };
      } else {
        return { success: false, message: '任务不存在' };
      }
    } catch (error) {
      logger.error('重启定时任务失败', { error: error.message, jobName });
      return { success: false, message: error.message };
    }
  }

  // 停止特定任务
  stopJob(jobName) {
    try {
      const job = this.jobs.get(jobName);
      if (job) {
        job.stop();
        logger.info('定时任务停止成功', { jobName });
        return { success: true, message: `任务${jobName}停止成功` };
      } else {
        return { success: false, message: '任务不存在' };
      }
    } catch (error) {
      logger.error('停止定时任务失败', { error: error.message, jobName });
      return { success: false, message: error.message };
    }
  }
}

module.exports = Scheduler;
