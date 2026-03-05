import { AudioFavorite } from '../types';

const STORAGE_KEY = 'voxclone_favorites';
const USER_FAVORITES_KEY = 'voxclone_user_favorites';
const FAVORITES_UPDATED_EVENT = 'voxclone-favorites-updated';

const emitFavoritesUpdated = (): void => {
  window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
};

// 原始 Mock 音色收藏数据
const originalVoiceFavorites: AudioFavorite[] = [
  {
    id: 'voice_1',
    name: '知性女声',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_voice_vir_link_16k.wav',
    category: 'voice',
  },
  {
    id: 'voice_2',
    name: '阳光男声',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_voice_qingchun_boy_16k.wav',
    category: 'voice',
  },
  {
    id: 'voice_3',
    name: '甜美萝莉',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_voice_loli_16k.wav',
    category: 'voice',
  },
  {
    id: 'voice_4',
    name: '磁性大叔',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_voice_mature_man_16k.wav',
    category: 'voice',
  },
  {
    id: 'voice_5',
    name: '清冷御姐',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_voice_cold_female_16k.wav',
    category: 'voice',
  },
];

// 原始 Mock 情感收藏数据
const originalEmotionFavorites: AudioFavorite[] = [
  {
    id: 'emotion_1',
    name: '喜悦兴奋',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_emotion_happy_16k.wav',
    category: 'emotion',
  },
  {
    id: 'emotion_2',
    name: '悲伤低落',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_emotion_sad_16k.wav',
    category: 'emotion',
  },
  {
    id: 'emotion_3',
    name: '愤怒激动',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_emotion_angry_16k.wav',
    category: 'emotion',
  },
  {
    id: 'emotion_4',
    name: '平静温柔',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_emotion_calm_16k.wav',
    category: 'emotion',
  },
  {
    id: 'emotion_5',
    name: '惊讶好奇',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_emotion_surprised_16k.wav',
    category: 'emotion',
  },
  {
    id: 'emotion_6',
    name: '恐惧不安',
    audioUrl: 'https://lf-speech.bj.bcebos.com/obj/fanqing-aispeech/tts_cn_emotion_fear_16k.wav',
    category: 'emotion',
  },
];

// 从 localStorage 加载用户自定义的名称
const loadCustomNames = (): Record<string, string> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load favorites from localStorage:', e);
  }
  return {};
};

const loadUserFavorites = (): AudioFavorite[] => {
  try {
    const stored = localStorage.getItem(USER_FAVORITES_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) =>
      item &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.audioUrl === 'string' &&
      (item.category === 'voice' || item.category === 'emotion')
    ) as AudioFavorite[];
  } catch (e) {
    console.error('Failed to load user favorites:', e);
    return [];
  }
};

const saveUserFavorites = (favorites: AudioFavorite[]): void => {
  try {
    localStorage.setItem(USER_FAVORITES_KEY, JSON.stringify(favorites));
    emitFavoritesUpdated();
  } catch (e) {
    console.error('Failed to save user favorites:', e);
  }
};

// 保存自定义名称到 localStorage
const saveCustomName = (id: string, name: string): void => {
  try {
    const customNames = loadCustomNames();
    customNames[id] = name;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customNames));
    emitFavoritesUpdated();
  } catch (e) {
    console.error('Failed to save favorite name to localStorage:', e);
  }
};

// 获取带自定义名称的收藏列表
const getFavoritesWithCustomNames = (favorites: AudioFavorite[]): AudioFavorite[] => {
  const customNames = loadCustomNames();
  return favorites.map(fav => ({
    ...fav,
    name: customNames[fav.id] || fav.name,
  }));
};

// 获取所有收藏
export const getAllFavorites = (): AudioFavorite[] => {
  const userFavorites = loadUserFavorites();
  return getFavoritesWithCustomNames([...userFavorites, ...originalVoiceFavorites, ...originalEmotionFavorites]);
};

// 根据分类获取收藏
export const getFavoritesByCategory = (category: 'voice' | 'emotion'): AudioFavorite[] => {
  const userFavorites = loadUserFavorites().filter((item) => item.category === category);
  if (category === 'voice') {
    return getFavoritesWithCustomNames([...userFavorites, ...originalVoiceFavorites]);
  }
  return getFavoritesWithCustomNames([...userFavorites, ...originalEmotionFavorites]);
};

export const addFavorite = (
  category: 'voice' | 'emotion',
  name: string,
  audioUrl: string
): { added: boolean; favorite: AudioFavorite } => {
  const allFavorites = getAllFavorites();
  const existing = allFavorites.find(
    (item) => item.category === category && item.audioUrl === audioUrl
  );

  if (existing) {
    return { added: false, favorite: existing };
  }

  const newFavorite: AudioFavorite = {
    id: `${category}_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    audioUrl,
    category,
  };

  const userFavorites = loadUserFavorites();
  userFavorites.unshift(newFavorite);
  saveUserFavorites(userFavorites);

  return { added: true, favorite: newFavorite };
};

// 更新收藏名称
export const updateFavoriteName = (id: string, newName: string): void => {
  saveCustomName(id, newName);
};

// 重置收藏名称到原始值
export const resetFavoriteName = (id: string): void => {
  try {
    const customNames = loadCustomNames();
    delete customNames[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customNames));
    emitFavoritesUpdated();
  } catch (e) {
    console.error('Failed to reset favorite name:', e);
  }
};

export const favoritesUpdatedEventName = FAVORITES_UPDATED_EVENT;
