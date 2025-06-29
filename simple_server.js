// 简单的测试服务器
const express = require('express');
const path = require('path');
const databaseService = require('./src/database');
const Product = require('./src/database/models/Product');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 初始化数据库
databaseService.init().then(() => {
  console.log('数据库初始化成功');
}).catch(error => {
  console.error('数据库初始化失败:', error);
});

// 测试路由
app.get('/test', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json({
      success: true,
      message: '测试成功',
      data: {
        total: products.length,
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          type: p.type,
          price: p.price
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 创建商品路由
app.post('/api/products', async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.json({
      success: true,
      message: '商品创建成功',
      data: product.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取商品列表路由
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json({
      success: true,
      data: {
        products: products.map(p => p.toJSON())
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`测试服务器启动成功，端口: ${PORT}`);
  console.log(`访问 http://localhost:${PORT}/test 进行测试`);
});
