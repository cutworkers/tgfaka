const databaseService = require('../index');

class Card {
  constructor(data = {}) {
    this.id = data.id;
    this.product_id = data.product_id;
    this.card_number = data.card_number;
    this.card_password = data.card_password;
    this.batch_id = data.batch_id;
    this.status = data.status || 'available';
    this.sold_at = data.sold_at;
    this.expire_at = data.expire_at;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 根据ID查找卡密
  static async findById(id) {
    const row = await databaseService.get(
      `SELECT c.*, p.name as product_name 
       FROM cards c 
       LEFT JOIN products p ON c.product_id = p.id 
       WHERE c.id = ?`,
      [id]
    );
    return row ? new Card(row) : null;
  }

  // 根据商品ID获取可用卡密
  static async findAvailableByProductId(productId, limit = 1) {
    const rows = await databaseService.query(
      `SELECT * FROM cards 
       WHERE product_id = ? AND status = 'available' 
       ORDER BY created_at ASC 
       LIMIT ?`,
      [productId, limit]
    );
    return rows.map(row => new Card(row));
  }

  // 获取卡密列表
  static async findAll(options = {}) {
    let sql = `
      SELECT c.*, p.name as product_name 
      FROM cards c 
      LEFT JOIN products p ON c.product_id = p.id
    `;
    const params = [];
    const conditions = [];

    if (options.product_id) {
      conditions.push('c.product_id = ?');
      params.push(options.product_id);
    }

    if (options.status) {
      conditions.push('c.status = ?');
      params.push(options.status);
    }

    if (options.batch_id) {
      conditions.push('c.batch_id = ?');
      params.push(options.batch_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY c.created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      
      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = await databaseService.query(sql, params);
    return rows.map(row => new Card(row));
  }

  // 创建新卡密
  static async create(cardData) {
    const result = await databaseService.run(
      `INSERT INTO cards (product_id, card_number, card_password, batch_id, status, expire_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cardData.product_id,
        cardData.card_number,
        cardData.card_password,
        cardData.batch_id,
        cardData.status || 'available',
        cardData.expire_at
      ]
    );
    
    return await Card.findById(result.id);
  }

  // 批量创建卡密
  static async createBatch(cardsData) {
    const results = [];
    
    await databaseService.transaction(async (db) => {
      for (const cardData of cardsData) {
        const result = await databaseService.run(
          `INSERT INTO cards (product_id, card_number, card_password, batch_id, status, expire_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            cardData.product_id,
            cardData.card_number,
            cardData.card_password,
            cardData.batch_id,
            cardData.status || 'available',
            cardData.expire_at
          ]
        );
        results.push(result.id);
      }
    });
    
    return results;
  }

  // 更新卡密状态
  async updateStatus(status, soldAt = null) {
    const updateData = { status };
    if (soldAt) {
      updateData.sold_at = soldAt;
    }
    
    await databaseService.run(
      'UPDATE cards SET status = ?, sold_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, soldAt, this.id]
    );
    
    return await Card.findById(this.id);
  }

  // 标记为已售出
  async markAsSold() {
    return await this.updateStatus('sold', new Date().toISOString());
  }

  // 标记为过期
  async markAsExpired() {
    return await this.updateStatus('expired');
  }

  // 更新卡密信息
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
      `UPDATE cards SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return await Card.findById(this.id);
  }

  // 删除卡密
  async delete() {
    // 检查是否已被使用
    if (this.status === 'sold') {
      throw new Error('已售出的卡密无法删除');
    }
    
    await databaseService.run('DELETE FROM cards WHERE id = ?', [this.id]);
  }

  // 检查是否过期
  isExpired() {
    if (!this.expire_at) return false;
    return new Date(this.expire_at) < new Date();
  }

  // 获取卡密统计信息
  static async getStats(productId = null) {
    let sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired
      FROM cards
    `;
    const params = [];
    
    if (productId) {
      sql += ' WHERE product_id = ?';
      params.push(productId);
    }
    
    return await databaseService.get(sql, params);
  }

  // 批量更新过期卡密
  static async updateExpiredCards() {
    const result = await databaseService.run(
      `UPDATE cards 
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP 
       WHERE status = 'available' 
         AND expire_at IS NOT NULL 
         AND expire_at < datetime('now')`
    );
    
    return result.changes;
  }

  // 根据批次ID删除卡密
  static async deleteByBatchId(batchId) {
    // 检查是否有已售出的卡密
    const soldCount = await databaseService.get(
      'SELECT COUNT(*) as count FROM cards WHERE batch_id = ? AND status = "sold"',
      [batchId]
    );
    
    if (soldCount.count > 0) {
      throw new Error('批次中包含已售出的卡密，无法删除');
    }
    
    const result = await databaseService.run(
      'DELETE FROM cards WHERE batch_id = ?',
      [batchId]
    );
    
    return result.changes;
  }

  // 序列化为JSON
  toJSON() {
    return {
      id: this.id,
      product_id: this.product_id,
      card_number: this.card_number,
      card_password: this.card_password,
      batch_id: this.batch_id,
      status: this.status,
      sold_at: this.sold_at,
      expire_at: this.expire_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
      product_name: this.product_name
    };
  }

  // 序列化为安全JSON（隐藏敏感信息）
  toSafeJSON() {
    return {
      id: this.id,
      product_id: this.product_id,
      status: this.status,
      created_at: this.created_at,
      product_name: this.product_name
    };
  }
}

module.exports = Card;
