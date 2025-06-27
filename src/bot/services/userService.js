const User = require('../../database/models/User');
const logger = require('../../utils/logger');

class UserService {
  // 注册或更新用户信息
  async registerUser(telegramUser) {
    try {
      let user = await User.findByTelegramId(telegramUser.id.toString());
      
      if (!user) {
        // 创建新用户
        user = await User.create({
          telegram_id: telegramUser.id.toString(),
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name
        });
        
        logger.info('新用户注册', {
          userId: user.id,
          telegramId: telegramUser.id,
          username: telegramUser.username
        });
      } else {
        // 更新用户信息
        const updateData = {};
        
        if (user.username !== telegramUser.username) {
          updateData.username = telegramUser.username;
        }
        if (user.first_name !== telegramUser.first_name) {
          updateData.first_name = telegramUser.first_name;
        }
        if (user.last_name !== telegramUser.last_name) {
          updateData.last_name = telegramUser.last_name;
        }
        
        if (Object.keys(updateData).length > 0) {
          user = await user.update(updateData);
          logger.info('用户信息更新', {
            userId: user.id,
            telegramId: telegramUser.id,
            updates: updateData
          });
        }
      }
      
      return user;
    } catch (error) {
      logger.error('用户注册失败', {
        error: error.message,
        telegramId: telegramUser.id
      });
      throw error;
    }
  }

  // 根据Telegram ID获取用户
  async getUser(telegramId) {
    try {
      const user = await User.findByTelegramId(telegramId.toString());
      if (!user) {
        throw new Error('用户不存在');
      }
      return user;
    } catch (error) {
      logger.error('获取用户失败', {
        error: error.message,
        telegramId
      });
      throw error;
    }
  }

  // 根据Telegram ID获取用户ID
  async getUserId(telegramId) {
    const user = await this.getUser(telegramId);
    return user.id;
  }

  // 获取用户统计信息
  async getUserStats(telegramId) {
    try {
      const user = await this.getUser(telegramId);
      const stats = await user.getStats();
      
      return {
        user: user.toJSON(),
        stats
      };
    } catch (error) {
      logger.error('获取用户统计失败', {
        error: error.message,
        telegramId
      });
      throw error;
    }
  }

  // 更新用户余额
  async updateBalance(telegramId, amount, operation = 'add') {
    try {
      const user = await this.getUser(telegramId);
      
      if (operation === 'add') {
        return await user.addBalance(amount);
      } else if (operation === 'deduct') {
        return await user.deductBalance(amount);
      } else {
        throw new Error('无效的操作类型');
      }
    } catch (error) {
      logger.error('更新用户余额失败', {
        error: error.message,
        telegramId,
        amount,
        operation
      });
      throw error;
    }
  }

  // 检查用户余额是否充足
  async checkBalance(telegramId, amount) {
    try {
      const user = await this.getUser(telegramId);
      return user.balance >= amount;
    } catch (error) {
      logger.error('检查用户余额失败', {
        error: error.message,
        telegramId,
        amount
      });
      return false;
    }
  }

  // 获取用户显示名称
  getUserDisplayName(telegramUser) {
    if (telegramUser.username) {
      return `@${telegramUser.username}`;
    }
    
    const parts = [];
    if (telegramUser.first_name) {
      parts.push(telegramUser.first_name);
    }
    if (telegramUser.last_name) {
      parts.push(telegramUser.last_name);
    }
    
    return parts.length > 0 ? parts.join(' ') : `用户${telegramUser.id}`;
  }

  // 格式化用户信息
  formatUserInfo(user) {
    const displayName = user.username ? `@${user.username}` : 
                       `${user.first_name || ''} ${user.last_name || ''}`.trim();
    
    return {
      id: user.id,
      telegram_id: user.telegram_id,
      display_name: displayName || `用户${user.telegram_id}`,
      balance: parseFloat(user.balance),
      total_spent: parseFloat(user.total_spent),
      order_count: user.order_count,
      status: user.status,
      created_at: user.created_at
    };
  }

  // 验证用户状态
  async validateUserStatus(telegramId) {
    try {
      const user = await this.getUser(telegramId);
      
      if (user.status === 'banned') {
        throw new Error('您的账户已被封禁，无法使用此功能');
      }
      
      if (user.status === 'suspended') {
        throw new Error('您的账户已被暂停，请联系管理员');
      }
      
      return true;
    } catch (error) {
      logger.error('验证用户状态失败', {
        error: error.message,
        telegramId
      });
      throw error;
    }
  }

  // 记录用户操作
  async logUserAction(telegramId, action, details = {}) {
    try {
      const user = await this.getUser(telegramId);
      
      // 这里可以记录到操作日志表
      logger.info('用户操作', {
        userId: user.id,
        telegramId,
        action,
        details
      });
    } catch (error) {
      logger.error('记录用户操作失败', {
        error: error.message,
        telegramId,
        action
      });
    }
  }
}

module.exports = UserService;
