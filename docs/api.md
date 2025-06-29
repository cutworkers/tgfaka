# API接口文档

本文档详细描述了Telegram卡密销售系统的所有API接口。

## 📋 基础信息

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`
- **认证方式**: API Key (Header: `X-API-Key`)

## 🔐 认证

大部分API接口需要API Key认证：

```bash
curl -H "X-API-Key: your_api_key" \
     -H "Content-Type: application/json" \
     http://localhost:3000/api/products
```

## 📦 商品管理 API

### 获取商品列表
```http
GET /api/products
```

**查询参数**:
- `page` (int): 页码，默认1
- `limit` (int): 每页数量，默认20
- `status` (string): 状态筛选 (active/inactive)
- `category_id` (int): 分类筛选

**响应示例**:
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "name": "Steam充值卡",
        "description": "Steam平台充值卡",
        "price": 100.00,
        "original_price": 120.00,
        "category_id": 1,
        "category_name": "游戏充值",
        "type": "card",
        "post_data": null,
        "status": "active",
        "stock_count": 50,
        "sold_count": 25,
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

### 获取商品详情
```http
GET /api/products/{id}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Steam充值卡",
    "description": "Steam平台充值卡，支持全球使用",
    "price": 100.00,
    "original_price": 120.00,
    "category_id": 1,
    "category_name": "游戏充值",
    "type": "card",
    "post_data": null,
    "status": "active",
    "stock_count": 50,
    "sold_count": 25,
    "min_stock_alert": 10,
    "image_url": "https://example.com/image.jpg",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 创建商品
```http
POST /api/products
```

**请求体**:

**卡密类型商品**:
```json
{
  "name": "Steam充值卡",
  "description": "Steam平台充值卡",
  "price": 100.00,
  "original_price": 120.00,
  "category_id": 1,
  "type": "card",
  "min_stock_alert": 10,
  "image_url": "https://example.com/image.jpg"
}
```

**POST类型商品**:
```json
{
  "name": "API充值卡",
  "description": "通过API获取的充值卡",
  "price": 50.00,
  "category_id": 1,
  "type": "post",
  "post_data": "{\"url\":\"https://api.example.com/cards\",\"headers\":{\"Authorization\":\"Bearer token\"},\"body\":{\"product_id\":\"{{product_id}}\",\"quantity\":\"{{quantity}}\"}}",
  "min_stock_alert": 0
}
```

**字段说明**:
- `type` (string): 商品类型，可选值：`card`（卡密类型）、`post`（POST类型）
- `post_data` (string): POST类型商品的API配置，JSON格式字符串，包含：
  - `url` (string): API接口地址
  - `headers` (object): 请求头
  - `body` (object): 请求体，支持变量：`{{product_id}}`、`{{quantity}}`、`{{order_id}}`

### 更新商品
```http
PUT /api/products/{id}
```

### 删除商品
```http
DELETE /api/products/{id}
```

## 🎯 商品类型详解

### 商品类型概述

系统支持两种商品类型：

1. **卡密类型 (card)**：传统的卡密库存管理方式
2. **POST类型 (post)**：通过第三方API实时获取卡密

### 卡密类型商品

卡密类型商品从预先导入的卡密库中发卡：

**特点**:
- 需要预先导入卡密到系统
- 发卡速度快，响应稳定
- 支持库存管理和预警
- 适合固定库存的商品

**发卡流程**:
1. 用户下单
2. 系统从卡密库中选择可用卡密
3. 标记卡密为已售
4. 返回卡密信息给用户

### POST类型商品

POST类型商品通过调用第三方API实时获取卡密：

**特点**:
- 无需预先导入卡密
- 实时从第三方获取
- 支持动态库存
- 适合API供应商提供的商品

**POST配置格式**:
```json
{
  "url": "https://api.supplier.com/generate-cards",
  "headers": {
    "Authorization": "Bearer your-api-token",
    "Content-Type": "application/json",
    "X-API-Key": "your-api-key"
  },
  "body": {
    "product_id": "{{product_id}}",
    "quantity": "{{quantity}}",
    "order_id": "{{order_id}}",
    "custom_field": "custom_value"
  }
}
```

**支持的变量**:
- `{{product_id}}`: 商品ID
- `{{quantity}}`: 订单数量
- `{{order_id}}`: 订单ID

**API响应格式**:

第三方API应返回以下格式之一：

**数组格式**:
```json
[
  {
    "card_number": "1234567890",
    "card_password": "abcdef123456"
  },
  {
    "card_number": "0987654321",
    "card_password": "654321fedcba"
  }
]
```

**对象包装格式**:
```json
{
  "success": true,
  "data": [
    {
      "cardNumber": "1234567890",
      "cardPassword": "abcdef123456"
    }
  ]
}
```

**单个卡密格式**:
```json
{
  "card_number": "1234567890",
  "card_password": "abcdef123456"
}
```

**字段映射**:
系统支持多种字段名称：
- 卡号：`card_number`、`cardNumber`、`number`
- 密码：`card_password`、`cardPassword`、`password`、`code`

## 🎫 卡密管理 API

### 获取卡密列表
```http
GET /api/cards
```

**查询参数**:
- `page` (int): 页码
- `limit` (int): 每页数量
- `status` (string): 状态 (available/sold/expired)
- `product_id` (int): 商品筛选
- `batch_id` (string): 批次筛选

**响应示例**:
```json
{
  "success": true,
  "data": {
    "cards": [
      {
        "id": 1,
        "product_id": 1,
        "product_name": "Steam充值卡",
        "card_number": "STEAM001",
        "card_password": "PASS001",
        "batch_id": "BATCH_001",
        "status": "available",
        "expire_at": "2024-12-31T23:59:59.000Z",
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 500
    }
  }
}
```

### 创建单个卡密
```http
POST /api/cards
```

**请求体**:
```json
{
  "product_id": 1,
  "card_number": "STEAM001",
  "card_password": "PASS001",
  "batch_id": "BATCH_001",
  "expire_at": "2024-12-31T23:59:59.000Z"
}
```

### 批量创建卡密
```http
POST /api/cards/batch
```

**请求体**:
```json
{
  "product_id": 1,
  "batch_id": "BATCH_001",
  "cards": [
    {
      "card_number": "STEAM001",
      "card_password": "PASS001"
    },
    {
      "card_number": "STEAM002",
      "card_password": "PASS002"
    }
  ]
}
```

### CSV批量导入
```http
POST /api/cards/import
Content-Type: multipart/form-data
```

**表单数据**:
- `csvFile` (file): CSV文件
- `product_id` (int): 商品ID
- `batch_id` (string): 批次ID（可选）

### 获取卡密统计
```http
GET /api/cards/stats
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 1000,
    "available": 750,
    "sold": 200,
    "expired": 50,
    "by_product": [
      {
        "product_id": 1,
        "product_name": "Steam充值卡",
        "total": 500,
        "available": 400
      }
    ]
  }
}
```

## 💰 支付管理 API

### 创建USDT支付
```http
POST /api/payments/usdt/create
```

**请求体**:
```json
{
  "order_id": 123
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "order_no": "ORD20240101001",
    "payment_address": "TXXXxxxXXXxxxXXX",
    "payment_amount": "15.384615",
    "network": "TRC20",
    "expire_at": "2024-01-01T01:00:00.000Z"
  }
}
```

### 创建支付宝支付
```http
POST /api/payments/alipay/create
```

**请求体**:
```json
{
  "order_id": 123
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "order_no": "ORD20240101001",
    "qr_code": "https://qr.alipay.com/xxx",
    "expire_at": "2024-01-01T01:00:00.000Z"
  }
}
```

### 支付宝回调
```http
POST /api/payments/alipay/notify
```

### 查询支付状态
```http
GET /api/payments/{payment_method}/{order_no}/status
```

### 手动确认支付
```http
POST /api/payments/confirm
```

**请求体**:
```json
{
  "order_id": 123
}
```

### 获取USDT汇率
```http
GET /api/payments/usdt/rate
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "rate": 6.5,
    "currency": "CNY",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

## 📊 统计报表 API

### 获取支付统计
```http
GET /api/payments/stats
```

**查询参数**:
- `date_from` (string): 开始日期 (YYYY-MM-DD)
- `date_to` (string): 结束日期 (YYYY-MM-DD)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "overall_stats": {
      "total": 1000,
      "completed": 800,
      "total_revenue": 50000.00
    },
    "payment_method_stats": [
      {
        "payment_method": "usdt",
        "count": 500,
        "total_amount": 30000.00
      },
      {
        "payment_method": "alipay",
        "count": 300,
        "total_amount": 20000.00
      }
    ]
  }
}
```

## 🔧 系统管理 API

### 健康检查
```http
GET /api/health
```

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600.123,
  "memory": {
    "rss": 50331648,
    "heapTotal": 20971520,
    "heapUsed": 15728640
  },
  "version": "1.0.0"
}
```

### API文档
```http
GET /api/docs
```

## 📝 错误响应

所有API错误响应格式统一：

```json
{
  "success": false,
  "message": "错误描述",
  "error": "详细错误信息",
  "code": "ERROR_CODE"
}
```

### 常见错误码
- `400` - 请求参数错误
- `401` - 认证失败
- `403` - 权限不足
- `404` - 资源不存在
- `429` - 请求过于频繁
- `500` - 服务器内部错误

## 🔄 请求限制

- **频率限制**: 每分钟最多100次请求
- **文件上传**: 最大10MB
- **请求超时**: 30秒

## 📚 SDK和示例

### JavaScript示例
```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'X-API-Key': 'your_api_key',
    'Content-Type': 'application/json'
  }
});

// 获取商品列表
const products = await api.get('/products');
console.log(products.data);
```

### Python示例
```python
import requests

headers = {
    'X-API-Key': 'your_api_key',
    'Content-Type': 'application/json'
}

# 获取商品列表
response = requests.get(
    'http://localhost:3000/api/products',
    headers=headers
)
print(response.json())
```

## 🧪 测试工具

### Postman集合
导入Postman集合文件：`docs/postman_collection.json`

### cURL示例
```bash
# 获取商品列表
curl -H "X-API-Key: your_api_key" \
     http://localhost:3000/api/products

# 创建商品
curl -X POST \
     -H "X-API-Key: your_api_key" \
     -H "Content-Type: application/json" \
     -d '{"name":"测试商品","price":100}' \
     http://localhost:3000/api/products
```
