import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioFavorite } from '../types';
import { deleteFavorite, favoritesUpdatedEventName, listFavorites, updateFavoriteName } from '../services/favoriteService';
import { getAudioBlob } from '../services/fileService';

interface FavoritesPanelProps {
  onUseVoice: (favorite: AudioFavorite) => void;
  onUseEmotion: (favorite: AudioFavorite) => void;
}

const FavoritesPanel: React.FC<FavoritesPanelProps> = ({ onUseVoice, onUseEmotion }) => {
  const [activeTab, setActiveTab] = useState<'voice' | 'emotion'>('voice');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const audioRefRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [favorites, setFavorites] = useState<AudioFavorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    audioRefRef.current = audioRef;
  }, [audioRef]);

  useEffect(() => {
    audioObjectUrlRef.current = audioObjectUrl;
  }, [audioObjectUrl]);

  const stopPlayback = useCallback(() => {
    const currentAudio = audioRefRef.current;
    const currentUrl = audioObjectUrlRef.current;

    if (currentAudio) {
      currentAudio.pause();
    }
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }

    audioRefRef.current = null;
    audioObjectUrlRef.current = null;
    setPlayingId(null);
    setAudioRef(null);
    setAudioObjectUrl(null);
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const items = await listFavorites();
      setFavorites(items);
    } catch (error) {
      console.error('加载收藏失败:', error);
      setFavorites([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites, refreshKey]);

  useEffect(() => {
    stopPlayback();
  }, [activeTab, stopPlayback]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  useEffect(() => {
    const handleFavoritesUpdated = () => {
      setRefreshKey((prev) => prev + 1);
    };
    window.addEventListener(favoritesUpdatedEventName, handleFavoritesUpdated);
    return () => {
      window.removeEventListener(favoritesUpdatedEventName, handleFavoritesUpdated);
    };
  }, []);

  const filteredFavorites = useMemo(
    () => favorites.filter((item) => item.category === activeTab),
    [favorites, activeTab]
  );
  const voiceCount = useMemo(() => favorites.filter((item) => item.category === 'voice').length, [favorites]);
  const emotionCount = useMemo(() => favorites.filter((item) => item.category === 'emotion').length, [favorites]);

  const handlePlay = async (favorite: AudioFavorite, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingId === favorite.id) {
      stopPlayback();
      return;
    }

    stopPlayback();

    try {
      const blob = await getAudioBlob(favorite.audioFileId);
      const objectUrl = URL.createObjectURL(blob);
      const newAudio = new Audio(objectUrl);
      await newAudio.play();

      setPlayingId(favorite.id);
      setAudioRef(newAudio);
      setAudioObjectUrl(objectUrl);

      newAudio.onended = () => {
        setPlayingId(null);
        setAudioRef(null);
        URL.revokeObjectURL(objectUrl);
        setAudioObjectUrl((prev) => (prev === objectUrl ? null : prev));
      };
    } catch {
      stopPlayback();
    }
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

  const handleDelete = async (favorite: AudioFavorite, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定删除收藏「${favorite.name}」吗？`)) {
      return;
    }

    try {
      await deleteFavorite(favorite.id);
      if (playingId === favorite.id) {
        stopPlayback();
      }
      setFavorites((prev) => prev.filter((item) => item.id !== favorite.id));
    } catch (error) {
      console.error('删除收藏失败:', error);
    }
  };

  const saveEdit = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    try {
      const updated = await updateFavoriteName(id, trimmed);
      setFavorites((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (error) {
      console.error('更新收藏名称失败:', error);
    } finally {
      setEditingId(null);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleEditKeyDown = (id: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void saveEdit(id);
    } else if (e.key === 'Escape') {
      handleCancelEdit(e);
    }
  };

  return (
    <div className="glass-panel rounded-[28px] p-5 xl:p-6 h-[680px] flex flex-col">
      <div className="pb-4 mb-4 border-b soft-divider">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl text-[var(--text-primary)]">收藏音频</h2>
          <span className="pill">{filteredFavorites.length} 条</span>
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
        {isLoading && (
          <div className="text-[12px] text-[var(--text-muted)] text-center py-6">加载中...</div>
        )}

        {!isLoading && filteredFavorites.length === 0 && (
          <div className="text-[12px] text-[var(--text-muted)] text-center py-6">暂无收藏</div>
        )}

        {filteredFavorites.map((favorite) => (
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
                    onBlur={() => {
                      void saveEdit(favorite.id);
                    }}
                    autoFocus
                    className="app-input h-9"
                  />
                ) : (
                  <h3
                    onDoubleClick={(e) => handleStartEdit(favorite, e)}
                    className="text-sm font-semibold text-[var(--text-primary)] truncate cursor-pointer"
                    title="双击重命名"
                  >
                    {favorite.name}
                  </h3>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => handleStartEdit(favorite, e)}
                  className="ghost-button focus-ring h-8 w-8 text-[11px] opacity-70 group-hover:opacity-100"
                  title="重命名"
                >
                  <i className="fas fa-pen"></i>
                </button>
                <button
                  onClick={(e) => {
                    void handleDelete(favorite, e);
                  }}
                  className="ghost-button focus-ring h-8 w-8 text-[11px] opacity-70 group-hover:opacity-100 text-[var(--error)]"
                  title="删除收藏"
                >
                  <i className="fas fa-trash-can"></i>
                </button>
              </div>
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
