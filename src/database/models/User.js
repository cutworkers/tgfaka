const databaseService = require('../index');

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.telegram_id = data.telegram_id;
    this.username = data.username;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.phone = data.phone;
    this.email = data.email;
    this.balance = data.balance || 0;
    this.total_spent = data.total_spent || 0;
    this.order_count = data.order_count || 0;
    this.status = data.status || 'active';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 根据Telegram ID查找用户
  static async findByTelegramId(telegramId) {
    const row = await databaseService.get(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegramId]
    );
    return row ? new User(row) : null;
  }

  // 根据ID查找用户
  static async findById(id) {
    const row = await databaseService.get(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return row ? new User(row) : null;
  }

  // 创建新用户
  static async create(userData) {
    const result = await databaseService.run(
      `INSERT INTO users (telegram_id, username, first_name, last_name, phone, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userData.telegram_id,
        userData.username   ?? null,
        userData.first_name ?? null,
        userData.last_name  ?? null,
        userData.phone      ?? null,
        userData.email      ?? null
      ]
    );
    
    return await User.findById(result.id);
  }

  // 更新用户信息
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
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return await User.findById(this.id);
  }

  // 增加余额
  async addBalance(amount) {
    await databaseService.run(
      'UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [amount, this.id]
    );
    return await User.findById(this.id);
  }

  // 扣除余额
  async deductBalance(amount) {
    const result = await databaseService.run(
      'UPDATE users SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND balance >= ?',
      [amount, this.id, amount]
    );
    
    if (result.changes === 0) {
      throw new Error('余额不足');
    }
    
    return await User.findById(this.id);
  }

  // 增加消费记录
  async addSpent(amount) {
    await databaseService.run(
      'UPDATE users SET total_spent = total_spent + ?, order_count = order_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [amount, this.id]
    );
    return await User.findById(this.id);
  }

  // 获取用户订单
  async getOrders(limit = 10, offset = 0) {
    return await databaseService.query(
      `SELECT o.*, p.name as product_name 
       FROM orders o 
       LEFT JOIN products p ON o.product_id = p.id 
       WHERE o.user_id = ? 
       ORDER BY o.created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      [this.id]
    );
  }

  // 获取用户统计信息
  async getStats() {
    const stats = await databaseService.get(
      `SELECT 
         COUNT(*) as total_orders,
         SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as total_spent,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders
       FROM orders 
       WHERE user_id = ?`,
      [this.id]
    );
    
    return stats;
  }

  // 序列化为JSON
  toJSON() {
    return {
      id: this.id,
      telegram_id: this.telegram_id,
      username: this.username,
      first_name: this.first_name,
      last_name: this.last_name,
      phone: this.phone,
      email: this.email,
      balance: parseFloat(this.balance),
      total_spent: parseFloat(this.total_spent),
      order_count: this.order_count,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = User;
