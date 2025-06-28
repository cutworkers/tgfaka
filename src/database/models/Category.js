const databaseService = require('../index');

class Category {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.icon = data.icon;
    this.sort_order = data.sort_order || 0;
    this.status = data.status || 'active';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 根据ID查找分类
  static async findById(id) {
    const row = await databaseService.get(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );
    return row ? new Category(row) : null;
  }

  // 获取所有分类
  static async findAll(options = {}) {
    let sql = 'SELECT * FROM categories';
    const params = [];
    const conditions = [];

    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY sort_order ASC, created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      
      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = await databaseService.query(sql, params);
    return rows.map(row => new Category(row));
  }

  // 获取活跃分类
  static async getActiveCategories() {
    return await Category.findAll({ status: 'active' });
  }

  // 创建新分类
  static async create(categoryData) {
    const result = await databaseService.run(
      `INSERT INTO categories (name, description, icon, sort_order, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        categoryData.name,
        categoryData.description,
        categoryData.icon,
        categoryData.sort_order || 0,
        categoryData.status || 'active'
      ]
    );
    
    return await Category.findById(result.id);
  }

  // 更新分类信息
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
      `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return await Category.findById(this.id);
  }

  // 删除分类
  async delete() {
    // 检查是否有关联的商品
    const productCount = await databaseService.get(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [this.id]
    );
    
    if (productCount.count > 0) {
      throw new Error('该分类下还有商品，无法删除');
    }
    
    await databaseService.run('DELETE FROM categories WHERE id = ?', [this.id]);
  }

  // 获取分类下的商品数量
  async getProductCount() {
    const result = await databaseService.get(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [this.id]
    );
    return result.count;
  }

  // 转换为JSON对象
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      sort_order: this.sort_order,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  // 转换为安全的JSON对象（用于API响应）
  toSafeJSON() {
    return this.toJSON();
  }
}

module.exports = Category;
