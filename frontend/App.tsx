
import React, { useState } from 'react';
import VoiceStudio from './components/VoiceStudio';
import Auth from './components/Auth';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen flex flex-col">
      {/* 头部 */}
      <header className="py-12 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 blur-[120px] rounded-full -z-10"></div>
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
        {isLoggedIn ? (
          <VoiceStudio />
        ) : (
          <Auth onLoginSuccess={() => setIsLoggedIn(true)} />
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