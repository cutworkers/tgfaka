# 系统架构文档

本文档描述了Telegram卡密销售系统的整体架构，包括新增的商品类型功能和发卡逻辑。

## 📋 目录

- [系统概述](#系统概述)
- [架构图](#架构图)
- [核心组件](#核心组件)
- [发卡逻辑](#发卡逻辑)
- [数据流](#数据流)
- [服务层](#服务层)
- [监控与日志](#监控与日志)

## 🎯 系统概述

Telegram卡密销售系统是一个基于Node.js的多功能电商平台，支持：

- **多渠道销售**：Telegram Bot + Web管理后台
- **双重发卡模式**：卡密库存 + API实时获取
- **完整的订单流程**：下单 → 支付 → 发卡 → 售后
- **全面监控**：性能监控 + 操作日志 + 错误追踪

## 🏗️ 架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telegram Bot  │    │   Web Frontend  │    │  Admin Panel    │
│                 │    │                 │    │                 │
│  - 商品展示     │    │  - 商品浏览     │    │  - 商品管理     │
│  - 订单处理     │    │  - 用户注册     │    │  - 订单管理     │
│  - 支付引导     │    │  - 支付处理     │    │  - 卡密管理     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │      Express Server       │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │    API Routes       │  │
                    │  │  - /api/products    │  │
                    │  │  - /api/orders      │  │
                    │  │  - /api/payments    │  │
                    │  └─────────────────────┘  │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │     Service Layer         │
                    │                           │
                    │ ┌─────────────────────┐   │
                    │ │ CardDeliveryService │   │
                    │ │  - 统一发卡接口    │   │
                    │ │  - 类型路由        │   │
                    │ │  - 错误处理        │   │
                    │ └─────────────────────┘   │
                    │                           │
                    │ ┌─────────────────────┐   │
                    │ │ OperationLogService │   │
                    │ │  - 操作记录        │   │
                    │ │  - 审计追踪        │   │
                    │ └─────────────────────┘   │
                    │                           │
                    │ ┌─────────────────────┐   │
                    │ │ PerformanceMonitor  │   │
                    │ │  - 性能监控        │   │
                    │ │  - 指标收集        │   │
                    │ └─────────────────────┘   │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │      Data Layer           │
                    │                           │
                    │ ┌─────────────────────┐   │
                    │ │    SQLite DB        │   │
                    │ │  - products         │   │
                    │ │  - cards            │   │
                    │ │  - orders           │   │
                    │ │  - operation_logs   │   │
                    │ └─────────────────────┘   │
                    │                           │
                    │ ┌─────────────────────┐   │
                    │ │   External APIs     │   │
                    │ │  - 第三方卡密API   │   │
                    │ │  - 支付网关        │   │
                    │ └─────────────────────┘   │
                    └───────────────────────────┘
```

## 🧩 核心组件

### 1. Web服务器 (Express)
- **路由管理**：API路由 + Web页面路由
- **中间件**：认证、日志、错误处理
- **静态资源**：前端资源服务

### 2. Telegram Bot
- **消息处理**：用户交互逻辑
- **命令系统**：/start, /products, /orders等
- **支付集成**：引导用户完成支付

### 3. 数据模型层
```
Product (商品)
├── id, name, description, price
├── type: 'card' | 'post'
├── post_data: JSON配置
└── status, created_at, updated_at

Card (卡密)
├── id, product_id
├── card_number, card_password
├── status: 'available' | 'sold' | 'expired'
└── batch_id, created_at

Order (订单)
├── id, order_no, user_id, product_id
├── quantity, total_amount
├── status: 'pending' | 'paid' | 'completed'
└── payment_method, created_at
```

## ⚡ 发卡逻辑

### 发卡流程架构

```
用户下单 → 支付确认 → 发卡服务 → 卡密返回
                        ↓
              ┌─────────────────────┐
              │ CardDeliveryService │
              └─────────┬───────────┘
                        │
                ┌───────┴───────┐
                │  商品类型判断  │
                └───────┬───────┘
                        │
            ┌───────────┴───────────┐
            │                       │
    ┌───────▼───────┐      ┌───────▼───────┐
    │  卡密类型发卡  │      │  POST类型发卡  │
    │               │      │               │
    │ 1. 查询可用卡密 │      │ 1. 解析API配置 │
    │ 2. 标记为已售   │      │ 2. 替换变量    │
    │ 3. 返回卡密信息 │      │ 3. 调用API     │
    │               │      │ 4. 解析响应    │
    └───────────────┘      └───────────────┘
```

### 卡密类型发卡

```javascript
// 核心逻辑
async deliverFromCardStock(product, quantity, deliveryId) {
  // 1. 查询可用卡密
  const availableCards = await Card.findAll({
    product_id: product.id,
    status: 'available',
    limit: quantity
  });
  
  // 2. 验证库存
  if (availableCards.length < quantity) {
    throw new Error('库存不足');
  }
  
  // 3. 标记为已售
  const cardIds = availableCards.map(card => card.id);
  await Card.markAsSold(cardIds);
  
  // 4. 返回卡密
  return availableCards.map(card => ({
    card_number: card.card_number,
    card_password: card.card_password,
    type: 'card'
  }));
}
```

### POST类型发卡

```javascript
// 核心逻辑
async deliverFromPostAPI(product, order, deliveryId) {
  // 1. 解析API配置
  const postConfig = JSON.parse(product.post_data);
  
  // 2. 替换变量
  const processedConfig = this.processPostVariables(postConfig, {
    product_id: product.id,
    quantity: order.quantity,
    order_id: order.id
  });
  
  // 3. 调用API
  const response = await axios({
    method: 'POST',
    url: processedConfig.url,
    headers: processedConfig.headers,
    data: processedConfig.body,
    timeout: 30000
  });
  
  // 4. 解析响应
  return this.parsePostResponse(response.data, order.quantity);
}
```

## 🔄 数据流

### 订单处理数据流

```
1. 用户下单
   ├── 创建订单记录
   ├── 生成支付链接
   └── 等待支付确认

2. 支付确认
   ├── 更新订单状态
   ├── 触发发卡流程
   └── 记录支付信息

3. 发卡流程
   ├── 调用CardDeliveryService
   ├── 根据商品类型选择发卡方式
   ├── 记录发卡日志
   └── 返回卡密信息

4. 完成订单
   ├── 更新订单状态
   ├── 发送卡密给用户
   └── 记录操作日志
```

### 监控数据流

```
操作执行 → 日志记录 → 性能监控 → 指标统计
    ↓           ↓           ↓           ↓
数据库记录   文件日志   内存缓存   统计报表
```

## 🛠️ 服务层

### CardDeliveryService
**职责**：统一的发卡服务接口
- 商品类型路由
- 发卡逻辑实现
- 错误处理和重试
- 性能监控集成

### OperationLogService
**职责**：操作日志记录
- 商品操作记录
- 发卡操作记录
- API调用记录
- 审计追踪

### PerformanceMonitor
**职责**：性能监控
- API调用监控
- 响应时间统计
- 成功率计算
- 性能告警

## 📊 监控与日志

### 日志层级

```
应用日志 (Logger)
├── INFO: 正常操作记录
├── WARN: 警告信息
├── ERROR: 错误信息
└── DEBUG: 调试信息

操作日志 (OperationLog)
├── 用户操作记录
├── 管理员操作记录
├── 系统自动操作
└── API调用记录

性能监控 (PerformanceMonitor)
├── API响应时间
├── 成功率统计
├── 错误率统计
└── 性能告警
```

### 监控指标

**系统指标**:
- CPU使用率
- 内存使用率
- 磁盘空间
- 网络连接

**业务指标**:
- 订单成功率
- 发卡成功率
- 平均响应时间
- API可用性

**告警规则**:
- 发卡失败率 > 5%
- API响应时间 > 10秒
- 系统错误率 > 1%
- 库存低于预警值

## 🔧 扩展性设计

### 水平扩展
- 无状态服务设计
- 数据库连接池
- 缓存层支持
- 负载均衡就绪

### 功能扩展
- 插件化架构
- 事件驱动设计
- 微服务拆分就绪
- API版本控制

### 性能优化
- 数据库索引优化
- 查询缓存
- 静态资源CDN
- API响应压缩

## 📝 部署架构

### 单机部署
```
┌─────────────────────────────────┐
│         Server (Linux)          │
│                                 │
│  ┌─────────────────────────┐    │
│  │      Node.js App        │    │
│  │   (Express + Bot)       │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │      SQLite DB          │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │       Nginx             │    │
│  │   (Reverse Proxy)       │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

### 集群部署
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   App Node  │    │   App Node  │    │   App Node  │
│     #1      │    │     #2      │    │     #3      │
└─────────────┘    └─────────────┘    └─────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                  ┌─────────────┐
                  │ Load Balancer│
                  │   (Nginx)   │
                  └─────────────┘
                           │
                  ┌─────────────┐
                  │  Database   │
                  │ (PostgreSQL)│
                  └─────────────┘
```

这个架构文档提供了系统的完整技术视图，有助于开发团队理解系统设计和进行后续开发。
