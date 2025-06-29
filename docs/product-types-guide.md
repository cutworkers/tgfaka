# 商品类型使用指南

本指南详细介绍了Telegram卡密销售系统中的商品类型功能，包括配置方法、最佳实践和常见问题解决方案。

## 📋 目录

- [概述](#概述)
- [卡密类型商品](#卡密类型商品)
- [POST类型商品](#post类型商品)
- [配置示例](#配置示例)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)
- [性能监控](#性能监控)

## 🎯 概述

系统支持两种商品类型：

| 类型 | 描述 | 适用场景 | 优势 | 劣势 |
|------|------|----------|------|------|
| **卡密类型** | 从预导入的卡密库发卡 | 固定库存商品 | 响应快速、稳定可靠 | 需要预先导入 |
| **POST类型** | 通过API实时获取卡密 | 动态库存商品 | 无需预导入、库存灵活 | 依赖第三方API |

## 💳 卡密类型商品

### 特点
- ✅ 发卡速度快（通常 < 100ms）
- ✅ 不依赖外部服务
- ✅ 支持批量导入
- ✅ 库存管理精确
- ❌ 需要预先准备卡密

### 配置步骤

1. **创建商品**
```json
{
  "name": "Steam 100元充值卡",
  "description": "Steam平台充值卡，支持全球使用",
  "price": 95.00,
  "original_price": 100.00,
  "type": "card",
  "category_id": 1,
  "min_stock_alert": 10
}
```

2. **导入卡密**
   - 进入管理后台 → 卡密管理
   - 选择对应商品
   - 批量导入格式：`卡号#密码`

3. **监控库存**
   - 设置合理的库存预警值
   - 定期检查库存状态
   - 及时补充卡密

### 管理建议
- 建议库存保持在预期销量的2-3倍
- 设置库存预警，避免缺货
- 定期清理过期卡密

## 🔗 POST类型商品

### 特点
- ✅ 无需预先导入卡密
- ✅ 实时库存，不会缺货
- ✅ 支持复杂的API交互
- ❌ 依赖第三方API稳定性
- ❌ 响应时间较长

### 配置步骤

1. **创建商品**
```json
{
  "name": "API充值卡",
  "description": "通过API实时获取的充值卡",
  "price": 50.00,
  "type": "post",
  "post_data": "见下方配置示例",
  "min_stock_alert": 0
}
```

2. **配置POST数据**
```json
{
  "url": "https://api.supplier.com/generate-cards",
  "headers": {
    "Authorization": "Bearer your-api-token",
    "Content-Type": "application/json",
    "X-Supplier-ID": "your-supplier-id"
  },
  "body": {
    "product_code": "STEAM_100",
    "quantity": "{{quantity}}",
    "order_reference": "{{order_id}}",
    "callback_url": "https://yoursite.com/callback"
  }
}
```

### API要求

**请求超时**: 30秒
**重试机制**: 暂不支持，请确保API稳定性
**响应格式**: 支持多种格式（见配置示例）

## 📝 配置示例

### 示例1：游戏充值卡供应商

```json
{
  "url": "https://api.gamecard.com/v1/generate",
  "headers": {
    "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "Content-Type": "application/json",
    "X-Client-ID": "telegram-shop-001"
  },
  "body": {
    "product_id": "{{product_id}}",
    "quantity": "{{quantity}}",
    "order_id": "{{order_id}}",
    "format": "json"
  }
}
```

**预期响应**:
```json
{
  "status": "success",
  "data": [
    {
      "card_number": "1234-5678-9012-3456",
      "card_password": "ABCD-EFGH-1234"
    }
  ]
}
```

### 示例2：礼品卡供应商

```json
{
  "url": "https://giftcard-api.com/api/v2/cards/generate",
  "headers": {
    "X-API-Key": "your-api-key-here",
    "Accept": "application/json"
  },
  "body": {
    "type": "digital",
    "value": 100,
    "count": "{{quantity}}",
    "reference": "order_{{order_id}}"
  }
}
```

**预期响应**:
```json
[
  {
    "cardNumber": "9876543210123456",
    "securityCode": "789",
    "expiryDate": "2025-12-31"
  }
]
```

### 示例3：加密货币充值

```json
{
  "url": "https://crypto-cards.io/api/generate",
  "headers": {
    "Authorization": "ApiKey your-secret-key",
    "Content-Type": "application/json"
  },
  "body": {
    "currency": "USDT",
    "amount": 50,
    "quantity": "{{quantity}}",
    "webhook": "https://yoursite.com/webhook/{{order_id}}"
  }
}
```

## 🎯 最佳实践

### 安全性
1. **API密钥管理**
   - 使用环境变量存储敏感信息
   - 定期轮换API密钥
   - 限制API访问权限

2. **数据验证**
   - 验证API响应格式
   - 检查卡密有效性
   - 记录所有交易

### 性能优化
1. **响应时间**
   - 选择响应时间 < 5秒的API
   - 设置合理的超时时间
   - 监控API性能指标

2. **错误处理**
   - 实现重试机制
   - 记录详细错误日志
   - 设置降级方案

### 监控告警
1. **关键指标**
   - API成功率 > 95%
   - 平均响应时间 < 3秒
   - 错误率 < 5%

2. **告警设置**
   - API连续失败 > 3次
   - 响应时间 > 10秒
   - 成功率 < 90%

## 🔧 故障排除

### 常见问题

**Q: POST API调用失败**
A: 检查以下项目：
- API地址是否正确
- 认证信息是否有效
- 请求格式是否符合要求
- 网络连接是否正常

**Q: 卡密格式解析失败**
A: 确认API响应格式：
- 检查字段名称映射
- 验证JSON格式正确性
- 确认数据类型匹配

**Q: 变量替换不生效**
A: 检查变量格式：
- 使用双大括号：`{{variable}}`
- 支持的变量：product_id, quantity, order_id
- 区分大小写

### 调试技巧

1. **查看日志**
```bash
# 查看发卡日志
tail -f logs/info.log | grep "delivery"

# 查看API调用日志
tail -f logs/info.log | grep "POST API"
```

2. **测试API配置**
```bash
# 使用curl测试API
curl -X POST "https://api.example.com/cards" \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 1, "product_id": 123}'
```

## 📊 性能监控

### 监控指标

系统自动记录以下性能指标：

1. **API调用统计**
   - 总调用次数
   - 成功/失败次数
   - 平均响应时间
   - 最大/最小响应时间

2. **发卡性能**
   - 发卡成功率
   - 平均发卡时间
   - 错误分布

### 查看监控数据

```javascript
// 获取性能统计
const stats = performanceMonitor.getPerformanceStats();
console.log(stats);

// 获取URL统计
const urlStats = performanceMonitor.getUrlStats();
console.log(urlStats);
```

### 性能优化建议

1. **API选择**
   - 优先选择响应时间稳定的API
   - 避免使用高延迟的API
   - 考虑地理位置因素

2. **配置优化**
   - 减少不必要的请求头
   - 优化请求体大小
   - 使用HTTP/2协议

3. **缓存策略**
   - 对于相同参数的请求考虑缓存
   - 实现智能重试机制
   - 设置合理的超时时间

## 📞 技术支持

如果遇到问题，请提供以下信息：

1. 商品ID和类型
2. 错误日志
3. API配置（隐藏敏感信息）
4. 复现步骤

联系方式：
- 邮箱：support@example.com
- 文档：https://docs.example.com
- GitHub：https://github.com/example/tgfaka
