import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceProject, EmotionType, EmotionVectors, CloneTask, emotionTypeToMode, TaskListItem, BackendTaskStatus, AudioFavorite } from '../types';
import { fileToBase64, fileToDataUrl, trimAudioFile } from '../services/audioUtils';
import { uploadAudioFile } from '../services/fileService';
import { createTask, getTasks, pollTaskUntilDone, deleteTask, clearTasks } from '../services/taskService';
import { getAudioBlobUrl } from '../services/fileService';
import { User, getCurrentUser } from '../services/api';
import TaskList from './TaskList';
import FavoritesPanel from './FavoritesPanel';
import AudioWaveformEditor from './AudioWaveformEditor';
import { addFavorite } from '../data/mockFavorites';

const initialVectors: EmotionVectors = {
  happy: 0,
  angry: 0,
  sad: 0,
  fear: 0,
  disgust: 0,
  depressed: 0,
  surprised: 0,
  calm: 0
};

const emotionLabels: Record<keyof EmotionVectors, string> = {
  happy: '喜悦',
  angry: '愤怒',
  sad: '哀伤',
  fear: '恐惧',
  disgust: '厌恶',
  depressed: '低落',
  surprised: '惊喜',
  calm: '平静',
};

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

interface VoiceStudioProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

const FAVORITE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const VoiceStudio: React.FC<VoiceStudioProps> = ({ user, onUserUpdate }) => {
  const [project, setProject] = useState<VoiceProject>({
    voiceReference: null,
    script: '',
    emotionType: EmotionType.SAME_AS_VOICE,
    emotionVectors: { ...initialVectors },
    emotionReference: null,
    emotionAlpha: 0.8
  });

  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voiceReferenceFile, setVoiceReferenceFile] = useState<File | null>(null);
  const [emotionReferenceFile, setEmotionReferenceFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tasks, setTasks] = useState<CloneTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [voiceTrim, setVoiceTrim] = useState({ start: 0, end: 0, duration: 0 });
  const [emotionTrim, setEmotionTrim] = useState({ start: 0, end: 0, duration: 0 });
  const [tasksPage, setTasksPage] = useState(1);
  const [tasksTotal, setTasksTotal] = useState(0);

  const voiceInputRef = useRef<HTMLInputElement>(null);
  const emotionInputRef = useRef<HTMLInputElement>(null);
  const [emotionPreviewUrl, setEmotionPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadTasks = useCallback(async () => {
    try {
      const response = await getTasks({ page: tasksPage, page_size: 10 });
      setTasksTotal(response.total);

      const frontendTasks: CloneTask[] = await Promise.all(
        response.tasks.map(async (task: TaskListItem): Promise<CloneTask> => {
          let audioUrl: string | null = null;
          let emotionVector: number[] | undefined;

          if (task.emotion_vector) {
            try {
              const parsed = JSON.parse(task.emotion_vector);
              if (Array.isArray(parsed)) {
                emotionVector = parsed;
              }
            } catch {
              // Ignore invalid stored vector data
            }
          }

          if (task.status === 'completed' && task.result_audio_file_id) {
            try {
              audioUrl = await getAudioBlobUrl(task.result_audio_file_id);
            } catch {
              // Ignore loading error for result audio
            }
          }

          return {
            id: task.id,
            status: task.status === 'pending' ? 'processing' : task.status,
            script: task.text,
            audioUrl,
            referenceAudioFileId: task.reference_audio_file_id,
            emotionMode: task.emotion_mode,
            emotionPromptFileId: task.emotion_prompt_file_id,
            emotionVector,
            emotionAlpha: task.emotion_alpha,
            createdAt: new Date(task.created_at).getTime(),
            errorMessage: task.error_message,
          };
        })
      );

      setTasks(frontendTasks);
    } catch (error) {
      console.error('加载任务列表失败:', error);
    }
  }, [tasksPage]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleDeleteTask = useCallback(async (id: string) => {
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setTasksTotal((prev) => Math.max(0, prev - 1));
      setToast({ type: 'success', message: '历史记录已删除' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      setToast({ type: 'error', message: errorMessage });
    }
  }, []);

  const handleClearAllTasks = useCallback(async () => {
    if (!confirm('清空全部任务历史？')) {
      return;
    }

    try {
      await clearTasks();
      setTasks([]);
      setTasksTotal(0);
      setTasksPage(1);
      setToast({ type: 'success', message: '历史记录已清空' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '清空失败';
      setToast({ type: 'error', message: errorMessage });
    }
  }, []);

  const processVoiceFile = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setToast({ type: 'error', message: '请上传有效的音频文件' });
      return;
    }
    const base64 = await fileToBase64(file);
    const previewUrl = URL.createObjectURL(file);

    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);

    setVoicePreviewUrl(previewUrl);
    setVoiceReferenceFile(file);
    setVoiceTrim({ start: 0, end: 0, duration: 0 });
    setProject((prev) => ({ ...prev, voiceReference: base64 }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processVoiceFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;

    const file = e.dataTransfer.files?.[0];
    if (file) await processVoiceFile(file);
  };

  const handleResetVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    setVoicePreviewUrl(null);
    setVoiceReferenceFile(null);
    setVoiceTrim({ start: 0, end: 0, duration: 0 });
    setProject((prev) => ({ ...prev, voiceReference: null }));
    if (voiceInputRef.current) voiceInputRef.current.value = '';
  };

  const processEmotionFile = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setToast({ type: 'error', message: '请上传有效的音频文件' });
      return;
    }
    const base64 = await fileToBase64(file);
    const previewUrl = URL.createObjectURL(file);

    if (emotionPreviewUrl) URL.revokeObjectURL(emotionPreviewUrl);

    setEmotionPreviewUrl(previewUrl);
    setEmotionReferenceFile(file);
    setEmotionTrim({ start: 0, end: 0, duration: 0 });
    setProject((prev) => ({ ...prev, emotionReference: base64 }));
  };

  const handleEmotionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processEmotionFile(file);
  };

  const handleResetEmotion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (emotionPreviewUrl) URL.revokeObjectURL(emotionPreviewUrl);
    setEmotionPreviewUrl(null);
    setEmotionReferenceFile(null);
    setEmotionTrim({ start: 0, end: 0, duration: 0 });
    setProject((prev) => ({ ...prev, emotionReference: null }));
    if (emotionInputRef.current) emotionInputRef.current.value = '';
  };

  const handleUseVoiceFavorite = async (favorite: AudioFavorite) => {
    try {
      const response = await fetch(favorite.audioUrl);
      const blob = await response.blob();
      const file = new File([blob], `${favorite.name}.wav`, { type: 'audio/wav' });
      await processVoiceFile(file);
      setToast({ type: 'success', message: `已使用音色收藏：${favorite.name}` });
    } catch {
      setToast({ type: 'error', message: '加载音色失败' });
    }
  };

  const handleUseEmotionFavorite = async (favorite: AudioFavorite) => {
    try {
      const response = await fetch(favorite.audioUrl);
      const blob = await response.blob();
      const file = new File([blob], `${favorite.name}.wav`, { type: 'audio/wav' });
      await processEmotionFile(file);
      setProject((prev) => ({ ...prev, emotionType: EmotionType.REFERENCE_AUDIO }));
      setToast({ type: 'success', message: `已使用情感收藏：${favorite.name}` });
    } catch {
      setToast({ type: 'error', message: '加载情感音频失败' });
    }
  };

  const updateVector = (key: keyof EmotionVectors, value: number) => {
    setProject((prev) => ({
      ...prev,
      emotionVectors: { ...prev.emotionVectors, [key]: value }
    }));
  };

  const getFavoriteDefaultName = (prefix: string): string => {
    const formatted = FAVORITE_TIME_FORMATTER.format(new Date()).replace(/\//g, '-');
    return `${prefix} ${formatted}`;
  };

  const handleAddFavoriteFromFile = async (
    category: 'voice' | 'emotion',
    file: File,
    prefix: string,
    trimState?: { start: number; end: number; duration: number }
  ) => {
    try {
      let fileForFavorite = file;
      const shouldTrim = trimState
        && trimState.duration > 0
        && (trimState.start > 0.01 || trimState.end < trimState.duration - 0.01);

      if (shouldTrim) {
        fileForFavorite = await trimAudioFile(file, trimState.start, trimState.end);
      }

      const dataUrl = await fileToDataUrl(fileForFavorite);
      const result = addFavorite(category, getFavoriteDefaultName(prefix), dataUrl);
      setToast({
        type: 'success',
        message: result.added ? '已加入收藏' : '该音频已在收藏中',
      });
    } catch {
      setToast({ type: 'error', message: '收藏失败，请稍后重试' });
    }
  };

  const handleAddFavoriteFromHistory = useCallback(
    async (category: 'voice' | 'emotion', audioUrl: string, nameHint: string) => {
      try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const file = new File([blob], `${nameHint}.wav`, { type: blob.type || 'audio/wav' });
        const dataUrl = await fileToDataUrl(file);
        const result = addFavorite(category, nameHint, dataUrl);
        setToast({
          type: 'success',
          message: result.added ? '已加入收藏' : '该音频已在收藏中',
        });
      } catch {
        setToast({ type: 'error', message: '收藏失败，请稍后重试' });
      }
    },
    []
  );

  const generateVoice = async () => {
    if (!voiceReferenceFile || !project.script) {
      setToast({ type: 'error', message: '请上传声音参考并输入台词内容' });
      return;
    }

    if (user.credits < 1) {
      setToast({ type: 'error', message: '余额不足，请先充值' });
      return;
    }

    setIsProcessing(true);

    try {
      let voiceFileForUpload = voiceReferenceFile;
      const shouldTrimVoice = voiceTrim.duration > 0
        && (voiceTrim.start > 0.01 || voiceTrim.end < voiceTrim.duration - 0.01);

      if (shouldTrimVoice) {
        setToast({ type: 'success', message: '正在裁剪音色参考音频...' });
        voiceFileForUpload = await trimAudioFile(voiceReferenceFile, voiceTrim.start, voiceTrim.end);
      }

      setToast({ type: 'success', message: '正在上传音频...' });
      const voiceUploadResult = await uploadAudioFile(voiceFileForUpload);

      let emotionPromptFileId: string | undefined;
      if (project.emotionType === EmotionType.REFERENCE_AUDIO && emotionReferenceFile) {
        let emotionFileForUpload = emotionReferenceFile;
        const shouldTrimEmotion = emotionTrim.duration > 0
          && (emotionTrim.start > 0.01 || emotionTrim.end < emotionTrim.duration - 0.01);

        if (shouldTrimEmotion) {
          setToast({ type: 'success', message: '正在裁剪情感参考音频...' });
          emotionFileForUpload = await trimAudioFile(emotionReferenceFile, emotionTrim.start, emotionTrim.end);
        }

        const emotionUploadResult = await uploadAudioFile(emotionFileForUpload);
        emotionPromptFileId = emotionUploadResult.id;
      }

      let emotionVector: number[] | undefined;
      if (project.emotionType === EmotionType.VECTORS) {
        emotionVector = [
          project.emotionVectors.happy,
          project.emotionVectors.angry,
          project.emotionVectors.sad,
          project.emotionVectors.fear,
          project.emotionVectors.disgust,
          project.emotionVectors.depressed,
          project.emotionVectors.surprised,
          project.emotionVectors.calm,
        ];
      }

      setToast({ type: 'success', message: '正在创建任务...' });
      const createResult = await createTask({
        text: project.script,
        reference_audio_file_id: voiceUploadResult.id,
        emotion_mode: emotionTypeToMode[project.emotionType],
        emotion_prompt_file_id: emotionPromptFileId,
        emotion_vector: emotionVector,
        emotion_alpha: project.emotionAlpha,
      });

      const newTask: CloneTask = {
        id: createResult.id,
        status: 'processing',
        script: project.script,
        audioUrl: null,
        referenceAudioFileId: voiceUploadResult.id,
        emotionMode: emotionTypeToMode[project.emotionType],
        emotionPromptFileId,
        emotionVector,
        emotionAlpha: project.emotionAlpha,
        createdAt: new Date(createResult.created_at).getTime(),
      };
      setTasks((prev) => [newTask, ...prev]);

      setToast({ type: 'success', message: '任务已提交，正在处理中...' });
      const completedTask = await pollTaskUntilDone(createResult.id, {
        interval: 2000,
        timeout: 300000,
        onStatusChange: (status: BackendTaskStatus) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === createResult.id ? { ...t, status: status === 'pending' ? 'processing' : status } : t
            )
          );
        },
      });

      if (completedTask.status === 'completed' && completedTask.result_audio_file_id) {
        const audioUrl = await getAudioBlobUrl(completedTask.result_audio_file_id);
        try {
          const updatedUser = await getCurrentUser();
          onUserUpdate(updatedUser);
        } catch {
          // ignore refresh failure
        }
        setTasks((prev) => prev.map((t) => (t.id === createResult.id ? { ...t, status: 'completed', audioUrl } : t)));
        setToast({ type: 'success', message: '克隆成功！' });
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === createResult.id
              ? { ...t, status: 'failed', errorMessage: completedTask.error_message || '生成失败' }
              : t
          )
        );
        setToast({ type: 'error', message: completedTask.error_message || '克隆任务失败' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      setToast({ type: 'error', message: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5 pb-12 relative">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110]">
          <div className={`toast ${toast.type === 'success' ? 'success' : 'error'}`}>
            <i className={`fas ${toast.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'} mr-2`}></i>
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="hidden xl:block xl:col-span-4">
          <FavoritesPanel onUseVoice={handleUseVoiceFavorite} onUseEmotion={handleUseEmotionFavorite} />
        </div>

        <div className="xl:col-span-4 glass-panel rounded-[28px] p-5 md:p-6 space-y-5">
          <div className="pb-4 border-b soft-divider flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl text-[var(--text-primary)]">克隆工作室</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">上传参考音频、输入台词并配置情感，随后提交生成任务。</p>
            </div>
            <span className="pill warning">$1.00 / 每次</span>
          </div>

          <div className="space-y-2">
            <label className="muted-label">声音参考音频</label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !project.voiceReference && !isProcessing && voiceInputRef.current?.click()}
              className={`upload-zone p-5 flex flex-col items-center justify-center text-center gap-3 cursor-pointer ${
                isDragging ? 'is-dragging' : ''
              } ${project.voiceReference ? 'is-filled' : ''} ${isProcessing ? 'disabled' : ''}`}
            >
              <input type="file" ref={voiceInputRef} className="hidden" accept="audio/*" onChange={handleFileChange} />

              {!project.voiceReference ? (
                <>
                  <div className="w-12 h-12 rounded-xl panel-subtle flex items-center justify-center">
                    <i className="fas fa-cloud-arrow-up text-lg text-[var(--accent-ink)]"></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">点击或拖拽上传音色样本</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">支持 WAV / MP3 / AAC，建议 15 秒以上</p>
                  </div>
                </>
              ) : (
                <div className="w-full space-y-3 text-left">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="pill success">
                      <i className="fas fa-check"></i>
                      音色参考已就绪
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => voiceReferenceFile && void handleAddFavoriteFromFile('voice', voiceReferenceFile, '音色收藏', voiceTrim)}
                        className="ghost-button focus-ring h-8 px-3 text-xs font-semibold"
                      >
                        <i className="fas fa-bookmark mr-1.5"></i>
                        收藏
                      </button>
                      <button
                        onClick={handleResetVoice}
                        className="ghost-button focus-ring h-8 px-3 text-xs font-semibold"
                      >
                        更换音频
                      </button>
                    </div>
                  </div>

                  {voiceReferenceFile && voicePreviewUrl && (
                    <AudioWaveformEditor
                      key={`${voiceReferenceFile.name}-${voiceReferenceFile.lastModified}`}
                      file={voiceReferenceFile}
                      audioUrl={voicePreviewUrl}
                      disabled={isProcessing}
                      accent="voice"
                      onTrimChange={(start, end, duration) => {
                        setVoiceTrim({ start, end, duration });
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="muted-label">文本脚本</label>
            <textarea
              disabled={isProcessing}
              className="app-textarea"
              placeholder="输入需要转换成语音的文字内容..."
              value={project.script}
              onChange={(e) => setProject((prev) => ({ ...prev, script: e.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <label className="muted-label">情感控制模式</label>
            <div className="segment-control">
              {['VECTORS', 'SAME_AS_VOICE', 'REFERENCE_AUDIO'].map((key) => {
                const type = EmotionType[key as keyof typeof EmotionType];
                const isActive = project.emotionType === type;
                return (
                  <button
                    key={key}
                    disabled={isProcessing}
                    onClick={() => setProject((prev) => ({ ...prev, emotionType: type }))}
                    className={`segment-btn focus-ring ${isActive ? 'active' : ''}`}
                  >
                    {key === 'VECTORS' ? '精细调节' : key === 'SAME_AS_VOICE' ? '保持原味' : '模仿参考'}
                  </button>
                );
              })}
            </div>

            {project.emotionType === EmotionType.SAME_AS_VOICE && (
              <div className="info-block">
                <i className="fas fa-circle-info mr-1.5 text-[var(--accent-ink)]"></i>
                直接沿用音色参考中的原始情感表达。
              </div>
            )}

            {project.emotionType === EmotionType.VECTORS && (
              <div className="info-block space-y-3">
                <p>
                  <i className="fas fa-sliders mr-1.5 text-[var(--accent-ink)]"></i>
                  使用 8 维情感向量进行精细控制，可混合多种情感表达。
                </p>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {(Object.keys(project.emotionVectors) as Array<keyof EmotionVectors>).map((key) => (
                    <div key={key}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[var(--text-secondary)]">{emotionLabels[key]}</span>
                        <span className="text-[var(--text-primary)] font-semibold">{project.emotionVectors[key].toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        disabled={isProcessing}
                        value={project.emotionVectors[key]}
                        onChange={(e) => updateVector(key, parseFloat(e.target.value))}
                        className="range-input"
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t soft-divider">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[var(--text-secondary)]">情感强度</span>
                    <span className="text-[var(--text-primary)] font-semibold">{project.emotionAlpha.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    disabled={isProcessing}
                    value={project.emotionAlpha}
                    onChange={(e) => setProject((prev) => ({ ...prev, emotionAlpha: parseFloat(e.target.value) }))}
                    className="range-input"
                  />
                </div>
              </div>
            )}

            {project.emotionType === EmotionType.REFERENCE_AUDIO && (
              <div className="space-y-3">
                <div className="info-block">
                  <i className="fas fa-masks-theater mr-1.5 text-[var(--accent-rose)]"></i>
                  上传目标情绪样本，系统会提取其中的情感特征并混合到结果语音。
                </div>

                <div
                  onClick={() => !project.emotionReference && !isProcessing && emotionInputRef.current?.click()}
                  className={`upload-zone p-4 flex flex-col items-center justify-center text-center gap-2 cursor-pointer ${
                    project.emotionReference ? 'is-filled' : ''
                  } ${isProcessing ? 'disabled' : ''}`}
                >
                  <input
                    type="file"
                    ref={emotionInputRef}
                    className="hidden"
                    accept="audio/*"
                    onChange={handleEmotionFileChange}
                  />

                  {!project.emotionReference ? (
                    <>
                      <div className="w-10 h-10 rounded-xl panel-subtle flex items-center justify-center text-[var(--accent-rose)]">
                        <i className="fas fa-masks-theater"></i>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">上传情感参考音频</p>
                    </>
                  ) : (
                    <div className="w-full space-y-3 text-left">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="pill success">情感参考已设置</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => emotionReferenceFile && void handleAddFavoriteFromFile('emotion', emotionReferenceFile, '情感收藏', emotionTrim)}
                            className="ghost-button focus-ring h-8 px-3 text-xs font-semibold"
                          >
                            <i className="fas fa-bookmark mr-1.5"></i>
                            收藏
                          </button>
                          <button onClick={handleResetEmotion} className="ghost-button focus-ring h-8 px-3 text-xs font-semibold">
                            更换
                          </button>
                        </div>
                      </div>

                      {emotionReferenceFile && emotionPreviewUrl && (
                        <AudioWaveformEditor
                          key={`${emotionReferenceFile.name}-${emotionReferenceFile.lastModified}`}
                          file={emotionReferenceFile}
                          audioUrl={emotionPreviewUrl}
                          disabled={isProcessing}
                          accent="emotion"
                          onTrimChange={(start, end, duration) => {
                            setEmotionTrim({ start, end, duration });
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="info-block">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[var(--text-secondary)]">情感强度</span>
                    <span className="text-[var(--text-primary)] font-semibold">{project.emotionAlpha.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    disabled={isProcessing}
                    value={project.emotionAlpha}
                    onChange={(e) => setProject((prev) => ({ ...prev, emotionAlpha: parseFloat(e.target.value) }))}
                    className="range-input"
                  />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">数值越高越接近情感样本，越低越保留原音风格。</p>
                </div>
              </div>
            )}
          </div>

          <button onClick={generateVoice} disabled={isProcessing} className="action-button focus-ring flex items-center justify-center gap-2">
            {isProcessing ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                正在生成克隆语音...
              </>
            ) : (
              <>
                <i className="fas fa-bolt"></i>
                提交克隆任务
              </>
            )}
          </button>
        </div>

        <div className="xl:col-span-4 glass-panel rounded-[28px] p-5 md:p-6 flex flex-col h-[680px]">
          <div className="pb-4 mb-4 border-b soft-divider flex items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl text-[var(--text-primary)]">生成历史</h2>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1">查看状态、试听结果并管理任务。</p>
            </div>
            <span className="pill">共 {tasksTotal} 条</span>
          </div>

          <TaskList
            tasks={tasks}
            onDeleteTask={handleDeleteTask}
            onClearAll={handleClearAllTasks}
            onAddFavorite={handleAddFavoriteFromHistory}
          />
        </div>

        <div className="xl:hidden xl:col-span-12">
          <FavoritesPanel onUseVoice={handleUseVoiceFavorite} onUseEmotion={handleUseEmotionFavorite} />
        </div>
      </div>
    </div>
  );
};

export default VoiceStudio;
