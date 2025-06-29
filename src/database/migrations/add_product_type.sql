-- 为products表添加type和post_data字段的迁移脚本
-- 执行时间: 2024-12-29

-- 添加type字段，默认值为'card'
ALTER TABLE products ADD COLUMN type TEXT DEFAULT 'card' CHECK (type IN ('card', 'post'));

-- 添加post_data字段，用于存储POST类型商品的API配置
ALTER TABLE products ADD COLUMN post_data TEXT;

-- 更新现有商品的type字段为'card'（确保数据一致性）
UPDATE products SET type = 'card' WHERE type IS NULL;
