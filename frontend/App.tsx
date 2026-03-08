import React, { useEffect, useRef, useState } from 'react';
import VoiceStudio from './components/VoiceStudio';
import VideoStudio from './components/VideoStudio';
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
  const [activeStudio, setActiveStudio] = useState<'audio' | 'video'>('audio');
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
    setActiveStudio('audio');
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
          <p className="text-sm text-[var(--text-secondary)]">正在初始化工作台...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-[rgba(175,143,139,0.28)] blur-[110px]"></div>
      <div className="absolute top-8 -right-16 w-80 h-80 rounded-full bg-[rgba(124,145,135,0.24)] blur-[120px]"></div>
      <div className="absolute bottom-0 left-1/3 w-[36rem] h-[20rem] rounded-full bg-[rgba(108,122,133,0.15)] blur-[132px]"></div>

      <header className="fixed top-0 left-0 right-0 z-[120]">
        <div className="glass-panel-strong rounded-none border-x-0 border-t-0 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-end gap-2.5 sm:gap-3">
            <div className="pill premium-pill tracking-[0.04em]">
              <i className="fas fa-circle-play text-[var(--accent-ink)]"></i>
              IndexTTS
            </div>

            {user ? (
              <>
                <div className="pill premium-pill">
                  <i className="fas fa-coins text-[var(--accent-gold)]"></i>
                  {user.credits} 积分
                </div>

                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setIsProfileOpen((prev) => !prev)}
                    className="pill premium-pill focus-ring"
                    title="查看个人详情"
                  >
                    <i className="fas fa-user-circle text-[var(--accent-rose)]"></i>
                    <span className="max-w-[108px] truncate">{user.nickname || user.phone}</span>
                    <i className={`fas ${isProfileOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] opacity-70`}></i>
                  </button>

                  {isProfileOpen && (
                    <div className="glass-panel-strong absolute right-0 top-11 w-72 rounded-2xl p-4 space-y-3 z-[130]">
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
              </>
            ) : (
              <div className="pill">
                <i className="fas fa-lock text-[var(--accent-gold)]"></i>
                请先登录
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        {user ? (
          <div className="relative lg:pl-[66px]">
            <aside className="hidden lg:flex app-edge-sidebar">
              <div className="app-edge-sidebar-shell">
                <button
                  onClick={() => setActiveStudio('audio')}
                  className={`edge-nav-btn focus-ring ${activeStudio === 'audio' ? 'active' : ''}`}
                  title="音频工坊"
                >
                  <i className="fas fa-wave-square"></i>
                  <span className="sr-only">音频工坊</span>
                </button>

                <button
                  onClick={() => setActiveStudio('video')}
                  className={`edge-nav-btn focus-ring ${activeStudio === 'video' ? 'active' : ''}`}
                  title="视频工坊"
                >
                  <i className="fas fa-video"></i>
                  <span className="sr-only">视频工坊</span>
                </button>

                <div className="edge-nav-divider"></div>

                <button className="edge-nav-icon" title="文件">
                  <i className="fas fa-folder-open"></i>
                </button>
                <button className="edge-nav-icon" title="收藏">
                  <i className="far fa-star"></i>
                </button>
              </div>
            </aside>

            <div className="lg:hidden mb-4">
              <div className="glass-panel rounded-[18px] p-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveStudio('audio')}
                    className={`studio-nav-item focus-ring ${activeStudio === 'audio' ? 'active' : ''}`}
                    title="音频工坊"
                  >
                    <i className="fas fa-wave-square"></i>
                    <span>音频工坊</span>
                  </button>
                  <button
                    onClick={() => setActiveStudio('video')}
                    className={`studio-nav-item focus-ring ${activeStudio === 'video' ? 'active' : ''}`}
                    title="视频工坊"
                  >
                    <i className="fas fa-video"></i>
                    <span>视频工坊</span>
                  </button>
                </div>
              </div>
            </div>

            <main className="min-w-0">
              {activeStudio === 'audio' ? (
                <VoiceStudio user={user} onUserUpdate={setUser} />
              ) : (
                <VideoStudio />
              )}
            </main>
          </div>
        ) : (
          <div className="min-h-[calc(100vh-11rem)] flex items-center justify-center">
            <Auth onLoginSuccess={handleLoginSuccess} />
          </div>
        )}
      </div>

      <div className="fixed right-5 bottom-4 text-[10px] text-[var(--text-muted)] opacity-70 pointer-events-none">
        Last build: {lastBuildLabel} (UTC+8)
      </div>
    </div>
  );
};

export default App;
