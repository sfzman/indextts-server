import React, { useState, useEffect } from 'react';
import { sendVerificationCode, login, User } from '../services/api';

interface AuthProps {
  onLoginSuccess: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: number;
    if (countdown > 0) {
      timer = window.setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的11位手机号码');
      return;
    }

    setError(null);
    setSendingCode(true);

    try {
      await sendVerificationCode(phone);
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || !code) {
      setError('请填写完整信息');
      return;
    }

    if (code.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await login(phone, code);
      onLoginSuccess(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[420px] pt-1 pb-5">
      <div className="glass-panel rounded-[26px] px-6 py-6 sm:px-7 sm:py-7 relative overflow-hidden">
        <div className="absolute -top-20 -right-16 w-32 h-32 rounded-full bg-[rgba(175,143,139,0.22)] blur-3xl"></div>
        <div className="absolute -bottom-20 -left-16 w-36 h-36 rounded-full bg-[rgba(124,145,135,0.2)] blur-3xl"></div>

        <div className="relative z-10">
          <div className="text-center mb-6">
            <div className="mx-auto mb-3.5 w-12 h-12 rounded-xl panel-subtle flex items-center justify-center">
              <i className="fas fa-user-shield text-lg text-[var(--accent-ink)]"></i>
            </div>
            <h2 className="text-[30px] leading-tight text-[var(--text-primary)]">{isLogin ? '欢迎回来' : '创建账号'}</h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1.5">使用手机验证码快速{isLogin ? '登录' : '注册'}</p>
          </div>

          {error && (
            <div className="info-block mb-5 text-[var(--error)] border-[rgba(185,119,112,0.35)] bg-[rgba(185,119,112,0.14)]">
              <i className="fas fa-circle-exclamation mr-2"></i>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="muted-label">手机号码</label>
              <div className="relative">
                <i className="fas fa-mobile-screen-button absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"></i>
                <input
                  type="tel"
                  placeholder="请输入手机号"
                  className="app-input input-with-icon"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={11}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="muted-label">验证码</label>
              <div className="grid grid-cols-[1fr_auto] gap-2.5">
                <div className="relative">
                  <i className="fas fa-shield-halved absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"></i>
                  <input
                    type="text"
                    placeholder="6位验证码"
                    className="app-input input-with-icon"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                  />
                </div>

                <button
                  type="button"
                  disabled={countdown > 0 || sendingCode}
                  onClick={handleSendCode}
                  className="secondary-button focus-ring min-w-[106px] px-3 text-xs font-semibold"
                >
                  {sendingCode ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : countdown > 0 ? (
                    `${countdown}s`
                  ) : (
                    '获取验证码'
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="action-button focus-ring flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  提交中...
                </>
              ) : isLogin ? (
                '立即登录'
              ) : (
                '立即注册'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="ghost-button focus-ring h-9 px-4 text-xs font-semibold"
            >
              {isLogin ? '还没有账号？切换注册' : '已有账号？切换登录'}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-[var(--text-muted)] leading-relaxed px-4">
        点击{isLogin ? '登录' : '注册'}即表示你同意
        <a href="#" className="mx-1 text-[var(--accent-ink)] hover:underline">服务协议</a>
        与
        <a href="#" className="mx-1 text-[var(--accent-ink)] hover:underline">隐私政策</a>
      </p>
    </div>
  );
};

export default Auth;
