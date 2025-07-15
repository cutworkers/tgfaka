const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');
const Order = require('../../database/models/Order');

class USDTService {
  constructor() {
    this.apiKey = config.usdt.apiKey;
    this.walletAddress = config.usdt.walletAddress;
    this.contractAddress = config.usdt.contractAddress;
    this.network = config.usdt.network;
    this.baseUrl = this.network === 'mainnet'
      ? 'https://api.trongrid.io'
      : 'https://api.shasta.trongrid.io';

    // 验证配置
    this.isConfigured = this.validateConfig();
  }

  // 验证USDT配置
  validateConfig() {
    const missingConfigs = [];

    if (!this.apiKey || this.apiKey === 'your_tron_api_key') {
      missingConfigs.push('TRON_API_KEY');
    }

    if (!this.walletAddress || this.walletAddress === 'your_usdt_wallet_address') {
      missingConfigs.push('USDT_WALLET_ADDRESS');
    }

    if (missingConfigs.length > 0) {
      logger.warn('USDT配置不完整', {
        missing: missingConfigs,
        message: '请在.env文件中配置正确的USDT参数'
      });
      return false;
    }

    return true;
  }

  // 获取USDT汇率
  async getUSDTRate() {
    try {
      // 这里可以接入实时汇率API，暂时使用配置中的固定汇率
      return parseFloat(config.usdt.rate || 6.5);
    } catch (error) {
      logger.error('获取USDT汇率失败', { error: error.message });
      return 6.5; // 默认汇率
    }
  }

  // 将人民币转换为USDT
  async convertCNYToUSDT(cnyAmount) {
    const rate = await this.getUSDTRate();
    return (cnyAmount / rate).toFixed(6);
  }

  // 将USDT转换为人民币
  async convertUSDTToCNY(usdtAmount) {
    const rate = await this.getUSDTRate();
    return (usdtAmount * rate).toFixed(2);
  }

  // 获取钱包余额
  async getWalletBalance() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/accounts/${this.walletAddress}/transactions/trc20`,
        {
          headers: {
            'TRON-PRO-API-KEY': this.apiKey
          },
          params: {
            contract_address: this.contractAddress,
            limit: 1
          }
        }
      );

      if (response.data.success) {
        // 这里需要根据实际API响应格式解析余额
        return response.data.data || [];
      }
      
      throw new Error('API响应失败');
    } catch (error) {
      logger.error('获取钱包余额失败', { error: error.message });
      throw error;
    }
  }

  // 获取交易记录
  async getTransactions(limit = 50, fingerprint = '') {
    try {
      // 检查配置是否完整
      if (!this.isConfigured) {
        logger.error('获取交易记录失败', {
          error: 'USDT配置不完整，请检查.env文件中的TRON_API_KEY和USDT_WALLET_ADDRESS配置'
        });
        return [];
      }

      const params = {
        limit,
        contract_address: this.contractAddress
      };

      if (fingerprint) {
        params.fingerprint = fingerprint;
      }

      const response = await axios.get(
        `${this.baseUrl}/v1/accounts/${this.walletAddress}/transactions/trc20`,
        {
          headers: {
            'TRON-PRO-API-KEY': this.apiKey
          },
          params
        }
      );

      if (response.data.success) {
        return response.data.data || [];
      }

      throw new Error('获取交易记录失败');
    } catch (error) {
      // 处理401未授权错误
      if (error.response && error.response.status === 401) {
        logger.error('获取交易记录失败', {
          error: 'API密钥无效或已过期，请更新TRON_API_KEY配置',
          status: 401
        });
      } else {
        logger.error('获取交易记录失败', { error: error.message });
      }
      return [];
    }
  }

  // 验证交易
  async verifyTransaction(txid) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/transactions/${txid}`,
        {
          headers: {
            'TRON-PRO-API-KEY': this.apiKey
          }
        }
      );

      if (response.data.success && response.data.data) {
        const transaction = response.data.data[0];
        return {
          success: true,
          confirmed: transaction.confirmed,
          block_height: transaction.blockNumber,
          confirmations: transaction.confirmations || 0,
          from: transaction.raw_data.contract[0].parameter.value.owner_address,
          to: transaction.raw_data.contract[0].parameter.value.to_address,
          amount: transaction.raw_data.contract[0].parameter.value.amount,
          timestamp: transaction.raw_data.timestamp
        };
      }
      
      return { success: false, message: '交易不存在' };
    } catch (error) {
      logger.error('验证交易失败', { error: error.message, txid });
      return { success: false, message: error.message };
    }
  }

  // 监控支付
  async monitorPayments() {
    try {
      logger.info('开始监控USDT支付');

      // 检查配置是否完整
      if (!this.isConfigured) {
        logger.warn('USDT支付监控跳过', {
          reason: 'USDT配置不完整，请检查.env文件中的TRON_API_KEY和USDT_WALLET_ADDRESS配置'
        });
        return;
      }

      // 获取待支付的USDT订单
      const pendingOrders = await this.getPendingUSDTOrders();

      if (pendingOrders.length === 0) {
        return;
      }

      // 获取最新交易记录
      const transactions = await this.getTransactions(100);

      // 如果获取交易记录失败，提前返回
      if (!transactions || transactions.length === 0) {
        logger.warn('USDT支付监控无法获取交易记录，跳过本次检查');
        return;
      }

      for (const order of pendingOrders) {
        await this.checkOrderPayment(order, transactions);
      }

    } catch (error) {
      logger.error('监控USDT支付失败', { error: error.message });
    }
  }

  // 获取待支付的USDT订单
  async getPendingUSDTOrders() {
    try {
      const orders = await Order.findAll({
        status: 'pending',
        payment_method: 'usdt'
      });
      
      // 过滤未过期的订单
      return orders.filter(order => !order.isExpired());
    } catch (error) {
      logger.error('获取待支付USDT订单失败', { error: error.message });
      return [];
    }
  }

  // 检查订单支付状态
  async checkOrderPayment(order, transactions) {
    try {
      const expectedAmount = parseFloat(order.payment_amount);
      const tolerance = 0.000001; // USDT精度容差
      
      for (const tx of transactions) {
        // 检查交易是否匹配订单
        if (this.isTransactionMatch(tx, order, expectedAmount, tolerance)) {
          await this.processPayment(order, tx);
          break;
        }
      }
    } catch (error) {
      logger.error('检查订单支付失败', { 
        error: error.message, 
        orderId: order.id 
      });
    }
  }

  // 判断交易是否匹配订单
  isTransactionMatch(transaction, order, expectedAmount, tolerance) {
    // 检查收款地址
    if (transaction.to !== this.walletAddress) {
      return false;
    }

    // 检查金额（考虑精度误差）
    const txAmount = parseFloat(transaction.value) / Math.pow(10, 6); // USDT精度为6位
    const amountDiff = Math.abs(txAmount - expectedAmount);
    
    if (amountDiff > tolerance) {
      return false;
    }

    // 检查时间（订单创建后的交易）
    const orderTime = new Date(order.created_at).getTime();
    const txTime = transaction.block_timestamp;
    
    if (txTime < orderTime) {
      return false;
    }

    return true;
  }

  // 处理支付
  async processPayment(order, transaction) {
    try {
      logger.info('处理USDT支付', {
        orderId: order.id,
        orderNo: order.order_no,
        txid: transaction.transaction_id,
        amount: transaction.value
      });

      // 更新订单状态为已支付
      await order.markAsPaid({
        txid: transaction.transaction_id,
        block_height: transaction.block,
        confirmations: transaction.confirmations || 0
      });

      // 分配卡密并完成订单
      await this.completeOrder(order);

    } catch (error) {
      logger.error('处理USDT支付失败', {
        error: error.message,
        orderId: order.id,
        txid: transaction.transaction_id
      });
    }
  }

  // 完成订单
  async completeOrder(order) {
    try {
      const OrderService = require('../orderService');
      const orderService = new OrderService();
      
      // 分配卡密
      await orderService.assignCardsToOrder(order);
      
      // 标记订单完成
      await order.markAsCompleted();
      
      // 发送通知给用户
      await this.notifyUser(order);
      
      logger.info('USDT订单完成', {
        orderId: order.id,
        orderNo: order.order_no
      });
      
    } catch (error) {
      logger.error('完成USDT订单失败', {
        error: error.message,
        orderId: order.id
      });
    }
  }

  // 通知用户
  async notifyUser(order) {
    try {
      // 这里可以通过Bot发送通知
      // 暂时只记录日志
      logger.info('用户支付成功通知', {
        orderId: order.id,
        userId: order.user_id,
        telegramId: order.telegram_id
      });
    } catch (error) {
      logger.error('发送用户通知失败', {
        error: error.message,
        orderId: order.id
      });
    }
  }

  // 生成支付二维码（可选）
  async generatePaymentQR(address, amount, memo = '') {
    try {
      const paymentUrl = `tron:${address}?amount=${amount}&token=${this.contractAddress}`;
      if (memo) {
        paymentUrl += `&memo=${encodeURIComponent(memo)}`;
      }
      
      // 这里可以集成二维码生成库
      return paymentUrl;
    } catch (error) {
      logger.error('生成支付二维码失败', { error: error.message });
      return null;
    }
  }

  // 获取网络状态
  async getNetworkStatus() {
    try {
      const response = await axios.get(`${this.baseUrl}/wallet/getnowblock`, {
        headers: {
          'TRON-PRO-API-KEY': this.apiKey
        }
      });

      return {
        success: true,
        block_height: response.data.block_header?.raw_data?.number || 0,
        timestamp: response.data.block_header?.raw_data?.timestamp || 0
      };
    } catch (error) {
      logger.error('获取网络状态失败', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = USDTService;
