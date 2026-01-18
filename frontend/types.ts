
export enum EmotionType {
  SAME_AS_VOICE = 'same_as_voice',
  VECTORS = 'emotion_vectors',
  REFERENCE_AUDIO = 'reference_audio'
}

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
  voiceReference: string | null; // Base64
  script: string;
  emotionType: EmotionType;
  emotionVectors: EmotionVectors;
  emotionReference: string | null; // Base64
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
