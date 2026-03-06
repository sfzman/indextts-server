import React, { useEffect, useRef, useState } from 'react';
import VoiceStudio from './components/VoiceStudio';
import Auth from './components/Auth';
import { User, getCachedUser, getCurrentUser, logout, isAuthenticated } from './services/api';

declare const __BUILD_TIME__: string;

const buildDate = new Date(__BUILD_TIME__);
const lastBuildLabel = Number.isNaN(buildDate.getTime())
  ? __BUILD_TIME__
  : new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(buildDate);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        const cachedUser = getCachedUser();
        if (cachedUser) {
          setUser(cachedUser);
        }

        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } catch {
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
    setIsProfileOpen(false);
    setUser(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-panel rounded-3xl px-8 py-7 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center panel-subtle">
            <i className="fas fa-spinner fa-spin text-xl text-[var(--accent-sage)]"></i>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">正在初始化语音工作台...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-[rgba(175,143,139,0.28)] blur-[110px]"></div>
      <div className="absolute top-8 -right-16 w-80 h-80 rounded-full bg-[rgba(124,145,135,0.24)] blur-[120px]"></div>

      <div className="relative mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8 pb-14">
        <header className="relative z-50 pt-8 md:pt-12 pb-8 md:pb-10">
          <div className="glass-panel rounded-[30px] p-6 md:p-8 brand-header">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-4">
                <div className="pill w-fit tracking-[0.08em]">
                  <i className="fas fa-wave-square text-[11px] text-[var(--accent-ink)]"></i>
                  IndexTTS Studio
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl leading-tight text-[var(--text-primary)]">
                  语音克隆工作站
                </h1>

                <p className="text-[15px] md:text-base text-[var(--text-secondary)] leading-relaxed">
                  保留你的工作流，重塑视觉体验。上传音色参考、控制情感表达、批量管理历史任务，
                  在统一的玻璃拟态界面里完成高保真语音合成。
                </p>
              </div>

              {user ? (
                <div className="self-start lg:self-end relative" ref={profileRef}>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setIsProfileOpen((prev) => !prev)}
                      className="pill premium-pill focus-ring"
                      title="查看个人详情"
                    >
                      <i className="fas fa-user-circle text-[var(--accent-rose)]"></i>
                      {user.nickname || user.phone}
                      <i className={`fas ${isProfileOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] opacity-70`}></i>
                    </button>
                    <div className="pill premium-pill">
                      <i className="fas fa-coins text-[var(--accent-gold)]"></i>
                      {user.credits} 积分
                    </div>
                  </div>

                  {isProfileOpen && (
                    <div className="glass-panel-strong absolute right-0 top-12 w-72 rounded-2xl p-4 space-y-3 z-[120]">
                      <div className="pb-2 border-b soft-divider">
                        <p className="muted-label mb-1">账户 ID</p>
                        <p className="text-sm text-[var(--text-primary)] font-semibold">
                          {user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="panel-subtle rounded-xl px-3 py-2">
                          <p className="muted-label mb-1">昵称</p>
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user.nickname || '未设置'}</p>
                        </div>
                        <div className="panel-subtle rounded-xl px-3 py-2">
                          <p className="muted-label mb-1">余额</p>
                          <p className="text-xs font-semibold text-[var(--text-primary)]">{user.credits} 积分</p>
                        </div>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="secondary-button focus-ring h-10 w-full text-sm font-semibold"
                      >
                        <i className="fas fa-sign-out-alt mr-1.5"></i>
                        退出登录
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pill self-start lg:self-end">
                  <i className="fas fa-lock text-[var(--accent-gold)]"></i>
                  登录后可开始克隆
                </div>
              )}
            </div>
          </div>
        </header>

        <main>
          {user ? (
            <VoiceStudio user={user} onUserUpdate={setUser} />
          ) : (
            <Auth onLoginSuccess={handleLoginSuccess} />
          )}
        </main>

        <footer className="pt-12 pb-6 text-center text-xs text-[var(--text-muted)]">
          <div className="flex justify-center gap-3 mb-4">
            <span className="pill"><i className="fas fa-shield-heart text-[var(--accent-sage)]"></i> 安全鉴权</span>
            <span className="pill"><i className="fas fa-bolt text-[var(--accent-rose)]"></i> 实时轮询</span>
            <span className="pill"><i className="fas fa-sliders text-[var(--accent-ink)]"></i> 情感可控</span>
          </div>
          <p>© 2026 VoxClone / IndexTTS. 保留所有权利。</p>
          <p className="mt-1">Last build: {lastBuildLabel} (UTC+8)</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
