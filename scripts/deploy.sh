#!/bin/bash

# Telegram卡密销售系统部署脚本
# 使用方法: ./scripts/deploy.sh [environment]
# 环境: development, staging, production

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
ENVIRONMENT=${1:-production}
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    log_error "无效的环境参数: $ENVIRONMENT"
    log_info "使用方法: $0 [development|staging|production]"
    exit 1
fi

log_info "开始部署到 $ENVIRONMENT 环境..."

# 检查必要的工具
check_dependencies() {
    log_info "检查依赖工具..."
    
    local tools=("node" "npm" "git")
    for tool in "${tools[@]}"; do
        if ! command -v $tool &> /dev/null; then
            log_error "$tool 未安装"
            exit 1
        fi
    done
    
    log_success "依赖检查完成"
}

# 检查环境变量
check_environment() {
    log_info "检查环境变量..."
    
    if [ ! -f ".env" ]; then
        log_warning ".env 文件不存在，将使用默认配置"
    fi
    
    # 检查关键环境变量
    local required_vars=()
    if [ "$ENVIRONMENT" = "production" ]; then
        required_vars=("BOT_TOKEN" "DATABASE_PATH")
    fi
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_warning "环境变量 $var 未设置"
        fi
    done
    
    log_success "环境变量检查完成"
}

# 备份数据库
backup_database() {
    if [ "$ENVIRONMENT" = "production" ] && [ -f "database/production.db" ]; then
        log_info "备份生产数据库..."
        
        local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        cp database/production.db "$backup_dir/production.db.backup"
        
        log_success "数据库备份完成: $backup_dir"
    fi
}

# 安装依赖
install_dependencies() {
    log_info "安装Node.js依赖..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        npm ci --only=production
    else
        npm install
    fi
    
    log_success "依赖安装完成"
}

# 数据库初始化
setup_database() {
    log_info "初始化数据库..."
    
    if [ ! -f "database/${ENVIRONMENT}.db" ]; then
        npm run db:init
        log_success "数据库初始化完成"
    else
        log_info "数据库已存在，跳过初始化"
    fi
}

# 运行测试
run_tests() {
    if [ "$ENVIRONMENT" != "production" ]; then
        log_info "运行测试..."
        npm test
        log_success "测试通过"
    fi
}

# 构建应用
build_application() {
    log_info "构建应用..."
    
    # 如果有构建步骤，在这里添加
    # npm run build
    
    log_success "应用构建完成"
}

# 启动应用
start_application() {
    log_info "启动应用..."
    
    case $ENVIRONMENT in
        "development")
            npm run dev
            ;;
        "staging"|"production")
            # 检查PM2是否安装
            if command -v pm2 &> /dev/null; then
                pm2 start ecosystem.config.js --env $ENVIRONMENT
                log_success "应用已通过PM2启动"
            else
                log_warning "PM2未安装，使用node直接启动"
                NODE_ENV=$ENVIRONMENT npm start &
                log_success "应用已启动"
            fi
            ;;
    esac
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/api/health &> /dev/null; then
            log_success "健康检查通过"
            return 0
        fi
        
        log_info "等待应用启动... ($attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    log_error "健康检查失败"
    return 1
}

# 部署后清理
cleanup() {
    log_info "执行清理操作..."
    
    # 清理临时文件
    rm -rf tmp/*
    
    # 清理旧日志（保留最近7天）
    find logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    log_success "清理完成"
}

# 主部署流程
main() {
    log_info "=== Telegram卡密销售系统部署开始 ==="
    log_info "环境: $ENVIRONMENT"
    log_info "时间: $(date)"
    
    check_dependencies
    check_environment
    backup_database
    install_dependencies
    setup_database
    run_tests
    build_application
    start_application
    
    if health_check; then
        cleanup
        log_success "=== 部署成功完成 ==="
        log_info "应用已在 http://localhost:3000 启动"
        log_info "管理后台: http://localhost:3000/admin"
        log_info "API文档: http://localhost:3000/api/docs"
    else
        log_error "=== 部署失败 ==="
        exit 1
    fi
}

# 信号处理
trap 'log_error "部署被中断"; exit 1' INT TERM

# 执行主流程
main

# 显示部署信息
cat << EOF

=== 部署信息 ===
环境: $ENVIRONMENT
Node.js版本: $(node --version)
NPM版本: $(npm --version)
部署时间: $(date)

=== 有用的命令 ===
查看日志: tail -f logs/combined.log
重启应用: pm2 restart telegram-shop
查看状态: pm2 status
停止应用: pm2 stop telegram-shop

=== 管理地址 ===
应用首页: http://localhost:3000
管理后台: http://localhost:3000/admin
API接口: http://localhost:3000/api
健康检查: http://localhost:3000/api/health

EOF
