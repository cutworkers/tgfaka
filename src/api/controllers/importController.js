const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Card = require('../../database/models/Card');
const Product = require('../../database/models/Product');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname) === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('只支持CSV文件格式'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

class ImportController {
  // 上传中间件
  static uploadMiddleware = upload.single('csvFile');

  // 批量导入卡密
  static async importCards(req, res) {
    let filePath = null;
    
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传CSV文件'
        });
      }

      const { product_id, batch_id, expire_at } = req.body;

      // 验证商品是否存在
      if (!product_id) {
        return res.status(400).json({
          success: false,
          message: '商品ID为必填字段'
        });
      }

      const product = await Product.findById(product_id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: '商品不存在'
        });
      }

      filePath = req.file.path;
      const batchIdToUse = batch_id || `IMPORT_${Date.now()}_${uuidv4().substr(0, 8)}`;
      
      // 解析CSV文件
      const cards = await ImportController.parseCSV(filePath);
      
      if (cards.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'CSV文件中没有有效的卡密数据'
        });
      }

      // 验证CSV格式
      const validationResult = ImportController.validateCards(cards);
      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          message: 'CSV格式错误',
          errors: validationResult.errors
        });
      }

      // 准备卡密数据
      const cardsData = cards.map(card => ({
        product_id: parseInt(product_id),
        card_number: card.card_number,
        card_password: card.card_password,
        batch_id: batchIdToUse,
        expire_at: card.expire_at || expire_at
      }));

      // 批量创建卡密
      const cardIds = await Card.createBatch(cardsData);

      // 更新商品库存
      await product.updateStock(cardIds.length, 'add');

      logger.info('CSV导入卡密成功', {
        productId: product_id,
        batchId: batchIdToUse,
        count: cardIds.length,
        fileName: req.file.originalname
      });

      res.json({
        success: true,
        message: `成功导入 ${cardIds.length} 张卡密`,
        data: {
          batch_id: batchIdToUse,
          count: cardIds.length,
          product_name: product.name,
          imported_cards: cardIds.length
        }
      });

    } catch (error) {
      logger.error('CSV导入失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'CSV导入失败',
        error: error.message
      });
    } finally {
      // 清理上传的文件
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  // 解析CSV文件
  static parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const cards = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // 支持多种列名格式
          const card = {
            card_number: row.card_number || row.cardNumber || row['卡号'] || row['Card Number'],
            card_password: row.card_password || row.cardPassword || row['密码'] || row['Password'],
            expire_at: row.expire_at || row.expireAt || row['过期时间'] || row['Expire At']
          };
          
          if (card.card_number && card.card_password) {
            cards.push(card);
          }
        })
        .on('end', () => {
          resolve(cards);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  // 验证卡密数据
  static validateCards(cards) {
    const errors = [];
    const cardNumbers = new Set();

    cards.forEach((card, index) => {
      const rowNum = index + 1;

      // 检查必填字段
      if (!card.card_number || !card.card_password) {
        errors.push(`第${rowNum}行：卡号和密码不能为空`);
        return;
      }

      // 检查卡号长度
      if (card.card_number.length < 6 || card.card_number.length > 50) {
        errors.push(`第${rowNum}行：卡号长度应在6-50字符之间`);
      }

      // 检查密码长度
      if (card.card_password.length < 6 || card.card_password.length > 50) {
        errors.push(`第${rowNum}行：密码长度应在6-50字符之间`);
      }

      // 检查卡号重复
      if (cardNumbers.has(card.card_number)) {
        errors.push(`第${rowNum}行：卡号重复 - ${card.card_number}`);
      } else {
        cardNumbers.add(card.card_number);
      }

      // 验证过期时间格式
      if (card.expire_at && !ImportController.isValidDate(card.expire_at)) {
        errors.push(`第${rowNum}行：过期时间格式错误，应为YYYY-MM-DD HH:mm:ss格式`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 验证日期格式
  static isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  // 下载CSV模板
  static downloadTemplate(req, res) {
    try {
      const csvContent = [
        'card_number,card_password,expire_at',
        'SAMPLE123456789,password123,2024-12-31 23:59:59',
        'SAMPLE987654321,password456,2024-12-31 23:59:59'
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="card_import_template.csv"');
      res.send(csvContent);

    } catch (error) {
      logger.error('下载模板失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '下载模板失败',
        error: error.message
      });
    }
  }

  // 获取导入历史
  static async getImportHistory(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // 获取批次信息
      const batches = await Card.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // 按批次分组统计
      const batchStats = {};
      batches.forEach(card => {
        if (!batchStats[card.batch_id]) {
          batchStats[card.batch_id] = {
            batch_id: card.batch_id,
            product_id: card.product_id,
            product_name: card.product_name,
            total: 0,
            available: 0,
            sold: 0,
            expired: 0,
            created_at: card.created_at
          };
        }
        
        batchStats[card.batch_id].total++;
        batchStats[card.batch_id][card.status]++;
      });

      const result = Object.values(batchStats)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      res.json({
        success: true,
        data: {
          batches: result,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: result.length
          }
        }
      });

    } catch (error) {
      logger.error('获取导入历史失败', { error: error.message });
      res.status(500).json({
        success: false,
        message: '获取导入历史失败',
        error: error.message
      });
    }
  }
}

module.exports = ImportController;
