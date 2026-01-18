
import React, { useState, useEffect } from 'react';

interface AuthProps {
  onLoginSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer: number;
    if (countdown > 0) {
      timer = window.setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      alert('请输入正确的11位手机号码');
      return;
    }
    setCountdown(60);
    console.log('验证码已发送至:', phone);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !code) {
      alert('请填写完整信息');
      return;
    }
    if (code.length !== 6) {
      alert('请输入6位验证码');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess();
    }, 1000);
  };

  return (
    <div className="max-w-md mx-auto mt-10 animate-in fade-in zoom-in duration-500">
      <div className="glass-morphism rounded-3xl p-10 shadow-2xl border border-red-500/10 relative overflow-hidden bg-black/40">
        {/* 背景装饰 */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 blur-[60px] rounded-full"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-rose-600/10 blur-[60px] rounded-full"></div>

        <div className="relative z-10">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-tr from-red-600 to-rose-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-900/40 border border-red-400/20">
              <i className="fas fa-user-shield text-white text-2xl"></i>
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-2">
              {isLogin ? '欢迎回来' : '开启克隆之旅'}
            </h2>
            <p className="text-gray-400 text-sm font-light">使用手机号码快速{isLogin ? '登录' : '注册'}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-widest">手机号码</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600">
                  <i className="fas fa-mobile-alt"></i>
                </span>
                <input
                  type="tel"
                  placeholder="请输入手机号"
                  className="w-full bg-black/40 border border-gray-800 rounded-xl py-3.5 pl-11 pr-4 text-white focus:ring-1 focus:ring-red-500 focus:border-transparent outline-none transition-all placeholder:text-gray-700"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={11}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 ml-1 uppercase tracking-widest">验证码</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600">
                    <i className="fas fa-shield-alt"></i>
                  </span>
                  <input
                    type="text"
                    placeholder="6位验证码"
                    className="w-full bg-black/40 border border-gray-800 rounded-xl py-3.5 pl-11 pr-4 text-white focus:ring-1 focus:ring-red-500 focus:border-transparent outline-none transition-all placeholder:text-gray-700"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                  />
                </div>
                <button
                  type="button"
                  disabled={countdown > 0}
                  onClick={handleSendCode}
                  className={`px-4 rounded-xl font-medium text-xs transition-all whitespace-nowrap min-w-[110px]
                    ${countdown > 0 
                      ? 'bg-gray-900 text-gray-600 cursor-not-allowed border border-gray-800' 
                      : 'bg-white/5 text-red-400 border border-red-500/20 hover:bg-red-500/10'}`}
                >
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-xl font-bold text-lg shadow-xl shadow-red-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {loading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                isLogin ? '立即登录' : '立即注册'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-gray-500 hover:text-red-400 text-xs transition-colors tracking-wide"
            >
              {isLogin ? '还没有账号？立即注册' : '已有账号？返回登录'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-gray-600 text-[10px] px-10 leading-relaxed uppercase tracking-tighter">
        点击{isLogin ? '登录' : '注册'}即代表您同意我们的
        <a href="#" className="text-red-500/50 hover:underline mx-1">服务协议</a>和
        <a href="#" className="text-red-500/50 hover:underline mx-1">隐私政策</a>
      </div>
    </div>
  );
};

export default Auth;