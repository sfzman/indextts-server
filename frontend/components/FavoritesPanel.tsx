import React, { useEffect, useMemo, useState } from 'react';
import { AudioFavorite } from '../types';
import { favoritesUpdatedEventName, getFavoritesByCategory, updateFavoriteName } from '../data/mockFavorites';

interface FavoritesPanelProps {
  onUseVoice: (favorite: AudioFavorite) => void;
  onUseEmotion: (favorite: AudioFavorite) => void;
}

const FavoritesPanel: React.FC<FavoritesPanelProps> = ({ onUseVoice, onUseEmotion }) => {
  const [activeTab, setActiveTab] = useState<'voice' | 'emotion'>('voice');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const favorites = useMemo(() => getFavoritesByCategory(activeTab), [activeTab, refreshKey]);
  const voiceCount = useMemo(() => getFavoritesByCategory('voice').length, [refreshKey]);
  const emotionCount = useMemo(() => getFavoritesByCategory('emotion').length, [refreshKey]);

  useEffect(() => {
    if (audioRef) {
      audioRef.pause();
      setPlayingId(null);
      setAudioRef(null);
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      audioRef?.pause();
    };
  }, [audioRef]);

  useEffect(() => {
    const handleFavoritesUpdated = () => {
      setRefreshKey((prev) => prev + 1);
    };
    window.addEventListener(favoritesUpdatedEventName, handleFavoritesUpdated);
    return () => {
      window.removeEventListener(favoritesUpdatedEventName, handleFavoritesUpdated);
    };
  }, []);

  const handlePlay = async (favorite: AudioFavorite, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingId === favorite.id) {
      audioRef?.pause();
      setPlayingId(null);
      setAudioRef(null);
      return;
    }

    if (audioRef) {
      audioRef.pause();
    }

    const newAudio = new Audio(favorite.audioUrl);

    try {
      await newAudio.play();
      setPlayingId(favorite.id);
      setAudioRef(newAudio);
    } catch {
      setPlayingId(null);
      setAudioRef(null);
    }

    newAudio.onended = () => {
      setPlayingId(null);
      setAudioRef(null);
    };
  };

  const handleUse = (favorite: AudioFavorite, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTab === 'voice') {
      onUseVoice(favorite);
    } else {
      onUseEmotion(favorite);
    }
  };

  const handleStartEdit = (favorite: AudioFavorite, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(favorite.id);
    setEditingName(favorite.name);
  };

  const saveEdit = (id: string) => {
    if (editingName.trim()) {
      updateFavoriteName(id, editingName.trim());
      setRefreshKey((prev) => prev + 1);
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleEditKeyDown = (id: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit(id);
    } else if (e.key === 'Escape') {
      handleCancelEdit(e);
    }
  };

  return (
    <div className="glass-panel rounded-[28px] p-5 xl:p-6 h-[680px] flex flex-col">
      <div className="pb-4 mb-4 border-b soft-divider">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl text-[var(--text-primary)]">收藏音频</h2>
          <span className="pill">{favorites.length} 条</span>
        </div>
        <p className="text-[12px] text-[var(--text-secondary)] mt-2">从收藏库快速填充当前任务的音色或情感参考。</p>
      </div>

      <div className="segment-control mb-4">
        <button
          onClick={() => setActiveTab('voice')}
          className={`segment-btn focus-ring ${activeTab === 'voice' ? 'active' : ''}`}
        >
          <i className="fas fa-microphone mr-1.5"></i>
          音色 {voiceCount}
        </button>

        <button
          onClick={() => setActiveTab('emotion')}
          className={`segment-btn focus-ring ${activeTab === 'emotion' ? 'active' : ''}`}
        >
          <i className="fas fa-masks-theater mr-1.5"></i>
          情感 {emotionCount}
        </button>
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-3">
        {favorites.map((favorite) => (
          <div key={favorite.id} className="glass-panel-strong rounded-2xl p-3 border border-[rgba(124,112,104,0.2)] group">
            <div className="flex items-center gap-2.5">
              <button
                onClick={(e) => {
                  void handlePlay(favorite, e);
                }}
                className="secondary-button focus-ring h-9 w-9 shrink-0"
                title={playingId === favorite.id ? '暂停' : '试听'}
              >
                <i className={`fas ${playingId === favorite.id ? 'fa-pause' : 'fa-play'} text-xs`}></i>
              </button>

              <div className="min-w-0 flex-grow">
                {editingId === favorite.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(favorite.id, e)}
                    onBlur={() => saveEdit(favorite.id)}
                    autoFocus
                    className="app-input h-9"
                  />
                ) : (
                  <>
                    <h3
                      onDoubleClick={(e) => handleStartEdit(favorite, e)}
                      className="text-sm font-semibold text-[var(--text-primary)] truncate cursor-pointer"
                      title="双击重命名"
                    >
                      {favorite.name}
                    </h3>
                  </>
                )}
              </div>

              <button
                onClick={(e) => handleStartEdit(favorite, e)}
                className="ghost-button focus-ring h-8 w-8 text-[11px] shrink-0 opacity-70 group-hover:opacity-100"
                title="重命名"
              >
                <i className="fas fa-pen"></i>
              </button>
            </div>

            <button
              onClick={(e) => handleUse(favorite, e)}
              className="action-button focus-ring mt-2 h-10 text-sm"
            >
              <i className="fas fa-arrow-up-right-from-square mr-1.5"></i>
              一键使用
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[var(--text-muted)] mt-4 pt-4 border-t soft-divider text-center">
        双击收藏名可重命名，点击试听确认后再一键使用。
      </p>
    </div>
  );
};

export default FavoritesPanel;
