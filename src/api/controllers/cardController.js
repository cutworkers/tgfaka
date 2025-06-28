const Card = require('../../database/models/Card');
const Product = require('../../database/models/Product');
const SystemConfig = require('../../database/models/SystemConfig');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

class CardController {
  // 获取卡密列表
  static async getCards(req, res) {
    try {
      const {
        product_id,
        status = 'available',
        batch_id,
        page = 1,
        limit = 20
      } = req.query;

      const offset = (page - 1) * limit;
      
      const options = {
        product_id,
        status,
        batch_id,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const cards = await Card.findAll(options);
      
      // 获取总数
      const totalOptions = { product_id, status, batch_id };
      const allCards = await Card.findAll(totalOptions);
      const total = allCards.length;

      res.json({
        success: true,
        data: {
          cards: cards.map(card => card.toSafeJSON()),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('获取卡密列表失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取卡密列表失败',
        error: error.message
      });
    }
  }

  // 获取单个卡密详情
  static async getCard(req, res) {
    try {
      const { id } = req.params;
      const card = await Card.findById(id);

      if (!card) {
        return res.status(404).json({
          success: false,
          message: '卡密不存在'
        });
      }

      res.json({
        success: true,
        data: card.toJSON()
      });

    } catch (error) {
      logger.error('获取卡密详情失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取卡密详情失败',
        error: error.message
      });
    }
  }

  // 创建单个卡密
  static async createCard(req, res) {
    try {
      const {
        product_id,
        card_number,
        card_password,
        batch_id,
        expire_at
      } = req.body;

      // 验证必填字段
      if (!product_id || !card_number || !card_password) {
        return res.status(400).json({
          success: false,
          message: '商品ID、卡号和密码为必填字段'
        });
      }

      // 验证商品是否存在
      const product = await Product.findById(product_id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      // 检查卡号是否已存在
      const existingCard = await Card.findAll({ 
        product_id, 
        card_number 
      });
      
      if (existingCard.length > 0) {
        return res.status(400).json({
          success: false,
          message: '卡号已存在'
        });
      }

      const cardData = {
        product_id,
        card_number,
        card_password,
        batch_id: batch_id || `BATCH_${Date.now()}`,
        expire_at
      };

      const card = await Card.create(cardData);

      // 更新商品库存
      await product.updateStock(1, 'add');

      logger.info('创建卡密成功', { 
        cardId: card.id, 
        productId: product_id,
        batchId: cardData.batch_id 
      });

      res.status(201).json({
        success: true,
        message: '卡密创建成功',
        data: card.toJSON()
      });

    } catch (error) {
      logger.error('创建卡密失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '创建卡密失败',
        error: error.message
      });
    }
  }

  // 批量创建卡密
  static async createBatchCards(req, res) {
    try {
      const { product_id, cards, batch_id, expire_at } = req.body;

      // 验证必填字段
      if (!product_id || !cards || !Array.isArray(cards) || cards.length === 0) {
        return res.status(400).json({
          success: false,
          message: '商品ID和卡密数组为必填字段'
        });
      }

      // 验证商品是否存在
      const product = await Product.findById(product_id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      const batchIdToUse = batch_id || `BATCH_${Date.now()}_${uuidv4().substr(0, 8)}`;

      // 获取系统默认有效期设置
      const defaultExpireHours = await SystemConfig.get('card_expire_hours', 24);
      let defaultExpireAt = null;

      if (defaultExpireHours > 0) {
        const expireDate = new Date();
        expireDate.setHours(expireDate.getHours() + defaultExpireHours);
        defaultExpireAt = expireDate.toISOString();
      }

      // 准备卡密数据
      const cardsData = cards.map(card => ({
        product_id,
        card_number: card.card_number,
        card_password: card.card_password,
        batch_id: batchIdToUse,
        expire_at: card.expire_at || expire_at || defaultExpireAt
      }));

      // 验证卡号唯一性
      for (const cardData of cardsData) {
        if (!cardData.card_number || !cardData.card_password) {
          return res.status(400).json({
            success: false,
            message: '每张卡密都必须包含卡号和密码'
          });
        }
      }

      const cardIds = await Card.createBatch(cardsData);

      // 更新商品库存
      await product.updateStock(cardIds.length, 'add');

      logger.info('批量创建卡密成功', { 
        productId: product_id,
        batchId: batchIdToUse,
        count: cardIds.length 
      });

      res.status(201).json({
        success: true,
        message: `成功创建 ${cardIds.length} 张卡密`,
        data: {
          batch_id: batchIdToUse,
          count: cardIds.length,
          card_ids: cardIds
        }
      });

    } catch (error) {
      logger.error('批量创建卡密失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '批量创建卡密失败',
        error: error.message
      });
    }
  }

  // 更新卡密
  static async updateCard(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const card = await Card.findById(id);
      if (!card) {
        return res.status(404).json({
          success: false,
          message: '卡密不存在'
        });
      }

      // 不允许更新已售出的卡密的关键信息
      if (card.status === 'sold' && (updateData.card_number || updateData.card_password)) {
        return res.status(400).json({
          success: false,
          message: '已售出的卡密无法修改卡号和密码'
        });
      }

      const updatedCard = await card.update(updateData);

      logger.info('更新卡密成功', { cardId: id });

      res.json({
        success: true,
        message: '卡密更新成功',
        data: updatedCard.toJSON()
      });

    } catch (error) {
      logger.error('更新卡密失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '更新卡密失败',
        error: error.message
      });
    }
  }

  // 删除卡密
  static async deleteCard(req, res) {
    try {
      const { id } = req.params;

      const card = await Card.findById(id);
      if (!card) {
        return res.status(404).json({
          success: false,
          message: '卡密不存在'
        });
      }

      await card.delete();

      // 更新商品库存
      const product = await Product.findById(card.product_id);
      if (product) {
        await product.updateStock(1, 'subtract');
      }

      logger.info('删除卡密成功', { cardId: id });

      res.json({
        success: true,
        message: '卡密删除成功'
      });

    } catch (error) {
      logger.error('删除卡密失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '删除卡密失败',
        error: error.message
      });
    }
  }

  // 获取卡密统计信息
  static async getCardStats(req, res) {
    try {
      const { product_id } = req.query;
      
      const stats = await Card.getStats(product_id);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('获取卡密统计失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取卡密统计失败',
        error: error.message
      });
    }
  }

  // 批量删除卡密（按批次）
  static async deleteBatch(req, res) {
    try {
      const { batch_id } = req.params;

      const deletedCount = await Card.deleteByBatchId(batch_id);

      logger.info('批量删除卡密成功', { batchId: batch_id, count: deletedCount });

      res.json({
        success: true,
        message: `成功删除 ${deletedCount} 张卡密`,
        data: {
          batch_id,
          deleted_count: deletedCount
        }
      });

    } catch (error) {
      logger.error('批量删除卡密失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '批量删除卡密失败',
        error: error.message
      });
    }
  }
}

module.exports = CardController;
