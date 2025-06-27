const Product = require('../../database/models/Product');
const Card = require('../../database/models/Card');
const logger = require('../../utils/logger');

class ProductController {
  // 获取商品列表
  static async getProducts(req, res) {
    try {
      const {
        category_id,
        status = 'active',
        page = 1,
        limit = 20
      } = req.query;

      const offset = (page - 1) * limit;
      
      const options = {
        category_id,
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const products = await Product.findAll(options);
      
      // 为每个商品添加可用卡密数量
      const productsWithStock = await Promise.all(
        products.map(async (product) => {
          const availableCount = await product.getAvailableCardCount();
          const productData = product.toJSON();
          productData.available_cards = availableCount;
          return productData;
        })
      );

      // 获取总数
      const totalOptions = { category_id, status };
      const allProducts = await Product.findAll(totalOptions);
      const total = allProducts.length;

      res.json({
        success: true,
        data: {
          products: productsWithStock,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('获取商品列表失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取商品列表失败',
        error: error.message
      });
    }
  }

  // 获取单个商品详情
  static async getProduct(req, res) {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      const productData = product.toJSON();
      
      // 添加可用卡密数量
      productData.available_cards = await product.getAvailableCardCount();
      
      // 添加销售统计
      productData.sales_stats = await product.getSalesStats();

      res.json({
        success: true,
        data: productData
      });

    } catch (error) {
      logger.error('获取商品详情失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取商品详情失败',
        error: error.message
      });
    }
  }

  // 创建商品
  static async createProduct(req, res) {
    try {
      const {
        category_id,
        name,
        description,
        price,
        original_price,
        min_stock_alert,
        image_url,
        sort_order
      } = req.body;

      // 验证必填字段
      if (!name || !price) {
        return res.status(400).json({
          success: false,
          message: '商品名称和价格为必填字段'
        });
      }

      const productData = {
        category_id,
        name,
        description,
        price: parseFloat(price),
        original_price: original_price ? parseFloat(original_price) : null,
        min_stock_alert: min_stock_alert || 10,
        image_url,
        sort_order: sort_order || 0
      };

      const product = await Product.create(productData);

      logger.info('创建商品成功', { productId: product.id, name });

      res.status(201).json({
        success: true,
        message: '商品创建成功',
        data: product.toJSON()
      });

    } catch (error) {
      logger.error('创建商品失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '创建商品失败',
        error: error.message
      });
    }
  }

  // 更新商品
  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      // 处理价格字段
      if (updateData.price) {
        updateData.price = parseFloat(updateData.price);
      }
      if (updateData.original_price) {
        updateData.original_price = parseFloat(updateData.original_price);
      }

      const updatedProduct = await product.update(updateData);

      logger.info('更新商品成功', { productId: id });

      res.json({
        success: true,
        message: '商品更新成功',
        data: updatedProduct.toJSON()
      });

    } catch (error) {
      logger.error('更新商品失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '更新商品失败',
        error: error.message
      });
    }
  }

  // 删除商品
  static async deleteProduct(req, res) {
    try {
      const { id } = req.params;

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      await product.delete();

      logger.info('删除商品成功', { productId: id });

      res.json({
        success: true,
        message: '商品删除成功'
      });

    } catch (error) {
      logger.error('删除商品失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '删除商品失败',
        error: error.message
      });
    }
  }

  // 获取商品的卡密列表
  static async getProductCards(req, res) {
    try {
      const { id } = req.params;
      const { status = 'available', page = 1, limit = 20 } = req.query;

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      const offset = (page - 1) * limit;
      const cards = await Card.findAll({
        product_id: id,
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // 获取总数
      const allCards = await Card.findAll({ product_id: id, status });
      const total = allCards.length;

      res.json({
        success: true,
        data: {
          product: product.toJSON(),
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
      logger.error('获取商品卡密失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取商品卡密失败',
        error: error.message
      });
    }
  }

  // 更新商品库存
  static async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { quantity, operation = 'add' } = req.body;

      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: '数量必须大于0'
        });
      }

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      const updatedProduct = await product.updateStock(quantity, operation);

      logger.info('更新商品库存成功', { 
        productId: id, 
        quantity, 
        operation,
        newStock: updatedProduct.stock_count 
      });

      res.json({
        success: true,
        message: '库存更新成功',
        data: updatedProduct.toJSON()
      });

    } catch (error) {
      logger.error('更新商品库存失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '更新商品库存失败',
        error: error.message
      });
    }
  }

  // 获取商品销售统计
  static async getProductStats(req, res) {
    try {
      const { id } = req.params;
      const { days = 30 } = req.query;

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      const salesStats = await product.getSalesStats(parseInt(days));
      const cardStats = await Card.getStats(id);

      res.json({
        success: true,
        data: {
          product: product.toJSON(),
          sales_stats: salesStats,
          card_stats: cardStats
        }
      });

    } catch (error) {
      logger.error('获取商品统计失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取商品统计失败',
        error: error.message
      });
    }
  }
}

module.exports = ProductController;
