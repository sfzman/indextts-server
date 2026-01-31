// API 服务配置和认证相关接口

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// Token 存储 key
const TOKEN_KEY = 'voxclone_token';
const USER_KEY = 'voxclone_user';

// User 类型定义
export interface User {
  id: string;
  phone: string;
  nickname?: string;
  avatar?: string;
  status: 'active' | 'disabled';
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

// 登录响应
export interface LoginResponse {
  token: string;
  user: User;
}

// 通用 API 响应错误
export interface ApiError {
  error: string;
}

// Token 管理
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// User 缓存管理
export const getCachedUser = (): User | null => {
  const userStr = localStorage.getItem(USER_KEY);
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

export const setCachedUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const removeCachedUser = (): void => {
  localStorage.removeItem(USER_KEY);
};

// 清除所有认证数据
export const clearAuth = (): void => {
  removeToken();
  removeCachedUser();
};

// 通用请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || '请求失败');
  }

  return data as T;
}

// 发送验证码
export async function sendVerificationCode(phone: string): Promise<void> {
  await request<{ message: string }>('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

// 登录
export async function login(phone: string, code: string): Promise<LoginResponse> {
  const response = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });

  // 保存 token 和 user
  setToken(response.token);
  setCachedUser(response.user);

  return response;
}

// 获取当前用户
export async function getCurrentUser(): Promise<User> {
  return request<User>('/auth/me');
}

// 登出
export function logout(): void {
  clearAuth();
}

// 检查是否已登录
export function isAuthenticated(): boolean {
  return !!getToken();
}
