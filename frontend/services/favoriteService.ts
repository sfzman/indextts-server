import { getToken } from './api';
import { API_BASE_URL } from './apiBase';
import { AudioFavorite, CreateFavoriteResponse, FavoriteItemResponse, FavoriteListResponse } from '../types';

const FAVORITES_UPDATED_EVENT = 'voxclone-favorites-updated';

const mapFavorite = (item: FavoriteItemResponse): AudioFavorite => ({
  id: item.id,
  name: item.name,
  category: item.category,
  audioFileId: item.audio_file_id,
});

const authHeaders = (): HeadersInit => {
  const token = getToken();
  if (!token) {
    throw new Error('未登录');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const emitFavoritesUpdated = (): void => {
  window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
};

export const favoritesUpdatedEventName = FAVORITES_UPDATED_EVENT;

export async function listFavorites(category?: 'voice' | 'emotion'): Promise<AudioFavorite[]> {
  const query = category ? `?category=${category}` : '';
  const response = await fetch(`${API_BASE_URL}/favorites${query}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '获取收藏失败');
  }

  return (data as FavoriteListResponse).favorites.map(mapFavorite);
}

export async function addFavoriteByFileID(
  category: 'voice' | 'emotion',
  name: string,
  audioFileId: string
): Promise<{ added: boolean; favorite: AudioFavorite }> {
  const response = await fetch(`${API_BASE_URL}/favorites`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      category,
      name,
      audio_file_id: audioFileId,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '收藏失败');
  }

  const result = data as CreateFavoriteResponse;
  emitFavoritesUpdated();
  return {
    added: result.added,
    favorite: mapFavorite(result.favorite),
  };
}

export async function updateFavoriteName(id: string, name: string): Promise<AudioFavorite> {
  const response = await fetch(`${API_BASE_URL}/favorites/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '更新收藏名称失败');
  }

  emitFavoritesUpdated();
  return mapFavorite(data as FavoriteItemResponse);
}

export async function deleteFavorite(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/favorites/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '删除收藏失败');
  }

  emitFavoritesUpdated();
}
