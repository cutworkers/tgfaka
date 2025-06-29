const logger = require('./logger');

/**
 * Session诊断工具
 * 用于调试生产环境中的session问题
 */
class SessionDiagnostic {
  /**
   * 诊断session配置和状态
   */
  static diagnoseSession(req, res, next) {
    const diagnostic = {
      timestamp: new Date().toISOString(),
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      
      // Session相关信息
      session: {
        exists: !!req.session,
        id: req.session?.id,
        keys: req.session ? Object.keys(req.session) : [],
        hasAdmin: !!req.session?.admin,
        adminId: req.session?.admin?.id,
        cookie: req.session?.cookie ? {
          secure: req.session.cookie.secure,
          httpOnly: req.session.cookie.httpOnly,
          maxAge: req.session.cookie.maxAge,
          sameSite: req.session.cookie.sameSite,
          expires: req.session.cookie.expires
        } : null
      },
      
      // Cookie相关信息
      cookies: {
        raw: req.headers.cookie,
        parsed: req.cookies,
        sessionCookiePresent: req.headers.cookie?.includes('telegram-shop-session') || req.headers.cookie?.includes('connect.sid')
      },
      
      // 请求头信息
      headers: {
        host: req.get('Host'),
        origin: req.get('Origin'),
        referer: req.get('Referer'),
        protocol: req.protocol,
        secure: req.secure,
        forwarded: req.get('X-Forwarded-Proto'),
        realIp: req.get('X-Real-IP') || req.get('X-Forwarded-For')
      },
      
      // 环境信息
      environment: {
        nodeEnv: process.env.NODE_ENV,
        forceHttps: process.env.FORCE_HTTPS,
        sessionSecret: process.env.SESSION_SECRET ? '[SET]' : '[NOT SET]'
      }
    };

    // 记录诊断信息
    if (req.url.includes('/admin')) {
      logger.debug('Session诊断', diagnostic);
    }

    // 检查常见问题
    const issues = this.checkCommonIssues(diagnostic);
    if (issues.length > 0) {
      logger.warn('Session问题检测', { issues, diagnostic });
    }

    next();
  }

  /**
   * 检查常见的session问题
   */
  static checkCommonIssues(diagnostic) {
    const issues = [];

    // 检查session是否存在
    if (!diagnostic.session.exists) {
      issues.push({
        type: 'no_session',
        message: 'Session对象不存在',
        severity: 'high'
      });
    }

    // 检查cookie配置
    if (diagnostic.session.cookie) {
      // 检查secure设置
      if (diagnostic.session.cookie.secure && diagnostic.headers.protocol === 'http') {
        issues.push({
          type: 'secure_cookie_http',
          message: 'Cookie设置为secure但使用HTTP协议',
          severity: 'high',
          solution: '将cookie.secure设为false或使用HTTPS'
        });
      }

      // 检查SameSite设置
      if (diagnostic.session.cookie.sameSite === 'none' && !diagnostic.session.cookie.secure) {
        issues.push({
          type: 'samesite_none_insecure',
          message: 'SameSite=None需要Secure=true',
          severity: 'medium'
        });
      }
    }

    // 检查cookie是否存在
    if (!diagnostic.cookies.sessionCookiePresent && diagnostic.session.exists) {
      issues.push({
        type: 'missing_session_cookie',
        message: 'Session存在但客户端没有session cookie',
        severity: 'high'
      });
    }

    // 检查代理配置
    if (diagnostic.headers.forwarded && diagnostic.headers.protocol !== diagnostic.headers.forwarded) {
      issues.push({
        type: 'proxy_protocol_mismatch',
        message: '代理协议不匹配',
        severity: 'medium',
        details: `请求协议: ${diagnostic.headers.protocol}, 代理协议: ${diagnostic.headers.forwarded}`
      });
    }

    return issues;
  }

  /**
   * 生成session健康报告
   */
  static generateHealthReport(req) {
    const report = {
      timestamp: new Date().toISOString(),
      status: 'unknown',
      score: 0,
      maxScore: 100,
      checks: []
    };

    // 检查1: Session存在性 (25分)
    if (req.session) {
      report.checks.push({
        name: 'Session存在性',
        status: 'pass',
        score: 25,
        message: 'Session对象存在'
      });
      report.score += 25;
    } else {
      report.checks.push({
        name: 'Session存在性',
        status: 'fail',
        score: 0,
        message: 'Session对象不存在'
      });
    }

    // 检查2: Cookie配置 (25分)
    if (req.session?.cookie) {
      const cookie = req.session.cookie;
      let cookieScore = 25;
      let cookieIssues = [];

      if (cookie.secure && req.protocol === 'http') {
        cookieScore -= 15;
        cookieIssues.push('Secure cookie on HTTP');
      }

      if (!cookie.httpOnly) {
        cookieScore -= 5;
        cookieIssues.push('HttpOnly not set');
      }

      if (!cookie.sameSite) {
        cookieScore -= 5;
        cookieIssues.push('SameSite not set');
      }

      report.checks.push({
        name: 'Cookie配置',
        status: cookieScore === 25 ? 'pass' : 'partial',
        score: cookieScore,
        message: cookieIssues.length > 0 ? `问题: ${cookieIssues.join(', ')}` : 'Cookie配置正确'
      });
      report.score += cookieScore;
    } else {
      report.checks.push({
        name: 'Cookie配置',
        status: 'fail',
        score: 0,
        message: 'Cookie配置不存在'
      });
    }

    // 检查3: 管理员Session (25分)
    if (req.session?.admin) {
      report.checks.push({
        name: '管理员Session',
        status: 'pass',
        score: 25,
        message: `管理员已登录: ${req.session.admin.username}`
      });
      report.score += 25;
    } else {
      report.checks.push({
        name: '管理员Session',
        status: 'fail',
        score: 0,
        message: '管理员未登录'
      });
    }

    // 检查4: Cookie传输 (25分)
    const hasCookie = req.headers.cookie?.includes('telegram-shop-session') || 
                     req.headers.cookie?.includes('connect.sid');
    if (hasCookie) {
      report.checks.push({
        name: 'Cookie传输',
        status: 'pass',
        score: 25,
        message: 'Session cookie正常传输'
      });
      report.score += 25;
    } else {
      report.checks.push({
        name: 'Cookie传输',
        status: 'fail',
        score: 0,
        message: '客户端未发送session cookie'
      });
    }

    // 确定整体状态
    if (report.score >= 90) {
      report.status = 'healthy';
    } else if (report.score >= 70) {
      report.status = 'warning';
    } else {
      report.status = 'critical';
    }

    return report;
  }

  /**
   * 中间件：为管理员页面添加session诊断
   */
  static adminSessionDiagnostic(req, res, next) {
    if (req.url.startsWith('/admin')) {
      const report = this.generateHealthReport(req);
      
      if (report.status === 'critical') {
        logger.error('管理员Session健康检查失败', { report, url: req.url });
      } else if (report.status === 'warning') {
        logger.warn('管理员Session健康检查警告', { report, url: req.url });
      } else {
        logger.debug('管理员Session健康检查通过', { report, url: req.url });
      }

      // 将报告附加到请求对象
      req.sessionHealth = report;
    }

    next();
  }
}

module.exports = SessionDiagnostic;
