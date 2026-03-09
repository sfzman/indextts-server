import { getToken } from './api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export interface VideoModelOption {
  name: string;
  code: string;
  description: string;
}

interface VideoModelListResponse {
  models: VideoModelOption[];
}

export type BackendVideoTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface VideoTaskItemResponse {
  id: string;
  status: BackendVideoTaskStatus;
  model: string;
  prompt: string;
  meta?: Record<string, unknown>;
  negative_prompt?: string;
  template?: string;
  image_file_id?: string;
  image_url?: string;
  end_frame_file_id?: string;
  audio_file_id?: string;
  audio_url?: string;
  resolution?: string;
  duration?: number;
  prompt_extend?: boolean;
  audio?: boolean;
  seed?: number;
  watermark?: boolean;
  result_video_file_id?: string;
  error_message?: string;
  provider_task_id?: string;
  provider_status?: string;
  provider_message?: string;
  created_at: string;
  updated_at: string;
}

interface VideoTaskListResponse {
  tasks: VideoTaskItemResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateVideoTaskRequest {
  model: string;
  prompt: string;
  image_file_id?: string;
  end_frame_file_id?: string;
  audio_file_id?: string;
  resolution?: string;
  duration?: number;
  prompt_extend?: boolean;
  audio?: boolean;
}

export interface CreateVideoTaskResponse {
  id: string;
  status: BackendVideoTaskStatus;
  provider_task_id?: string;
  created_at: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error('未登录');
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data as T;
}

export async function getVideoModels(): Promise<VideoModelOption[]> {
  const response = await request<VideoModelListResponse>('/video/models');
  return Array.isArray(response.models) ? response.models : [];
}

export async function getVideoTasks(params: {
  page?: number;
  page_size?: number;
  status?: BackendVideoTaskStatus;
} = {}): Promise<VideoTaskListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  return request<VideoTaskListResponse>(`/video/tasks${query ? `?${query}` : ''}`);
}

export async function createVideoTask(payload: CreateVideoTaskRequest): Promise<CreateVideoTaskResponse> {
  return request<CreateVideoTaskResponse>('/video/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
