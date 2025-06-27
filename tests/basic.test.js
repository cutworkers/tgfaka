describe('基础测试', () => {
  test('测试环境正常工作', () => {
    expect(1 + 1).toBe(2);
  });

  test('Node.js环境变量', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('异步测试', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });
});
