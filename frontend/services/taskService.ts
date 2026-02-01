// 任务管理 API 服务

import { getToken } from './api';
import {
  CreateTaskRequest,
  CreateTaskResponse,
  TaskResponse,
  TaskListResponse,
  BackendTaskStatus,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// 通用请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error('未登录');
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
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

// 创建任务
export async function createTask(req: CreateTaskRequest): Promise<CreateTaskResponse> {
  return request<CreateTaskResponse>('/tasks', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// 获取任务详情
export async function getTask(taskId: string): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${taskId}`);
}

// 获取任务列表
export async function getTasks(params: {
  page?: number;
  page_size?: number;
  status?: BackendTaskStatus;
} = {}): Promise<TaskListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  return request<TaskListResponse>(`/tasks${query ? `?${query}` : ''}`);
}

// 轮询任务状态直到完成
export async function pollTaskUntilDone(
  taskId: string,
  options: {
    interval?: number;      // 轮询间隔（毫秒）
    timeout?: number;       // 超时时间（毫秒）
    onStatusChange?: (status: BackendTaskStatus) => void;
  } = {}
): Promise<TaskResponse> {
  const {
    interval = 2000,
    timeout = 300000, // 5分钟超时
    onStatusChange,
  } = options;

  const startTime = Date.now();

  while (true) {
    const task = await getTask(taskId);

    if (onStatusChange) {
      onStatusChange(task.status);
    }

    if (task.status === 'completed' || task.status === 'failed') {
      return task;
    }

    if (Date.now() - startTime > timeout) {
      throw new Error('任务处理超时');
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }
}
