const Product = require('../database/models/Product');
const Card = require('../database/models/Card');
const axios = require('axios');
const logger = require('../utils/logger');
const performanceMonitor = require('./PerformanceMonitor');
const ErrorLogger = require('../utils/ErrorLogger');

class CardDeliveryService {
  /**
   * 根据商品类型发卡
   * @param {Object} order - 订单信息
   * @param {number} order.product_id - 商品ID
   * @param {number} order.quantity - 数量
   * @param {string} order.id - 订单ID
   * @param {string} order.user_id - 用户ID
   * @returns {Promise<Array>} 卡密数组
   */
  static async deliverCards(order) {
    const startTime = Date.now();
    const deliveryId = `delivery_${order.id}_${Date.now()}`;

    try {
      logger.info('发卡流程开始', {
        deliveryId,
        orderId: order.id,
        userId: order.user_id,
        productId: order.product_id,
        quantity: order.quantity,
        timestamp: new Date().toISOString()
      });

      const product = await Product.findById(order.product_id);
      if (!product) {
        throw new Error('商品不存在');
      }

      logger.info('商品信息获取成功', {
        deliveryId,
        orderId: order.id,
        productName: product.name,
        productType: product.type,
        productPrice: product.price
      });

      let cards = [];
      let deliveryMethod = '';

      if (product.type === 'card') {
        deliveryMethod = 'card_stock';
        logger.info('开始从卡密库发卡', {
          deliveryId,
          orderId: order.id,
          method: deliveryMethod,
          requestedQuantity: order.quantity
        });

        cards = await this.deliverFromCardStock(product, order.quantity, deliveryId);

      } else if (product.type === 'post') {
        deliveryMethod = 'post_api';
        logger.info('开始通过POST API发卡', {
          deliveryId,
          orderId: order.id,
          method: deliveryMethod,
          requestedQuantity: order.quantity
        });

        cards = await this.deliverFromPostAPI(product, order, deliveryId);

      } else {
        throw new Error(`不支持的商品类型: ${product.type}`);
      }

      const executionTime = Date.now() - startTime;

      logger.info('发卡流程完成', {
        deliveryId,
        orderId: order.id,
        productType: product.type,
        deliveryMethod,
        requestedQuantity: order.quantity,
        deliveredQuantity: cards.length,
        executionTimeMs: executionTime,
        success: true,
        timestamp: new Date().toISOString()
      });

      // 记录发卡成功的详细信息
      logger.info('发卡结果详情', {
        deliveryId,
        orderId: order.id,
        cards: cards.map((card, index) => ({
          index: index + 1,
          cardNumber: card.card_number ? `${card.card_number.substring(0, 4)}****` : 'N/A',
          type: card.type,
          hasPassword: !!card.card_password
        }))
      });

      return cards;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('发卡流程失败', {
        deliveryId,
        orderId: order.id,
        userId: order.user_id,
        productId: order.product_id,
        quantity: order.quantity,
        error: error.message,
        errorStack: error.stack,
        executionTimeMs: executionTime,
        success: false,
        timestamp: new Date().toISOString()
      });

      // 记录详细错误日志
      await ErrorLogger.logDeliveryError(error, {
        deliveryId,
        orderId: order.id,
        productId: order.product_id,
        productType: product?.type,
        quantity: order.quantity,
        deliveryMethod: product?.type === 'card' ? 'card_stock' : 'post_api'
      }, {
        type: 'user',
        id: order.user_id
      });

      throw error;
    }
  }

  /**
   * 从卡密库发卡
   * @param {Product} product - 商品对象
   * @param {number} quantity - 数量
   * @param {string} deliveryId - 发卡流程ID
   * @returns {Promise<Array>} 卡密数组
   */
  static async deliverFromCardStock(product, quantity, deliveryId) {
    const stepStartTime = Date.now();

    try {
      logger.info('查询可用卡密', {
        deliveryId,
        productId: product.id,
        productName: product.name,
        requestedQuantity: quantity
      });

      // 获取可用卡密
      const availableCards = await Card.findAll({
        product_id: product.id,
        status: 'available',
        limit: quantity
      });

      logger.info('卡密库查询结果', {
        deliveryId,
        productId: product.id,
        availableCount: availableCards.length,
        requestedQuantity: quantity,
        sufficient: availableCards.length >= quantity
      });

      if (availableCards.length < quantity) {
        const error = `库存不足，需要${quantity}张卡密，但只有${availableCards.length}张可用`;
        logger.warn('卡密库存不足', {
          deliveryId,
          productId: product.id,
          productName: product.name,
          available: availableCards.length,
          requested: quantity,
          shortage: quantity - availableCards.length
        });
        throw new Error(error);
      }

      // 标记卡密为已售
      const selectedCards = availableCards.slice(0, quantity);
      const cardIds = selectedCards.map(card => card.id);

      logger.info('开始标记卡密为已售', {
        deliveryId,
        productId: product.id,
        cardIds: cardIds,
        quantity: cardIds.length
      });

      const markedCount = await Card.markAsSold(cardIds);

      logger.info('卡密标记完成', {
        deliveryId,
        productId: product.id,
        expectedCount: cardIds.length,
        actualMarkedCount: markedCount,
        success: markedCount === cardIds.length
      });

      if (markedCount !== cardIds.length) {
        logger.warn('卡密标记数量不匹配', {
          deliveryId,
          expected: cardIds.length,
          actual: markedCount
        });
      }

      const executionTime = Date.now() - stepStartTime;

      // 返回卡密信息
      const result = selectedCards.map((card, index) => ({
        card_number: card.card_number,
        card_password: card.card_password,
        type: 'card',
        source: 'card_stock',
        cardId: card.id,
        batchId: card.batch_id
      }));

      logger.info('卡密库发卡完成', {
        deliveryId,
        productId: product.id,
        deliveredCount: result.length,
        executionTimeMs: executionTime,
        cardSummary: result.map((card, index) => ({
          index: index + 1,
          cardId: card.cardId,
          cardNumber: `${card.card_number.substring(0, 4)}****`,
          batchId: card.batchId
        }))
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - stepStartTime;

      logger.error('卡密库发卡失败', {
        deliveryId,
        productId: product.id,
        productName: product.name,
        requestedQuantity: quantity,
        error: error.message,
        executionTimeMs: executionTime
      });

      throw error;
    }
  }

  /**
   * 从POST API发卡
   * @param {Product} product - 商品对象
   * @param {Object} order - 订单信息
   * @param {string} deliveryId - 发卡流程ID
   * @returns {Promise<Array>} 卡密数组
   */
  static async deliverFromPostAPI(product, order, deliveryId) {
    const stepStartTime = Date.now();

    try {
      logger.info('开始POST API发卡流程', {
        deliveryId,
        orderId: order.id,
        productId: product.id,
        productName: product.name
      });

      if (!product.post_data) {
        throw new Error('POST类型商品缺少API配置');
      }

      let postConfig;
      try {
        postConfig = JSON.parse(product.post_data);
        logger.info('POST配置解析成功', {
          deliveryId,
          orderId: order.id,
          configKeys: Object.keys(postConfig),
          hasUrl: !!postConfig.url,
          hasHeaders: !!postConfig.headers,
          hasBody: !!postConfig.body
        });
      } catch (error) {
        logger.error('POST配置解析失败', {
          deliveryId,
          orderId: order.id,
          postData: product.post_data,
          error: error.message
        });
        throw new Error('POST配置格式错误，必须是有效的JSON');
      }

      // 验证必要字段
      if (!postConfig.url) {
        logger.error('POST配置验证失败', {
          deliveryId,
          orderId: order.id,
          reason: '缺少url字段',
          config: postConfig
        });
        throw new Error('POST配置缺少url字段');
      }

      // 替换变量
      const variables = {
        product_id: product.id,
        quantity: order.quantity,
        order_id: order.id
      };

      logger.info('开始处理POST变量', {
        deliveryId,
        orderId: order.id,
        variables
      });

      const processedConfig = this.processPostVariables(postConfig, variables);

      logger.info('POST变量处理完成', {
        deliveryId,
        orderId: order.id,
        originalUrl: postConfig.url,
        processedUrl: processedConfig.url,
        headerCount: Object.keys(processedConfig.headers || {}).length,
        bodyKeys: Object.keys(processedConfig.body || {})
      });

      const requestStartTime = Date.now();
      const apiCallId = `api_${deliveryId}_${Date.now()}`;

      // 开始性能监控
      performanceMonitor.startApiCall(apiCallId, {
        url: processedConfig.url,
        orderId: order.id,
        productId: product.id,
        deliveryId
      });

      try {
        logger.info('发送POST请求', {
          deliveryId,
          orderId: order.id,
          apiCallId,
          url: processedConfig.url,
          method: 'POST',
          headers: processedConfig.headers,
          body: processedConfig.body,
          timeout: 30000
        });

        // 发送POST请求
        const response = await axios({
          method: 'POST',
          url: processedConfig.url,
          headers: processedConfig.headers || {},
          data: processedConfig.body || {},
          timeout: 30000 // 30秒超时
        });

        const requestTime = Date.now() - requestStartTime;

        // 结束性能监控 - 成功
        performanceMonitor.endApiCall(apiCallId, {
          success: true,
          responseStatus: response.status,
          responseSize: JSON.stringify(response.data).length
        });

        logger.info('POST API调用成功', {
          deliveryId,
          orderId: order.id,
          url: processedConfig.url,
          status: response.status,
          statusText: response.statusText,
          responseTimeMs: requestTime,
          responseSize: JSON.stringify(response.data).length,
          responseHeaders: response.headers
        });

        // 处理响应数据
        logger.info('开始解析API响应', {
          deliveryId,
          orderId: order.id,
          expectedQuantity: order.quantity,
          responseDataType: typeof response.data,
          isArray: Array.isArray(response.data)
        });

        const cards = this.parsePostResponse(response.data, order.quantity, deliveryId);

        const totalExecutionTime = Date.now() - stepStartTime;

        logger.info('POST API发卡完成', {
          deliveryId,
          orderId: order.id,
          url: processedConfig.url,
          requestTimeMs: requestTime,
          totalExecutionTimeMs: totalExecutionTime,
          deliveredCount: cards.length,
          cardSummary: cards.map((card, index) => ({
            index: index + 1,
            cardNumber: card.card_number ? `${card.card_number.substring(0, 4)}****` : 'N/A',
            hasPassword: !!card.card_password,
            type: card.type
          }))
        });

        return cards;

      } catch (error) {
        const requestTime = Date.now() - requestStartTime;
        const totalExecutionTime = Date.now() - stepStartTime;

        // 结束性能监控 - 失败
        performanceMonitor.endApiCall(apiCallId, {
          success: false,
          responseStatus: error.response?.status,
          responseSize: error.response?.data ? JSON.stringify(error.response.data).length : 0,
          error: error.message,
          errorCode: error.code
        });

        logger.error('POST API请求失败', {
          deliveryId,
          orderId: order.id,
          apiCallId,
          url: processedConfig.url,
          requestTimeMs: requestTime,
          totalExecutionTimeMs: totalExecutionTime,
          error: error.message,
          errorCode: error.code,
          responseStatus: error.response?.status,
          responseStatusText: error.response?.statusText,
          responseData: error.response?.data
        });

        if (error.response) {
          throw new Error(`API调用失败: ${error.response.status} ${error.response.statusText}`);
        } else if (error.request) {
          throw new Error('API请求超时或网络错误');
        } else {
          throw new Error(`API调用错误: ${error.message}`);
        }
      }

    } catch (error) {
      const totalExecutionTime = Date.now() - stepStartTime;

      logger.error('POST API发卡流程失败', {
        deliveryId,
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        totalExecutionTimeMs: totalExecutionTime,
        error: error.message,
        errorStack: error.stack
      });

      throw error;
    }
  }

  /**
   * 处理POST配置中的变量替换
   * @param {Object} config - POST配置
   * @param {Object} variables - 变量对象
   * @returns {Object} 处理后的配置
   */
  static processPostVariables(config, variables) {
    const configStr = JSON.stringify(config);
    let processedStr = configStr;

    // 替换变量
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedStr = processedStr.replace(regex, variables[key]);
    });

    return JSON.parse(processedStr);
  }

  /**
   * 解析POST API响应
   * @param {*} responseData - API响应数据
   * @param {number} expectedQuantity - 期望的卡密数量
   * @param {string} deliveryId - 发卡流程ID
   * @returns {Array} 卡密数组
   */
  static parsePostResponse(responseData, expectedQuantity, deliveryId) {
    logger.info('开始解析POST API响应', {
      deliveryId,
      expectedQuantity,
      responseType: typeof responseData,
      isArray: Array.isArray(responseData),
      responseKeys: responseData && typeof responseData === 'object' ? Object.keys(responseData) : []
    });

    // 如果响应是数组，直接使用
    if (Array.isArray(responseData)) {
      logger.info('响应为数组格式', {
        deliveryId,
        arrayLength: responseData.length,
        expectedQuantity,
        sufficient: responseData.length >= expectedQuantity
      });

      if (responseData.length < expectedQuantity) {
        const error = `API返回的卡密数量不足，期望${expectedQuantity}张，实际${responseData.length}张`;
        logger.error('API响应数量不足', {
          deliveryId,
          expected: expectedQuantity,
          actual: responseData.length,
          shortage: expectedQuantity - responseData.length
        });
        throw new Error(error);
      }

      const result = responseData.slice(0, expectedQuantity).map((item, index) => {
        const card = {
          card_number: item.card_number || item.cardNumber || item.number || `API-${Date.now()}-${index}`,
          card_password: item.card_password || item.cardPassword || item.password || item.code || '',
          type: 'post',
          source: 'post_api',
          originalData: item
        };

        logger.debug('解析卡密项', {
          deliveryId,
          index: index + 1,
          hasCardNumber: !!card.card_number,
          hasPassword: !!card.card_password,
          originalKeys: Object.keys(item)
        });

        return card;
      });

      logger.info('数组响应解析完成', {
        deliveryId,
        parsedCount: result.length,
        expectedQuantity
      });

      return result;
    }

    // 如果响应是对象，尝试从data字段获取
    if (responseData && responseData.data && Array.isArray(responseData.data)) {
      logger.info('响应包含data数组字段', {
        deliveryId,
        dataLength: responseData.data.length
      });
      return this.parsePostResponse(responseData.data, expectedQuantity, deliveryId);
    }

    // 如果响应是对象且包含cards字段
    if (responseData && responseData.cards && Array.isArray(responseData.cards)) {
      logger.info('响应包含cards数组字段', {
        deliveryId,
        cardsLength: responseData.cards.length
      });
      return this.parsePostResponse(responseData.cards, expectedQuantity, deliveryId);
    }

    // 如果是单个卡密对象
    if (responseData && (responseData.card_number || responseData.cardNumber)) {
      logger.info('响应为单个卡密对象', {
        deliveryId,
        expectedQuantity,
        hasCardNumber: !!(responseData.card_number || responseData.cardNumber),
        hasPassword: !!(responseData.card_password || responseData.cardPassword || responseData.password || responseData.code)
      });

      if (expectedQuantity > 1) {
        const error = `API只返回了1张卡密，但订单需要${expectedQuantity}张`;
        logger.error('单个卡密对象数量不匹配', {
          deliveryId,
          expected: expectedQuantity,
          actual: 1
        });
        throw new Error(error);
      }

      const result = [{
        card_number: responseData.card_number || responseData.cardNumber || responseData.number,
        card_password: responseData.card_password || responseData.cardPassword || responseData.password || responseData.code || '',
        type: 'post',
        source: 'post_api',
        originalData: responseData
      }];

      logger.info('单个卡密对象解析完成', {
        deliveryId,
        cardNumber: result[0].card_number ? `${result[0].card_number.substring(0, 4)}****` : 'N/A',
        hasPassword: !!result[0].card_password
      });

      return result;
    }

    logger.error('无法解析API响应数据', {
      deliveryId,
      responseType: typeof responseData,
      responseData: JSON.stringify(responseData).substring(0, 500),
      expectedQuantity
    });

    throw new Error('无法解析API响应数据，请检查API返回格式');
  }
}

module.exports = CardDeliveryService;
