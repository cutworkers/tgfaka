# Telegram Bot使用指南

本文档详细介绍Telegram Bot的功能和使用方法。

## 🤖 Bot概述

Telegram卡密销售Bot提供完整的购买流程，用户可以通过Bot浏览商品、下单购买、查看订单状态等。

### 主要功能
- 🛍️ 商品浏览和购买
- 💰 多种支付方式
- 📋 订单管理
- 💵 余额查询
- 👤 个人信息管理
- 📧 邮箱绑定
- 🎫 自动发货
- 📞 客服支持

## 🚀 Bot设置

### 1. 创建Bot
1. 在Telegram中搜索 @BotFather
2. 发送 `/newbot` 命令
3. 按提示设置Bot名称和用户名
4. 获取Bot Token

### 2. 配置Bot
```bash
# 在.env文件中配置
BOT_TOKEN=your_bot_token_here
BOT_WEBHOOK_URL=https://your-domain.com/webhook
```

### 3. 设置Bot命令
向 @BotFather 发送 `/setcommands`，然后输入：

```
start - 开始使用
products - 浏览商品
orders - 我的订单
balance - 余额查询
profile - 个人信息
bind_email - 绑定邮箱
help - 帮助信息
```

### 4. 设置Bot描述
```
/setdescription
欢迎使用卡密销售Bot！我们提供各种游戏充值卡、软件激活码等商品，支持USDT和支付宝支付，自动发货，即买即得！
```

## 📱 用户界面

### 主菜单
Bot启动后显示主菜单键盘：
```
🛍️ 商品列表    📋 我的订单
💰 余额查询    👤 个人信息
❓ 帮助
```

### 商品浏览界面
- 商品列表展示（分页）
- 商品详情查看
- 价格和库存信息
- 购买按钮

### 订单管理界面
- 订单列表查看
- 订单状态跟踪
- 支付信息展示
- 卡密信息查看

## 🛒 购买流程

### 1. 浏览商品
```
用户: 点击"🛍️ 商品列表"
Bot: 显示商品列表（内联键盘）
用户: 点击商品查看详情
Bot: 显示商品详情和购买选项
```

### 2. 选择数量
```
用户: 点击购买按钮
Bot: 显示数量选择（1张、2张、3张...）
用户: 选择购买数量
Bot: 显示支付方式选择
```

### 3. 选择支付方式
```
用户: 选择支付方式（USDT/支付宝）
Bot: 创建订单并显示支付信息
```

### 4. 完成支付
```
USDT支付:
- 显示收款地址和金额
- 用户转账后系统自动确认
- 确认后立即发货

支付宝支付:
- 显示支付二维码
- 用户扫码支付
- 支付成功后自动发货
```

### 5. 获取卡密
```
Bot: 支付确认后自动发送卡密信息
格式: 
🎫 卡密信息
订单号: ORD20240101001
商品: Steam充值卡
数量: 2张

第1张:
卡号: STEAM001
密码: PASS001

第2张:
卡号: STEAM002
密码: PASS002
```

## 📧 邮箱绑定流程

### 1. 开始绑定
```
用户: 发送 /bind_email 命令或点击"👤 个人信息"
Bot: 显示当前邮箱状态和绑定提示
```

### 2. 输入邮箱
```
用户: 输入邮箱地址（如：user@example.com）
Bot: 验证邮箱格式
```

### 3. 绑定结果
```
成功: ✅ 邮箱绑定成功！显示绑定的邮箱地址
失败: ❌ 邮箱格式不正确，请重新输入
取消: 发送 /cancel 取消操作
```

### 4. 查看绑定状态
```
用户: 点击"👤 个人信息"或发送 /profile
Bot: 显示完整个人信息，包括邮箱绑定状态
```

### 邮箱绑定特性
- ✅ 实时格式验证
- ✅ 支持邮箱更新
- ✅ 10分钟操作超时
- ✅ 随时可取消操作
- ✅ 操作日志记录

## 💬 Bot命令

### 基础命令

#### /start
```
功能: 启动Bot，显示欢迎信息和主菜单
响应: 欢迎消息 + 主菜单键盘
```

#### /products
```
功能: 直接显示商品列表
响应: 商品列表（内联键盘）
```

#### /orders
```
功能: 显示用户订单列表
响应: 订单列表（内联键盘）
```

#### /balance
```
功能: 查询用户余额和消费统计
响应: 余额信息和统计数据
```

#### /profile
```
功能: 查看个人信息
响应: 显示用户ID、昵称、邮箱、余额、消费统计等信息
```

#### /bind_email
```
功能: 绑定或更新邮箱地址
使用方法:
1. 发送 /bind_email 命令
2. 按提示输入邮箱地址
3. 系统验证格式并更新
4. 发送 /cancel 可取消操作

注意事项:
- 邮箱格式必须正确
- 用于接收重要通知
- 操作有10分钟超时限制
```

#### /help
```
功能: 显示帮助信息
响应: 使用说明和常见问题
```

### 管理员命令

#### /admin
```
功能: 管理员面板（仅管理员可用）
响应: 管理员操作菜单
```

#### /stats
```
功能: 查看系统统计（仅管理员可用）
响应: 销售统计和系统状态
```

## 🎨 消息模板

### 欢迎消息
```markdown
🎉 欢迎使用卡密销售Bot！

🛍️ 这里有各种游戏充值卡、软件激活码等商品
💰 支持USDT和支付宝支付
🚀 自动发货，即买即得

请选择您需要的功能：
```

### 商品列表消息
```markdown
🛍️ **热门商品**

1. **Steam充值卡**
   💰 ¥100.00 ~~¥120.00~~ 🔥17%OFF
   📦 库存: 50张

2. **Origin充值卡**
   💰 ¥50.00
   📦 库存: 30张

👆 点击上方按钮查看详情并购买
```

### 商品详情消息
```markdown
🛍️ **Steam充值卡**

📝 Steam平台充值卡，支持全球使用，面值100元人民币

💰 价格: ¥100.00 ~~¥120.00~~ (17% OFF)
📦 库存: 50张
📊 已售: 125张
🏷️ 分类: 游戏充值
```

### 支付信息消息
```markdown
💳 **支付信息**

🆔 订单号: `ORD20240101001`
📦 商品: Steam充值卡 x1
💰 金额: ¥100.00

💰 **USDT支付 (TRC20)**
📍 收款地址:
`TXXXxxxXXXxxxXXX`

💵 支付金额: **15.384615 USDT**

⚠️ **重要提醒:**
• 请使用TRC20网络转账
• 请准确转账上述金额
• 转账后系统将自动确认
• 确认后立即自动发货

⏰ 订单将在 **30分钟** 后过期
```

### 个人信息消息
```markdown
👤 **个人信息**

🆔 用户ID: `123456789`
👤 用户名: @username
📝 昵称: 张三
📧 邮箱: user@example.com
💰 余额: ¥50.00
💳 总消费: ¥500.00
📦 订单数: 5笔
📅 注册时间: 2024-01-01 10:30

💡 **可用命令:**
• /bind_email - 绑定邮箱
• /balance - 查看余额
• /orders - 我的订单
```

### 邮箱绑定消息
```markdown
📧 **邮箱绑定**

当前绑定邮箱: `user@example.com`

请发送新的邮箱地址来更新绑定，或发送 /cancel 取消操作。

📝 **注意事项:**
• 请确保邮箱地址正确
• 邮箱将用于接收重要通知
• 发送 /cancel 可取消操作
```

### 邮箱绑定成功消息
```markdown
✅ **邮箱绑定成功！**

📧 绑定邮箱: `user@example.com`

您现在可以通过此邮箱接收重要通知。
```

## 🔧 Bot配置

### 按钮配置
```javascript
// 主菜单按钮
const mainKeyboard = [
  ['🛍️ 商品列表', '📋 我的订单'],
  ['💰 余额查询', '👤 个人信息'],
  ['❓ 帮助']
];

// 商品列表按钮（每行2个）
const productButtons = products.map(product => 
  Markup.button.callback(
    `${product.name} (¥${product.price})`,
    `product_${product.id}_detail`
  )
);
```

### 分页配置
```javascript
// 分页设置
const PAGE_SIZE = 10;  // 每页显示数量
const MAX_BUTTONS_PER_ROW = 2;  // 每行最大按钮数

// 分页按钮
if (page > 1) {
  buttons.push(Markup.button.callback('⬅️ 上一页', `products_page_${page - 1}`));
}
if (hasNextPage) {
  buttons.push(Markup.button.callback('下一页 ➡️', `products_page_${page + 1}`));
}
```

### 错误处理
```javascript
// 用户友好的错误消息
const errorMessages = {
  'PRODUCT_NOT_FOUND': '商品不存在或已下架',
  'INSUFFICIENT_STOCK': '库存不足，请选择其他商品',
  'ORDER_EXPIRED': '订单已过期，请重新下单',
  'PAYMENT_FAILED': '支付失败，请重试或联系客服',
  'USER_BANNED': '您的账户已被限制，请联系客服'
};
```

## 📊 数据统计

### 用户行为统计
- 用户注册数量
- 活跃用户数量
- 命令使用频率
- 购买转化率

### 商品统计
- 商品浏览次数
- 商品购买次数
- 热门商品排行
- 库存预警

### 订单统计
- 订单创建数量
- 支付成功率
- 平均订单金额
- 支付方式分布

## 🔒 安全措施

### 用户验证
```javascript
// 检查用户状态
if (user.status === 'banned') {
  return ctx.reply('您的账户已被封禁，无法使用此功能');
}

// 检查用户权限
if (isAdminCommand && !isAdmin(ctx.from.id)) {
  return ctx.reply('权限不足');
}
```

### 防刷机制
```javascript
// 频率限制
const userLastAction = userActionCache.get(userId);
if (userLastAction && Date.now() - userLastAction < 1000) {
  return ctx.answerCbQuery('操作过于频繁，请稍后再试');
}
```

### 数据验证
```javascript
// 订单验证
if (order.user_id !== userId) {
  return ctx.reply('无权访问此订单');
}

// 金额验证
if (amount <= 0 || amount > MAX_AMOUNT) {
  return ctx.reply('金额无效');
}
```

## 🛠️ 自定义开发

### 添加新命令
```javascript
// 在 src/bot/commands/ 下创建新文件
bot.command('newcommand', async (ctx) => {
  await ctx.reply('新命令响应');
});
```

### 添加新的回调处理
```javascript
// 在 src/bot/handlers/ 下添加处理器
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  
  if (data.startsWith('custom_')) {
    await handleCustomCallback(ctx, data);
  }
});
```

### 自定义消息模板
```javascript
// 在 src/bot/templates/ 下创建模板
const customTemplate = (data) => `
🎯 **自定义消息**

📊 数据: ${data.value}
📅 时间: ${new Date().toLocaleString()}
`;
```

## 📞 技术支持

### 常见问题
1. **Bot无响应**: 检查Token配置和网络连接
2. **支付失败**: 检查支付配置和回调地址
3. **卡密发送失败**: 检查库存和订单状态

### 调试方法
```bash
# 查看Bot日志
tail -f logs/bot.log

# 测试Bot连接
curl https://api.telegram.org/bot<TOKEN>/getMe

# 检查Webhook状态
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### 联系支持
- 📧 技术支持: tech@example.com
- 💬 Telegram: @support_bot
- 📞 电话: +86-xxx-xxxx-xxxx
