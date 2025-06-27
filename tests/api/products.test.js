const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../src/api/routes');
const databaseService = require('../../src/database');
const DatabaseInitializer = require('../../src/database/init');

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Products API', () => {
  beforeAll(async () => {
    // 初始化测试数据库
    const initializer = new DatabaseInitializer();
    await initializer.init();
  });

  afterAll(async () => {
    // 关闭数据库连接
    await databaseService.close();
  });

  beforeEach(async () => {
    // 清理数据
    await databaseService.run('DELETE FROM products');
    await databaseService.run('DELETE FROM categories');
    
    // 插入测试分类
    await databaseService.run(
      'INSERT INTO categories (id, name, description) VALUES (1, "测试分类", "测试用分类")'
    );
  });

  describe('GET /api/products', () => {
    test('应该返回商品列表', async () => {
      // 插入测试商品
      await databaseService.run(`
        INSERT INTO products (name, description, price, category_id, status)
        VALUES ("测试商品", "测试商品描述", 10.00, 1, "active")
      `);

      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].name).toBe('测试商品');
    });

    test('应该支持分页', async () => {
      // 插入多个测试商品
      for (let i = 1; i <= 25; i++) {
        await databaseService.run(`
          INSERT INTO products (name, description, price, category_id, status)
          VALUES ("商品${i}", "商品${i}描述", ${i * 10}, 1, "active")
        `);
      }

      const response = await request(app)
        .get('/api/products?page=2&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(10);
      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.total).toBe(25);
    });

    test('应该支持状态筛选', async () => {
      await databaseService.run(`
        INSERT INTO products (name, price, category_id, status)
        VALUES ("活跃商品", 10.00, 1, "active")
      `);
      await databaseService.run(`
        INSERT INTO products (name, price, category_id, status)
        VALUES ("非活跃商品", 20.00, 1, "inactive")
      `);

      const response = await request(app)
        .get('/api/products?status=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].name).toBe('活跃商品');
    });
  });

  describe('GET /api/products/:id', () => {
    test('应该返回指定商品详情', async () => {
      const result = await databaseService.run(`
        INSERT INTO products (name, description, price, category_id, status)
        VALUES ("测试商品", "测试商品描述", 10.00, 1, "active")
      `);

      const response = await request(app)
        .get(`/api/products/${result.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('测试商品');
      expect(response.body.data.price).toBe(10);
    });

    test('应该在商品不存在时返回404', async () => {
      const response = await request(app)
        .get('/api/products/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('商品不存在');
    });
  });

  describe('POST /api/products', () => {
    test('应该能够创建新商品', async () => {
      const productData = {
        name: '新商品',
        description: '新商品描述',
        price: 15.99,
        category_id: 1,
        min_stock_alert: 5
      };

      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(productData.name);
      expect(response.body.data.price).toBe(productData.price);
    });

    test('应该验证必填字段', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('必填字段');
    });

    test('应该验证价格格式', async () => {
      const productData = {
        name: '测试商品',
        price: 'invalid_price'
      };

      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(500); // 数据库会抛出错误

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/products/:id', () => {
    test('应该能够更新商品信息', async () => {
      const result = await databaseService.run(`
        INSERT INTO products (name, description, price, category_id, status)
        VALUES ("原商品", "原描述", 10.00, 1, "active")
      `);

      const updateData = {
        name: '更新商品',
        price: 20.00
      };

      const response = await request(app)
        .put(`/api/products/${result.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('更新商品');
      expect(response.body.data.price).toBe(20);
    });

    test('应该在商品不存在时返回404', async () => {
      const response = await request(app)
        .put('/api/products/999')
        .send({ name: '更新商品' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/products/:id', () => {
    test('应该能够删除商品', async () => {
      const result = await databaseService.run(`
        INSERT INTO products (name, price, category_id, status)
        VALUES ("待删除商品", 10.00, 1, "active")
      `);

      const response = await request(app)
        .delete(`/api/products/${result.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // 验证商品已被删除
      const checkResponse = await request(app)
        .get(`/api/products/${result.id}`)
        .expect(404);
    });

    test('应该在商品不存在时返回404', async () => {
      const response = await request(app)
        .delete('/api/products/999')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/products/:id/stats', () => {
    test('应该返回商品统计信息', async () => {
      const result = await databaseService.run(`
        INSERT INTO products (name, price, category_id, status)
        VALUES ("统计商品", 10.00, 1, "active")
      `);

      const response = await request(app)
        .get(`/api/products/${result.id}/stats`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('product');
      expect(response.body.data).toHaveProperty('sales_stats');
      expect(response.body.data).toHaveProperty('card_stats');
    });
  });
});
