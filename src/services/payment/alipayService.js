const crypto = require('crypto');
const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');
const Order = require('../../database/models/Order');

class AlipayService {
  constructor() {
    this.appId = config.alipay.appId;
    this.privateKey = config.alipay.privateKey;
    this.publicKey = config.alipay.publicKey;
    this.gateway = config.alipay.gateway;
    this.notifyUrl = config.alipay.notifyUrl;
    this.charset = 'utf-8';
    this.signType = 'RSA2';
    this.version = '1.0';
  }

  // 创建支付订单
  async createPayment(order) {
    try {
      const params = {
        app_id: this.appId,
        method: 'alipay.trade.precreate',
        charset: this.charset,
        sign_type: this.signType,
        timestamp: this.formatDate(new Date()),
        version: this.version,
        notify_url: this.notifyUrl,
        biz_content: JSON.stringify({
          out_trade_no: order.order_no,
          total_amount: order.total_amount.toString(),
          subject: `购买${order.product_name}`,
          body: `订单号：${order.order_no}，商品：${order.product_name} x${order.quantity}`,
          timeout_express: '30m',
          store_id: 'telegram_shop',
          operator_id: 'system'
        })
      };

      // 生成签名
      params.sign = this.generateSign(params);

      // 发送请求
      const response = await axios.post(this.gateway, this.buildQuery(params), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const result = this.parseResponse(response.data);
      
      if (result.code === '10000') {
        logger.info('支付宝订单创建成功', {
          orderId: order.id,
          orderNo: order.order_no,
          qrCode: result.qr_code
        });

        return {
          success: true,
          qr_code: result.qr_code,
          out_trade_no: result.out_trade_no
        };
      } else {
        throw new Error(`支付宝API错误: ${result.msg || result.sub_msg}`);
      }

    } catch (error) {
      logger.error('创建支付宝支付失败', {
        error: error.message,
        orderId: order.id
      });
      throw error;
    }
  }

  // 查询支付状态
  async queryPayment(orderNo) {
    try {
      const params = {
        app_id: this.appId,
        method: 'alipay.trade.query',
        charset: this.charset,
        sign_type: this.signType,
        timestamp: this.formatDate(new Date()),
        version: this.version,
        biz_content: JSON.stringify({
          out_trade_no: orderNo
        })
      };

      params.sign = this.generateSign(params);

      const response = await axios.post(this.gateway, this.buildQuery(params), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const result = this.parseResponse(response.data);
      
      if (result.code === '10000') {
        return {
          success: true,
          trade_status: result.trade_status,
          trade_no: result.trade_no,
          total_amount: result.total_amount,
          buyer_pay_amount: result.buyer_pay_amount,
          gmt_payment: result.gmt_payment
        };
      } else {
        return {
          success: false,
          message: result.msg || result.sub_msg
        };
      }

    } catch (error) {
      logger.error('查询支付宝支付状态失败', {
        error: error.message,
        orderNo
      });
      return { success: false, message: error.message };
    }
  }

  // 处理支付回调
  async handleNotify(params) {
    try {
      logger.info('收到支付宝回调', { params });

      // 验证签名
      if (!this.verifySign(params)) {
        logger.warn('支付宝回调签名验证失败', { params });
        return { success: false, message: '签名验证失败' };
      }

      const {
        out_trade_no,
        trade_no,
        trade_status,
        total_amount,
        buyer_pay_amount,
        gmt_payment
      } = params;

      // 查找订单
      const order = await Order.findByOrderNo(out_trade_no);
      if (!order) {
        logger.warn('支付宝回调订单不存在', { orderNo: out_trade_no });
        return { success: false, message: '订单不存在' };
      }

      // 验证金额
      if (parseFloat(total_amount) !== parseFloat(order.total_amount)) {
        logger.warn('支付宝回调金额不匹配', {
          orderNo: out_trade_no,
          expectedAmount: order.total_amount,
          actualAmount: total_amount
        });
        return { success: false, message: '金额不匹配' };
      }

      // 处理不同的交易状态
      if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
        await this.processSuccessPayment(order, {
          trade_no,
          buyer_pay_amount,
          gmt_payment
        });
      } else if (trade_status === 'TRADE_CLOSED') {
        await order.markAsCancelled('支付宝交易关闭');
      }

      return { success: true, message: 'success' };

    } catch (error) {
      logger.error('处理支付宝回调失败', {
        error: error.message,
        params
      });
      return { success: false, message: error.message };
    }
  }

  // 处理成功支付
  async processSuccessPayment(order, paymentData) {
    try {
      if (order.status !== 'pending') {
        logger.info('订单状态已更新，跳过处理', {
          orderId: order.id,
          currentStatus: order.status
        });
        return;
      }

      // 标记为已支付
      await order.markAsPaid({
        txid: paymentData.trade_no,
        paid_amount: paymentData.buyer_pay_amount,
        paid_at: paymentData.gmt_payment
      });

      // 完成订单
      await this.completeOrder(order);

      logger.info('支付宝支付处理成功', {
        orderId: order.id,
        orderNo: order.order_no,
        tradeNo: paymentData.trade_no
      });

    } catch (error) {
      logger.error('处理支付宝成功支付失败', {
        error: error.message,
        orderId: order.id
      });
      throw error;
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
      
    } catch (error) {
      logger.error('完成支付宝订单失败', {
        error: error.message,
        orderId: order.id
      });
      throw error;
    }
  }

  // 通知用户
  async notifyUser(order) {
    try {
      logger.info('用户支付成功通知', {
        orderId: order.id,
        userId: order.user_id
      });
    } catch (error) {
      logger.error('发送用户通知失败', {
        error: error.message,
        orderId: order.id
      });
    }
  }

  // 生成签名
  generateSign(params) {
    // 移除sign参数
    const { sign, ...signParams } = params;

    // 按字典序排序
    const sortedKeys = Object.keys(signParams).sort();
    const signString = sortedKeys
      .map(key => `${key}=${signParams[key]}`)
      .join('&');

    // RSA2签名
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(signString, 'utf8')
      .sign(this.privateKey, 'base64');

    return signature;
  }

  // 验证签名
  verifySign(params) {
    try {
      const { sign, sign_type, ...verifyParams } = params;
      
      if (sign_type !== 'RSA2') {
        return false;
      }

      const sortedKeys = Object.keys(verifyParams).sort();
      const signString = sortedKeys
        .map(key => `${key}=${verifyParams[key]}`)
        .join('&');

      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(signString, 'utf8');
      
      return verify.verify(this.publicKey, sign, 'base64');
    } catch (error) {
      logger.error('验证支付宝签名失败', { error: error.message });
      return false;
    }
  }

  // 构建查询字符串
  buildQuery(params) {
    return Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  }

  // 解析响应
  parseResponse(responseText) {
    try {
      // 支付宝返回的是特殊格式，需要解析
      const match = responseText.match(/alipay_trade_precreate_response":(.*?),"sign"/);
      if (match) {
        return JSON.parse(match[1]);
      }
      
      // 查询接口的响应格式
      const queryMatch = responseText.match(/alipay_trade_query_response":(.*?),"sign"/);
      if (queryMatch) {
        return JSON.parse(queryMatch[1]);
      }
      
      throw new Error('无法解析支付宝响应');
    } catch (error) {
      logger.error('解析支付宝响应失败', { error: error.message, responseText });
      throw error;
    }
  }

  // 格式化日期
  formatDate(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }

  // 关闭订单
  async closeOrder(orderNo) {
    try {
      const params = {
        app_id: this.appId,
        method: 'alipay.trade.close',
        charset: this.charset,
        sign_type: this.signType,
        timestamp: this.formatDate(new Date()),
        version: this.version,
        biz_content: JSON.stringify({
          out_trade_no: orderNo
        })
      };

      params.sign = this.generateSign(params);

      const response = await axios.post(this.gateway, this.buildQuery(params), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const result = this.parseResponse(response.data);
      
      return {
        success: result.code === '10000',
        message: result.msg || result.sub_msg
      };

    } catch (error) {
      logger.error('关闭支付宝订单失败', {
        error: error.message,
        orderNo
      });
      return { success: false, message: error.message };
    }
  }
}

module.exports = AlipayService;
