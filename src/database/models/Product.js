const databaseService = require('../index');

class Product {
  constructor(data = {}) {
    this.id = data.id;
    this.category_id = data.category_id;
    this.name = data.name;
    this.description = data.description;
    this.price = data.price;
    this.original_price = data.original_price;
    this.stock_count = data.stock_count || 0;
    this.sold_count = data.sold_count || 0;
    this.min_stock_alert = data.min_stock_alert || 10;
    this.image_url = data.image_url;
    this.status = data.status || 'active';
    this.sort_order = data.sort_order || 0;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.category_name = data.category_name; // 添加分类名称字段
  }

  // 获取所有商品
  static async findAll(options = {}) {
    let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    const params = [];
    const conditions = [];

    if (options.status) {
      conditions.push('p.status = ?');
      params.push(options.status);
    }

    if (options.category_id) {
      conditions.push('p.category_id = ?');
      params.push(options.category_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p.sort_order ASC, p.created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      
      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = await databaseService.query(sql, params);
    return rows.map(row => new Product(row));
  }

  // 根据ID查找商品
  static async findById(id) {
    const row = await databaseService.get(
      `SELECT p.*, c.name as category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ?`,
      [id]
    );
    return row ? new Product(row) : null;
  }

  // 创建新商品
  static async create(productData) {
    const result = await databaseService.run(
      `INSERT INTO products (category_id, name, description, price, original_price, 
                           stock_count, min_stock_alert, image_url, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productData.category_id,
        productData.name,
        productData.description,
        productData.price,
        productData.original_price,
        productData.stock_count || 0,
        productData.min_stock_alert || 10,
        productData.image_url,
        productData.status || 'active',
        productData.sort_order || 0
      ]
    );
    
    return await Product.findById(result.id);
  }

  // 更新商品信息
  async update(updateData) {
    const fields = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });
    
    if (fields.length === 0) return this;
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(this.id);
    
    await databaseService.run(
      `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return await Product.findById(this.id);
  }

  // 更新库存
  async updateStock(quantity, operation = 'add') {
    const operator = operation === 'add' ? '+' : '-';
    const result = await databaseService.run(
      `UPDATE products SET stock_count = stock_count ${operator} ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [Math.abs(quantity), this.id]
    );
    
    return await Product.findById(this.id);
  }

  // 增加销量
  async addSoldCount(quantity = 1) {
    await databaseService.run(
      'UPDATE products SET sold_count = sold_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [quantity, this.id]
    );
    
    return await Product.findById(this.id);
  }

  // 检查库存是否充足
  hasStock(quantity = 1) {
    return this.stock_count >= quantity;
  }

  // 检查是否需要库存预警
  needsStockAlert() {
    return this.stock_count <= this.min_stock_alert;
  }

  // 获取可用卡密数量
  async getAvailableCardCount() {
    const result = await databaseService.get(
      'SELECT COUNT(*) as count FROM cards WHERE product_id = ? AND status = "available"',
      [this.id]
    );
    return result.count;
  }

  // 获取商品的卡密列表
  async getCards(status = 'available', limit = 10, offset = 0) {
    return await databaseService.query(
      'SELECT * FROM cards WHERE product_id = ? AND status = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
      [this.id, status, limit, offset]
    );
  }

  // 获取商品销售统计
  async getSalesStats(days = 30) {
    const stats = await databaseService.get(
      `SELECT 
         COUNT(*) as total_orders,
         SUM(quantity) as total_quantity,
         SUM(total_amount) as total_revenue,
         AVG(total_amount) as avg_order_value
       FROM orders 
       WHERE product_id = ? 
         AND status = 'completed' 
         AND created_at >= datetime('now', '-${days} days')`,
      [this.id]
    );
    
    return stats;
  }

  // 删除商品
  async delete() {
    // 检查是否有关联的订单
    const orderCount = await databaseService.get(
      'SELECT COUNT(*) as count FROM orders WHERE product_id = ?',
      [this.id]
    );
    
    if (orderCount.count > 0) {
      throw new Error('无法删除有订单记录的商品');
    }
    
    // 删除关联的卡密
    await databaseService.run('DELETE FROM cards WHERE product_id = ?', [this.id]);
    
    // 删除商品
    await databaseService.run('DELETE FROM products WHERE id = ?', [this.id]);
  }

  // 序列化为JSON
  toJSON() {
    return {
      id: this.id,
      category_id: this.category_id,
      name: this.name,
      description: this.description,
      price: parseFloat(this.price),
      original_price: this.original_price ? parseFloat(this.original_price) : null,
      stock_count: this.stock_count,
      sold_count: this.sold_count,
      min_stock_alert: this.min_stock_alert,
      image_url: this.image_url,
      status: this.status,
      sort_order: this.sort_order,
      created_at: this.created_at,
      updated_at: this.updated_at,
      category_name: this.category_name
    };
  }
}

module.exports = Product;
