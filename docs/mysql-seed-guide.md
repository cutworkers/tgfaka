# MySQL种子数据适配指南

本指南介绍了如何在MySQL环境下使用种子数据功能。

## 📋 概述

种子数据系统已完全适配MySQL环境，支持：
- ✅ MySQL和SQLite双数据库兼容
- ✅ 自动语法适配（INSERT IGNORE vs INSERT OR IGNORE）
- ✅ 数据库类型检测和验证
- ✅ 详细的日志记录和错误处理
- ✅ 统计信息输出

## 🚀 快速开始

### 1. 配置MySQL环境

确保`.env`文件中包含正确的MySQL配置：

```bash
# 数据库配置（关键：设置数据库类型）
DATABASE_TYPE=mysql

# MySQL数据库配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=telegram_shop
MYSQL_USERNAME=root
MYSQL_PASSWORD=your_password
MYSQL_CHARSET=utf8mb4
MYSQL_TIMEZONE=+08:00
MYSQL_CONNECTION_LIMIT=10
```

**重要**: `DATABASE_TYPE`环境变量是关键配置，种子数据系统会根据此值自动适配SQL语法。

### 2. 初始化数据库

```bash
# 初始化数据库表结构
npm run db:init
```

### 3. 创建种子数据

```bash
# 创建种子数据
npm run db:seed

# 清理并重新创建种子数据
npm run db:seed:clean

# 或者直接使用参数
npm run db:seed -- --clean
```

### 4. 测试MySQL兼容性

```bash
# 运行MySQL兼容性测试
npm run db:test:mysql
```

## 🔧 功能特性

### 数据库类型自动检测

系统会根据`.env`文件中的`DATABASE_TYPE`配置自动适配SQL语法：

```javascript
// 配置优先级：DATABASE_TYPE环境变量 > config.database.type > 默认sqlite
getDatabaseTypeFromConfig() {
  const envType = process.env.DATABASE_TYPE;
  const configType = config.database.type;
  const defaultType = 'sqlite';
  
  return (envType || configType || defaultType).toLowerCase();
}

// 自动选择合适的INSERT语句
const insertIgnoreSql = this.dbType === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
```

**配置优先级**:
1. `DATABASE_TYPE` 环境变量（最高优先级）
2. `config.database.type` 配置文件
3. `sqlite` 默认值

### 智能重复数据处理

- **分类数据**: 使用INSERT IGNORE避免重复创建
- **商品数据**: 先检查名称是否存在，避免重复
- **卡密数据**: 检查商品是否已有卡密，避免重复创建

### 详细的统计信息

创建完成后会显示详细的统计信息：

```
📊 种子数据统计信息:
数据库类型: MYSQL
分类数量: 4
商品数量: 9
卡密总数: 78
卡密状态分布:
  - available: 78
```

## 📊 创建的数据

### 商品分类 (4个)
- 🎮 游戏充值
- 💻 软件激活  
- 👑 会员服务
- 🎁 礼品卡

### 示例商品 (9个)
- 王者荣耀点券
- 和平精英UC
- 原神创世结晶
- Windows 11 Pro
- Office 2021
- 爱奇艺VIP月卡
- 腾讯视频VIP月卡
- 京东E卡
- 天猫超市卡

### 卡密数据
- 每个商品随机生成5-14张卡密
- 卡号格式：XXXX-XXXX-XXXX-XXXX
- 密码格式：12位随机字符
- 批次ID：BATCH_时间戳_商品ID

## 🛠️ 高级用法

### 命令行选项

```bash
# 清理现有种子数据并重新创建
node src/database/seed.js --clean
node src/database/seed.js -c

# 查看帮助信息
node src/database/seed.js --help
```

### 编程方式使用

```javascript
const DatabaseSeeder = require('./src/database/seed');

const seeder = new DatabaseSeeder();

// 创建种子数据
await seeder.seed();

// 清理并重新创建
await seeder.seed({ clean: true });
```

### 自定义数据

可以修改`src/database/seed.js`中的数据数组来自定义种子数据：

```javascript
const categories = [
  {
    name: '自定义分类',
    description: '自定义分类描述',
    icon: '🔥',
    sort_order: 1
  }
  // ... 更多分类
];
```

## 🔍 故障排除

### 常见错误

**1. 连接被拒绝 (ECONNREFUSED)**
```
解决方案:
- 检查MySQL服务是否运行
- 验证主机和端口配置
- 检查防火墙设置
```

**2. 访问被拒绝 (ER_ACCESS_DENIED_ERROR)**
```
解决方案:
- 验证用户名和密码
- 检查用户权限
- 确认数据库访问权限
```

**3. 数据库不存在 (ER_BAD_DB_ERROR)**
```
解决方案:
- 创建目标数据库
- 验证数据库名称拼写
```

**4. 表不存在**
```
解决方案:
- 先运行: npm run db:init
- 检查数据库初始化是否成功
```

### 调试模式

设置环境变量启用详细日志：

```bash
LOG_LEVEL=debug npm run db:seed
```

### 验证数据

创建完成后可以通过以下方式验证：

```sql
-- 检查分类
SELECT * FROM categories;

-- 检查商品
SELECT p.name, c.name as category, p.price, p.stock_count 
FROM products p 
LEFT JOIN categories c ON p.category_id = c.id;

-- 检查卡密
SELECT p.name, COUNT(ca.id) as card_count 
FROM products p 
LEFT JOIN cards ca ON p.id = ca.product_id 
GROUP BY p.id, p.name;
```

## 📈 性能优化

### 批量操作

对于大量数据，建议使用事务：

```javascript
await databaseService.transaction(async (db) => {
  for (const item of largeDataSet) {
    await db.run(sql, params);
  }
});
```

### 索引优化

确保相关字段有适当的索引：

```sql
-- 商品名称索引（用于重复检查）
CREATE INDEX idx_products_name ON products(name);

-- 卡密商品ID索引
CREATE INDEX idx_cards_product_id ON cards(product_id);
```

## 🔒 安全注意事项

1. **生产环境**: 清理功能在生产环境被禁用
2. **敏感数据**: 示例卡密仅用于测试，不包含真实信息
3. **权限控制**: 确保数据库用户权限最小化
4. **备份**: 在清理数据前建议备份

## 📞 技术支持

如果遇到问题：

1. 查看日志文件：`logs/info.log`
2. 运行测试脚本：`npm run db:test:mysql`
3. 检查数据库连接：`npm run db:init`
4. 查看详细错误：设置`LOG_LEVEL=debug`

---

✅ **MySQL种子数据适配完成！现在可以在MySQL环境下正常使用种子数据功能。**