// 文件上传服务

import { getToken } from './api';
import { UploadResponse, FileUrlResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// 上传音频文件
export async function uploadAudioFile(file: File): Promise<UploadResponse> {
  const token = getToken();
  if (!token) {
    throw new Error('未登录');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '上传失败');
  }

  return data as UploadResponse;
}

// 从 Base64 创建 File 对象并上传
export async function uploadAudioFromBase64(
  base64Data: string,
  filename: string = 'audio.wav'
): Promise<UploadResponse> {
  // 移除 data URL 前缀（如果有）
  const base64Content = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data;

  // 解码 Base64
  const byteCharacters = atob(base64Content);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  // 推断 MIME 类型
  let mimeType = 'audio/wav';
  if (base64Data.startsWith('data:')) {
    const match = base64Data.match(/data:([^;]+);/);
    if (match) {
      mimeType = match[1];
    }
  }

  // 创建 File 对象
  const file = new File([byteArray], filename, { type: mimeType });

  return uploadAudioFile(file);
}

// 获取文件签名 URL
export async function getFileUrl(fileId: string, expire: number = 3600): Promise<FileUrlResponse> {
  const token = getToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_BASE_URL}/files/${fileId}/url?expire=${expire}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '获取文件URL失败');
  }

  return data as FileUrlResponse;
}

// 直接获取文件内容（用于播放音频）
export function getFileContentUrl(fileId: string): string {
  const token = getToken();
  // 返回直接访问 URL（需要在请求时带上 token）
  return `${API_BASE_URL}/files/${fileId}`;
}

// 获取带认证的音频 Blob URL
export async function getAudioBlobUrl(fileId: string): Promise<string> {
  const token = getToken();
  if (!token) {
    throw new Error('未登录');
  }

  const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || '获取音频失败');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
