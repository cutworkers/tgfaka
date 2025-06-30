# 生产环境路由404问题修复指南

## 问题分析

生产环境中 `/health` 和 `/webhook` 路由返回404，可能的原因：

1. **路由未正确加载**
2. **Bot配置问题**
3. **代理/负载均衡器配置问题**
4. **环境变量缺失**

## 立即修复方案

### 方案1：启用路由调试

```bash
# 设置调试环境变量
export DEBUG_ROUTES=true
export DEBUG_SESSION=true

# 重启应用
pm2 restart telegram-shop
# 或
node src/app.js
```

### 方案2：测试路由状态

运行路由测试脚本：

```bash
# 在项目根目录执行
node test-routes.js

# 或指定服务器地址
BASE_URL=http://your-domain.com node test-routes.js
```

### 方案3：检查路由注册

访问路由诊断接口：
```
http://your-domain.com/debug/routes
```

这将显示所有已注册的路由。

## 详细诊断步骤

### 1. 检查健康检查路由

```bash
curl -v http://your-domain.com/health
```

**期望响应**:
```json
{
  "status": "ok",
  "timestamp": "2024-12-29T12:00:00.000Z",
  "uptime": 123.456,
  "memory": {...},
  "version": "1.0.0"
}
```

### 2. 检查API健康检查

```bash
curl -v http://your-domain.com/api/health
```

### 3. 检查Webhook路由

```bash
curl -X POST http://your-domain.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**可能的响应**:
- `404 Bot未配置` - 正常，如果Bot token未设置
- `200` - Bot正常工作
- `404 页面不存在` - 路由未正确配置

## 常见问题及解决方案

### Q1: /health 返回404

**原因**: 健康检查路由未正确注册

**解决方案**:
1. 检查 `src/app.js` 中的路由配置
2. 确保应用正确启动
3. 重启应用服务

### Q2: /webhook 返回404

**原因**: Bot服务未正确初始化或路由配置问题

**解决方案**:
1. 检查Bot token配置：
```bash
echo $BOT_TOKEN
```

2. 检查Bot初始化日志：
```bash
pm2 logs telegram-shop | grep -i bot
```

3. 如果Bot未配置，这是正常的

### Q3: 所有路由都返回404

**原因**: 应用未正确启动或端口问题

**解决方案**:
1. 检查应用状态：
```bash
pm2 status
# 或
ps aux | grep node
```

2. 检查端口占用：
```bash
netstat -tlnp | grep :3000
```

3. 检查应用日志：
```bash
pm2 logs telegram-shop
```

## 环境变量检查

确保以下环境变量正确设置：

```bash
# 必需的环境变量
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "BOT_TOKEN: ${BOT_TOKEN:0:10}..." # 只显示前10个字符

# 可选的调试变量
echo "DEBUG_ROUTES: $DEBUG_ROUTES"
echo "DEBUG_SESSION: $DEBUG_SESSION"
```

## 代理/负载均衡器配置

如果使用Nginx等代理，确保配置正确：

```nginx
# Nginx配置示例
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 特别注意webhook路由
location /webhook {
    proxy_pass http://localhost:3000/webhook;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 手动验证修复

### 1. 重启应用

```bash
# 使用PM2
pm2 restart telegram-shop

# 或直接启动
cd /path/to/telegram_shop
node src/app.js
```

### 2. 等待启动完成

查看启动日志：
```bash
pm2 logs telegram-shop --lines 50
```

期望看到：
```
服务器启动成功，端口: 3000
Bot webhook回调已配置
定时任务启动完成
错误监控任务启动完成
```

### 3. 测试关键路由

```bash
# 健康检查
curl http://localhost:3000/health

# API文档
curl http://localhost:3000/api/docs

# Webhook（应该返回Bot相关响应）
curl -X POST http://localhost:3000/webhook
```

## 监控和日志

### 启用详细日志

```bash
export LOG_LEVEL=debug
pm2 restart telegram-shop
```

### 监控路由访问

```bash
# 实时查看访问日志
pm2 logs telegram-shop | grep -E "(GET|POST|PUT|DELETE)"
```

### 检查错误日志

```bash
# 查看错误日志
pm2 logs telegram-shop | grep -i error
```

## 预防措施

1. **健康检查监控**：
   - 设置监控系统定期检查 `/health` 端点
   - 配置告警当健康检查失败时

2. **自动重启**：
   - 配置PM2自动重启策略
   - 设置内存和CPU限制

3. **日志轮转**：
   - 配置日志轮转避免磁盘空间不足
   - 保留足够的历史日志用于问题排查

## 联系支持

如果问题仍然存在，请提供：

1. **路由测试结果**：
```bash
node test-routes.js > route-test-results.txt 2>&1
```

2. **应用日志**：
```bash
pm2 logs telegram-shop --lines 100 > app-logs.txt
```

3. **系统信息**：
```bash
uname -a
node --version
npm --version
pm2 --version
```

4. **网络配置**：
```bash
netstat -tlnp | grep :3000
curl -v http://localhost:3000/health
```
