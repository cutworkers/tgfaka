const databaseService = require('../index');
const { v4: uuidv4 } = require('uuid');

class Order {
  constructor(data = {}) {
    this.id = data.id;
    this.order_no = data.order_no;
    this.user_id = data.user_id;
    this.product_id = data.product_id;
    this.quantity = data.quantity || 1;
    this.unit_price = data.unit_price;
    this.total_amount = data.total_amount;
    this.payment_method = data.payment_method;
    this.status = data.status || 'pending';
    this.payment_address = data.payment_address;
    this.payment_amount = data.payment_amount;
    this.payment_txid = data.payment_txid;
    this.expire_at = data.expire_at;
    this.paid_at = data.paid_at;
    this.completed_at = data.completed_at;
    this.notes = data.notes;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 根据ID查找订单
  static async findById(id) {
    const row = await databaseService.get(
      `SELECT o.*, p.name as product_name, u.telegram_id, u.username 
       FROM orders o 
       LEFT JOIN products p ON o.product_id = p.id 
       LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.id = ?`,
      [id]
    );
    return row ? new Order(row) : null;
  }

  // 根据订单号查找订单
  static async findByOrderNo(orderNo) {
    const row = await databaseService.get(
      `SELECT o.*, p.name as product_name, u.telegram_id, u.username 
       FROM orders o 
       LEFT JOIN products p ON o.product_id = p.id 
       LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.order_no = ?`,
      [orderNo]
    );
    return row ? new Order(row) : null;
  }

  // 获取所有订单列表
  static async findAll(options = {}) {
    let sql = `
      SELECT o.*, p.name as product_name, u.telegram_id, u.username
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // 状态筛选
    if (options.status) {
      sql += ' AND o.status = ?';
      params.push(options.status);
    }

    // 用户筛选
    if (options.user_id) {
      sql += ' AND o.user_id = ?';
      params.push(options.user_id);
    }

    // 商品筛选
    if (options.product_id) {
      sql += ' AND o.product_id = ?';
      params.push(options.product_id);
    }

    // 支付方式筛选
    if (options.payment_method) {
      sql += ' AND o.payment_method = ?';
      params.push(options.payment_method);
    }

    // 日期范围筛选
    if (options.date_from) {
      sql += ' AND o.created_at >= ?';
      params.push(options.date_from);
    }

    if (options.date_to) {
      sql += ' AND o.created_at <= ?';
      params.push(options.date_to);
    }

    // 排序
    sql += ' ORDER BY o.created_at DESC';

    // 分页
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);

      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = await databaseService.query(sql, params);
    return rows.map(row => new Order(row));
  }

  // 根据用户ID获取订单列表
  static async findByUserId(userId, options = {}) {
    return await Order.findAll({ ...options, user_id: userId });
  }

  // 创建新订单
  static async create(orderData) {
    const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // 计算过期时间（默认30分钟）
    const expireAt = new Date();
    expireAt.setMinutes(expireAt.getMinutes() + (orderData.timeout_minutes || 30));

    const result = await databaseService.run(
      `INSERT INTO orders (order_no, user_id, product_id, quantity, unit_price, 
                          total_amount, payment_method, payment_address, payment_amount, 
                          expire_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNo,
        orderData.user_id,
        orderData.product_id,
        orderData.quantity || 1,
        orderData.unit_price,
        orderData.total_amount,
        orderData.payment_method,
        orderData.payment_address,
        orderData.payment_amount,
        expireAt.toISOString(),
        orderData.notes
      ]
    );
    
    return await Order.findById(result.id);
  }

  // 更新订单状态
  async updateStatus(status, additionalData = {}) {
    const updateData = { status, ...additionalData };
    
    // 根据状态设置时间戳
    if (status === 'paid' && !updateData.paid_at) {
      updateData.paid_at = new Date().toISOString();
    }
    if (status === 'completed' && !updateData.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    const fields = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(this.id);
    
    await databaseService.run(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return await Order.findById(this.id);
  }

  // 标记为已支付
  async markAsPaid(paymentData = {}) {
    return await this.updateStatus('paid', {
      payment_txid: paymentData.txid,
      paid_at: new Date().toISOString()
    });
  }

  // 标记为已完成
  async markAsCompleted() {
    return await this.updateStatus('completed', {
      completed_at: new Date().toISOString()
    });
  }

  // 标记为已取消
  async markAsCancelled(reason = '') {
    return await this.updateStatus('cancelled', {
      notes: reason
    });
  }

  // 标记为已过期
  async markAsExpired() {
    return await this.updateStatus('expired');
  }

  // 检查订单是否过期
  isExpired() {
    if (!this.expire_at) return false;
    return new Date(this.expire_at) < new Date();
  }

  // 获取订单的卡密
  async getCards() {
    const rows = await databaseService.query(
      `SELECT c.* FROM cards c 
       INNER JOIN order_cards oc ON c.id = oc.card_id 
       WHERE oc.order_id = ?`,
      [this.id]
    );
    return rows;
  }

  // 分配卡密给订单
  async assignCards(cardIds) {
    await databaseService.transaction(async () => {
      // 插入订单卡密关联
      for (const cardId of cardIds) {
        await databaseService.run(
          'INSERT INTO order_cards (order_id, card_id) VALUES (?, ?)',
          [this.id, cardId]
        );
        
        // 更新卡密状态为已售出
        await databaseService.run(
          'UPDATE cards SET status = "sold", sold_at = CURRENT_TIMESTAMP WHERE id = ?',
          [cardId]
        );
      }
    });
  }

  // 获取订单统计
  static async getStats(options = {}) {
    let sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
        SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as total_revenue
      FROM orders
    `;
    const params = [];

    if (options.user_id) {
      sql += ' WHERE user_id = ?';
      params.push(options.user_id);
    }

    if (options.date_from) {
      sql += options.user_id ? ' AND' : ' WHERE';
      sql += ' created_at >= ?';
      params.push(options.date_from);
    }

    if (options.date_to) {
      sql += (options.user_id || options.date_from) ? ' AND' : ' WHERE';
      sql += ' created_at <= ?';
      params.push(options.date_to);
    }

    return await databaseService.get(sql, params);
  }

  // 批量更新过期订单
  static async updateExpiredOrders() {
    const result = await databaseService.run(
      `UPDATE orders 
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP 
       WHERE status = 'pending' 
         AND expire_at < datetime('now')`
    );
    
    return result.changes;
  }

  // 获取待支付订单数量
  static async getPendingCount(userId = null) {
    let sql = 'SELECT COUNT(*) as count FROM orders WHERE status = "pending"';
    const params = [];
    
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    
    const result = await databaseService.get(sql, params);
    return result.count;
  }

  // 序列化为JSON
  toJSON() {
    return {
      id: this.id,
      order_no: this.order_no,
      user_id: this.user_id,
      product_id: this.product_id,
      quantity: this.quantity,
      unit_price: parseFloat(this.unit_price),
      total_amount: parseFloat(this.total_amount),
      payment_method: this.payment_method,
      status: this.status,
      payment_address: this.payment_address,
      payment_amount: this.payment_amount ? parseFloat(this.payment_amount) : null,
      payment_txid: this.payment_txid,
      expire_at: this.expire_at,
      paid_at: this.paid_at,
      completed_at: this.completed_at,
      notes: this.notes,
      created_at: this.created_at,
      updated_at: this.updated_at,
      product_name: this.product_name,
      telegram_id: this.telegram_id,
      username: this.username
    };
  }
}

module.exports = Order;
