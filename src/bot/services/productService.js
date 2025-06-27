const { Markup } = require('telegraf');
const Product = require('../../database/models/Product');
const Card = require('../../database/models/Card');
const logger = require('../../utils/logger');

class ProductService {
  // 获取活跃商品列表
  async getActiveProducts(page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const products = await Product.findAll({
        status: 'active',
        limit,
        offset
      });

      // 为每个商品添加可用卡密数量
      const productsWithStock = await Promise.all(
        products.map(async (product) => {
          const availableCount = await product.getAvailableCardCount();
          const productData = product.toJSON();
          productData.available_cards = availableCount;
          return productData;
        })
      );

      return productsWithStock.filter(product => product.available_cards > 0);
    } catch (error) {
      logger.error('获取商品列表失败', { error: error.message });
      throw error;
    }
  }

  // 根据ID获取商品详情
  async getProductById(productId) {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('商品不存在');
      }

      const productData = product.toJSON();
      productData.available_cards = await product.getAvailableCardCount();
      
      return productData;
    } catch (error) {
      logger.error('获取商品详情失败', { error: error.message, productId });
      throw error;
    }
  }

  // 检查商品库存
  async checkStock(productId, quantity = 1) {
    try {
      const availableCards = await Card.findAvailableByProductId(productId, quantity);
      return availableCards.length >= quantity;
    } catch (error) {
      logger.error('检查库存失败', { error: error.message, productId, quantity });
      return false;
    }
  }

  // 获取可用卡密
  async getAvailableCards(productId, quantity = 1) {
    try {
      return await Card.findAvailableByProductId(productId, quantity);
    } catch (error) {
      logger.error('获取可用卡密失败', { error: error.message, productId, quantity });
      throw error;
    }
  }

  // 生成商品列表键盘
  getProductKeyboard(products, page = 1) {
    const buttons = [];
    
    // 商品按钮（每行2个）
    for (let i = 0; i < products.length; i += 2) {
      const row = [];
      
      // 第一个商品
      if (products[i]) {
        row.push(Markup.button.callback(
          `${products[i].name} (¥${products[i].price})`,
          `product_${products[i].id}_detail`
        ));
      }
      
      // 第二个商品
      if (products[i + 1]) {
        row.push(Markup.button.callback(
          `${products[i + 1].name} (¥${products[i + 1].price})`,
          `product_${products[i + 1].id}_detail`
        ));
      }
      
      buttons.push(row);
    }

    // 分页按钮
    const paginationRow = [];
    if (page > 1) {
      paginationRow.push(Markup.button.callback('⬅️ 上一页', `products_page_${page - 1}`));
    }
    if (products.length === 10) { // 假设还有下一页
      paginationRow.push(Markup.button.callback('下一页 ➡️', `products_page_${page + 1}`));
    }
    
    if (paginationRow.length > 0) {
      buttons.push(paginationRow);
    }

    // 返回主菜单按钮
    buttons.push([Markup.button.callback('🏠 返回主菜单', 'main_menu')]);

    return Markup.inlineKeyboard(buttons);
  }

  // 生成商品详情键盘
  getProductDetailKeyboard(product) {
    const buttons = [];

    // 购买按钮
    if (product.available_cards > 0) {
      buttons.push([
        Markup.button.callback(
          `🛒 立即购买 (¥${product.price})`,
          `buy_${product.id}_1`
        )
      ]);

      // 数量选择按钮
      if (product.available_cards > 1) {
        const quantityRow = [];
        const maxQuantity = Math.min(product.available_cards, 5);
        
        for (let i = 1; i <= maxQuantity; i++) {
          quantityRow.push(
            Markup.button.callback(
              `${i}张`,
              `buy_${product.id}_${i}`
            )
          );
        }
        buttons.push(quantityRow);
      }
    } else {
      buttons.push([
        Markup.button.callback('❌ 暂时缺货', 'out_of_stock')
      ]);
    }

    // 返回按钮
    buttons.push([
      Markup.button.callback('⬅️ 返回商品列表', 'products_page_1'),
      Markup.button.callback('🏠 主菜单', 'main_menu')
    ]);

    return Markup.inlineKeyboard(buttons);
  }

  // 格式化商品信息
  formatProductInfo(product, detailed = false) {
    let message = `🛍️ **${product.name}**\n\n`;
    
    if (product.description) {
      message += `📝 ${product.description}\n\n`;
    }
    
    message += `💰 价格: ¥${product.price}`;
    
    if (product.original_price && product.original_price > product.price) {
      const discount = Math.round((1 - product.price / product.original_price) * 100);
      message += ` ~~¥${product.original_price}~~ (${discount}% OFF)`;
    }
    
    message += `\n📦 库存: ${product.available_cards}张`;
    
    if (detailed) {
      message += `\n🏷️ 分类: ${product.category_name || '未分类'}`;
      message += `\n📊 已售: ${product.sold_count}张`;
    }

    return message;
  }

  // 格式化商品列表
  formatProductList(products) {
    if (products.length === 0) {
      return '暂无可用商品';
    }

    let message = '🛍️ **商品列表**\n\n';
    
    products.forEach((product, index) => {
      message += `${index + 1}. **${product.name}**\n`;
      message += `   💰 ¥${product.price}`;
      
      if (product.original_price && product.original_price > product.price) {
        const discount = Math.round((1 - product.price / product.original_price) * 100);
        message += ` ~~¥${product.original_price}~~ (${discount}% OFF)`;
      }
      
      message += `\n   📦 库存: ${product.available_cards}张\n\n`;
    });

    message += '点击下方按钮查看商品详情 👇';
    
    return message;
  }

  // 验证购买数量
  validateQuantity(product, quantity) {
    if (quantity <= 0) {
      return { valid: false, message: '购买数量必须大于0' };
    }

    if (quantity > product.available_cards) {
      return { valid: false, message: `库存不足，仅剩${product.available_cards}张` };
    }

    const maxQuantity = 10; // 单次最大购买数量
    if (quantity > maxQuantity) {
      return { valid: false, message: `单次最多购买${maxQuantity}张` };
    }

    return { valid: true };
  }

  // 计算订单金额
  calculateOrderAmount(product, quantity) {
    return {
      unit_price: product.price,
      total_amount: product.price * quantity,
      quantity
    };
  }

  // 获取商品分类
  async getCategories() {
    try {
      // 这里可以添加分类查询逻辑
      // 暂时返回空数组
      return [];
    } catch (error) {
      logger.error('获取商品分类失败', { error: error.message });
      return [];
    }
  }

  // 搜索商品
  async searchProducts(keyword, page = 1, limit = 10) {
    try {
      // 这里可以添加搜索逻辑
      // 暂时返回空数组
      return [];
    } catch (error) {
      logger.error('搜索商品失败', { error: error.message, keyword });
      return [];
    }
  }
}

module.exports = ProductService;
