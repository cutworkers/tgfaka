#!/bin/bash

# 数据库备份脚本
# 自动备份SQLite数据库和重要文件

set -e

# 配置
BACKUP_DIR="/app/backups"
DATABASE_DIR="/app/database"
LOGS_DIR="/app/logs"
RETENTION_DAYS=30

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成时间戳
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"

echo "开始备份 - $TIMESTAMP"

# 创建备份子目录
mkdir -p "$BACKUP_PATH"

# 备份数据库
if [ -d "$DATABASE_DIR" ]; then
    echo "备份数据库文件..."
    cp -r "$DATABASE_DIR" "$BACKUP_PATH/"
    echo "数据库备份完成"
fi

# 备份重要配置文件
echo "备份配置文件..."
if [ -f "/app/.env" ]; then
    cp "/app/.env" "$BACKUP_PATH/"
fi

if [ -f "/app/ecosystem.config.js" ]; then
    cp "/app/ecosystem.config.js" "$BACKUP_PATH/"
fi

# 备份最近的日志
if [ -d "$LOGS_DIR" ]; then
    echo "备份最近日志..."
    mkdir -p "$BACKUP_PATH/logs"
    find "$LOGS_DIR" -name "*.log" -mtime -1 -exec cp {} "$BACKUP_PATH/logs/" \;
fi

# 压缩备份
echo "压缩备份文件..."
cd "$BACKUP_DIR"
tar -czf "backup_$TIMESTAMP.tar.gz" "backup_$TIMESTAMP"
rm -rf "backup_$TIMESTAMP"

# 清理旧备份
echo "清理旧备份文件..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "备份完成: backup_$TIMESTAMP.tar.gz"

# 显示备份大小
BACKUP_SIZE=$(du -h "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" | cut -f1)
echo "备份大小: $BACKUP_SIZE"

# 显示剩余备份文件
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | wc -l)
echo "当前备份文件数量: $BACKUP_COUNT"
