const User = require('../../src/database/models/User');
const databaseService = require('../../src/database');
const DatabaseInitializer = require('../../src/database/init');

describe('User Model', () => {
  beforeAll(async () => {
    // 初始化测试数据库
    const initializer = new DatabaseInitializer();
    await initializer.init();
  });

  afterAll(async () => {
    // 关闭数据库连接
    await databaseService.close();
  });

  beforeEach(async () => {
    // 清理用户表
    await databaseService.run('DELETE FROM users');
  });

  describe('创建用户', () => {
    test('应该能够创建新用户', async () => {
      const userData = {
        telegram_id: '123456789',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User'
      };

      const user = await User.create(userData);

      expect(user).toBeDefined();
      expect(user.telegram_id).toBe(userData.telegram_id);
      expect(user.username).toBe(userData.username);
      expect(user.first_name).toBe(userData.first_name);
      expect(user.last_name).toBe(userData.last_name);
      expect(user.balance).toBe(0);
      expect(user.status).toBe('active');
    });

    test('应该拒绝重复的telegram_id', async () => {
      const userData = {
        telegram_id: '123456789',
        username: 'testuser1'
      };

      await User.create(userData);

      // 尝试创建相同telegram_id的用户
      const duplicateUserData = {
        telegram_id: '123456789',
        username: 'testuser2'
      };

      await expect(User.create(duplicateUserData)).rejects.toThrow();
    });
  });

  describe('查找用户', () => {
    test('应该能够根据telegram_id查找用户', async () => {
      const userData = {
        telegram_id: '123456789',
        username: 'testuser'
      };

      const createdUser = await User.create(userData);
      const foundUser = await User.findByTelegramId('123456789');

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.telegram_id).toBe(userData.telegram_id);
    });

    test('应该在用户不存在时返回null', async () => {
      const user = await User.findByTelegramId('nonexistent');
      expect(user).toBeNull();
    });

    test('应该能够根据ID查找用户', async () => {
      const userData = {
        telegram_id: '123456789',
        username: 'testuser'
      };

      const createdUser = await User.create(userData);
      const foundUser = await User.findById(createdUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(createdUser.id);
    });
  });

  describe('更新用户', () => {
    test('应该能够更新用户信息', async () => {
      const userData = {
        telegram_id: '123456789',
        username: 'testuser'
      };

      const user = await User.create(userData);
      const updatedUser = await user.update({
        username: 'newusername',
        first_name: 'New Name'
      });

      expect(updatedUser.username).toBe('newusername');
      expect(updatedUser.first_name).toBe('New Name');
      expect(updatedUser.telegram_id).toBe(userData.telegram_id); // 不应该改变
    });
  });

  describe('余额操作', () => {
    test('应该能够增加余额', async () => {
      const userData = {
        telegram_id: '123456789',
        username: 'testuser'
      };

      const user = await User.create(userData);
      const updatedUser = await user.addBalance(100);

      expect(updatedUser.balance).toBe(100);
    });

    test('应该能够扣除余额', async () => {
      const userData = {
        telegram_id: '123456789',
        username: 'testuser'
      };

      const user = await User.create(userData);
      await user.addBalance(100);
      const updatedUser = await user.deductBalance(30);

      expect(updatedUser.balance).toBe(70);
    });

    test('应该在余额不足时抛出错误', async () => {
      const userData = {
        telegram_id: '123456789',
        username: 'testuser'
      };

      const user = await User.create(userData);
      await expect(user.deductBalance(100)).rejects.toThrow('余额不足');
    });
  });

  describe('消费记录', () => {
    test('应该能够增加消费记录', async () => {
      const userData = {
        telegram_id: '123456789',
        username: 'testuser'
      };

      const user = await User.create(userData);
      const updatedUser = await user.addSpent(50);

      expect(updatedUser.total_spent).toBe(50);
      expect(updatedUser.order_count).toBe(1);
    });
  });

  describe('JSON序列化', () => {
    test('应该正确序列化为JSON', async () => {
      const userData = {
        telegram_id: '123456789',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User'
      };

      const user = await User.create(userData);
      const json = user.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('telegram_id');
      expect(json).toHaveProperty('username');
      expect(json).toHaveProperty('balance');
      expect(json).toHaveProperty('total_spent');
      expect(json).toHaveProperty('order_count');
      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('created_at');
      expect(json).toHaveProperty('updated_at');

      expect(typeof json.balance).toBe('number');
      expect(typeof json.total_spent).toBe('number');
    });
  });
});
