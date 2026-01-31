
import React, { useState, useEffect } from 'react';
import VoiceStudio from './components/VoiceStudio';
import Auth from './components/Auth';
import { User, getCachedUser, getCurrentUser, logout, isAuthenticated } from './services/api';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化时检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        // 尝试从缓存获取用户信息
        const cachedUser = getCachedUser();
        if (cachedUser) {
          setUser(cachedUser);
        }

        // 验证 token 有效性并获取最新用户信息
        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } catch {
          // token 失效，清除登录状态
          logout();
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-red-500 mb-4"></i>
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen flex flex-col">
      {/* 头部 */}
      <header className="py-12 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 blur-[120px] rounded-full -z-10"></div>

        {/* 用户信息和登出按钮 */}
        {user && (
          <div className="absolute top-4 right-4 flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              <i className="fas fa-user-circle mr-2"></i>
              {user.nickname || user.phone}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-xs text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-500/30 rounded-lg transition-all"
            >
              <i className="fas fa-sign-out-alt mr-1"></i>
              退出登录
            </button>
          </div>
        )}

        <div className="inline-block px-4 py-1.5 mb-4 rounded-full bg-red-900/40 border border-red-500/30 text-red-400 text-xs font-bold tracking-widest uppercase">
          基于 Gemini AI 驱动
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-4">
          VoxClone <span className="bg-gradient-to-r from-red-500 to-rose-600 bg-clip-text text-transparent">语音实验室</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light">
          高保真克隆任何音色。只需上传声音样本，调节情感倾向，
          AI 即可让您的文字以理想的声音呈现。
        </p>
      </header>

      {/* 核心显示区 */}
      <main className="flex-grow">
        {user ? (
          <VoiceStudio />
        ) : (
          <Auth onLoginSuccess={handleLoginSuccess} />
        )}
      </main>

      {/* 页脚 */}
      <footer className="py-16 text-center text-gray-500 text-sm">
        <div className="flex justify-center gap-8 mb-8 text-xl">
          <i className="fab fa-twitter hover:text-red-500 cursor-pointer transition-colors"></i>
          <i className="fab fa-github hover:text-red-500 cursor-pointer transition-colors"></i>
          <i className="fab fa-discord hover:text-red-500 cursor-pointer transition-colors"></i>
        </div>
        <p>&copy; 2024 VoxClone 语音实验室。保留所有权利。</p>
        <p className="mt-2 text-gray-600 italic">专为高性能语音合成与情感克隆而设计。</p>
      </footer>
    </div>
  );
};

export default App;
