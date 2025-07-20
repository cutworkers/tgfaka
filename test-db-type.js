#!/usr/bin/env node

/**
 * 测试数据库类型自适应功能
 */

require('dotenv').config();

// 测试不同的DATABASE_TYPE值
const testCases = [
    { env: 'mysql', expected: 'mysql', desc: '设置为mysql' },
    { env: 'sqlite', expected: 'sqlite', desc: '设置为sqlite' },
    { env: 'MYSQL', expected: 'mysql', desc: '大写MYSQL' },
    { env: 'SQLite', expected: 'sqlite', desc: '混合大小写SQLite' },
    { env: '', expected: 'sqlite', desc: '空字符串' }
];

console.log('🧪 测试数据库类型自适应功能');
console.log('================================');

let allPassed = true;

testCases.forEach((testCase, index) => {
    // 备份原始值
    const originalValue = process.env.DATABASE_TYPE;

    // 设置测试值
    process.env.DATABASE_TYPE = testCase.env;

    try {
        // 重新加载模块以获取新的配置
        delete require.cache[require.resolve('./src/database/seed')];
        delete require.cache[require.resolve('./src/config')];

        const DatabaseSeeder = require('./src/database/seed');
        const seeder = new DatabaseSeeder();

        const result = seeder.dbType;
        const passed = result === testCase.expected;

        console.log(`测试 ${index + 1} (${testCase.desc}): '${testCase.env}' -> '${result}' ${passed ? '✅' : '❌'}`);

        if (!passed) {
            console.log(`  期望: '${testCase.expected}', 实际: '${result}'`);
            allPassed = false;
        }

    } catch (error) {
        console.log(`测试 ${index + 1}: 错误 - ${error.message} ❌`);
        allPassed = false;
    }

    // 恢复原始值
    process.env.DATABASE_TYPE = originalValue;
});

console.log('================================');
console.log(allPassed ? '🎉 所有测试通过！' : '⚠️  部分测试失败');

// 显示当前配置
console.log('\n📋 当前配置信息:');
console.log(`DATABASE_TYPE: ${process.env.DATABASE_TYPE || '未设置'}`);

try {
    const DatabaseSeeder = require('./src/database/seed');
    const seeder = new DatabaseSeeder();
    console.log(`检测到的数据库类型: ${seeder.dbType}`);

    // 显示配置详情
    seeder.displayDatabaseConfig();
} catch (error) {
    console.log(`配置检测失败: ${error.message}`);
}

process.exit(allPassed ? 0 : 1);