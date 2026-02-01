// 前端情感类型（UI 展示用）
export enum EmotionType {
  SAME_AS_VOICE = 'same_as_voice',
  VECTORS = 'emotion_vectors',
  REFERENCE_AUDIO = 'reference_audio'
}

// 后端情感模式（API 传输用）
export type EmotionMode = 'same_as_reference' | 'emotion_prompt' | 'emotion_vector' | 'emotion_text';

// 前端到后端情感类型映射
export const emotionTypeToMode: Record<EmotionType, EmotionMode> = {
  [EmotionType.SAME_AS_VOICE]: 'same_as_reference',
  [EmotionType.VECTORS]: 'emotion_vector',
  [EmotionType.REFERENCE_AUDIO]: 'emotion_prompt',
};

export interface EmotionVectors {
  happy: number;      // 喜
  angry: number;      // 怒
  sad: number;        // 哀
  fear: number;       // 惧
  disgust: number;    // 厌恶
  depressed: number;  // 低落
  surprised: number;  // 惊喜
  calm: number;       // 平静
}

export interface VoiceProject {
  voiceReference: string | null; // Base64 格式的声音参考音频
  script: string;                // 需要合成的文本内容
  emotionType: EmotionType;      // 情感控制模式
  emotionVectors: EmotionVectors; // 8维情感向量（仅 VECTORS 模式使用）
  emotionReference: string | null; // Base64 格式的情感参考音频（仅 REFERENCE_AUDIO 模式使用）
  /**
   * 情感强度/混合系数 (0-1)
   * - 在 VECTORS 模式下：控制情感向量对生成语音的影响强度
   * - 在 REFERENCE_AUDIO 模式下：控制从参考音频提取的情感特征的混合强度
   * - 0 表示无情感影响，1 表示完全应用情感特征
   */
  emotionAlpha: number;
}

export type TaskStatus = 'processing' | 'completed' | 'failed';

export interface CloneTask {
  id: string;
  status: TaskStatus;
  script: string;
  audioUrl: string | null;
  createdAt: number;
  errorMessage?: string;
}

export interface GenerationResult {
  audioUrl: string | null;
  status: 'idle' | 'generating' | 'success' | 'error';
  errorMessage?: string;
}

// ========== 后端 API 类型 ==========

// 后端任务状态
export type BackendTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 创建任务请求
export interface CreateTaskRequest {
  text: string;
  reference_audio_file_id: string;
  emotion_mode: EmotionMode;
  emotion_prompt_file_id?: string;
  emotion_vector?: number[];
  emotion_alpha?: number;
}

// 创建任务响应
export interface CreateTaskResponse {
  id: string;
  status: BackendTaskStatus;
  created_at: string;
}

// 任务详情响应
export interface TaskResponse {
  id: string;
  status: BackendTaskStatus;
  text: string;
  reference_audio_file_id: string;
  emotion_mode: EmotionMode;
  emotion_prompt_file_id?: string;
  emotion_vector?: string;
  emotion_alpha?: number;
  result_audio_file_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// 任务列表项
export interface TaskListItem {
  id: string;
  status: BackendTaskStatus;
  text: string;
  result_audio_file_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// 任务列表响应
export interface TaskListResponse {
  tasks: TaskListItem[];
  total: number;
  page: number;
  page_size: number;
}

// 文件上传响应
export interface UploadResponse {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

// 文件 URL 响应
export interface FileUrlResponse {
  url: string;
  expires_at: string;
}
