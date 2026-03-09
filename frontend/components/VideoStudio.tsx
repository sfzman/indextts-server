import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFileUrl, uploadMediaFile } from '../services/fileService';
import AudioWaveformEditor from './AudioWaveformEditor';
import { trimAudioFile } from '../services/audioUtils';
import {
  createVideoTask,
  getVideoModels,
  getVideoTasks,
  type VideoModelOption,
  type VideoTaskItemResponse
} from '../services/videoService';

type VideoResolution = '480P' | '720P' | '1080P';
type VideoDuration = number;
type VideoTaskStatus = 'processing' | 'completed' | 'failed';

interface VideoTask {
  id: string;
  status: VideoTaskStatus;
  prompt: string;
  modelCode: string;
  resolution: VideoResolution;
  duration: VideoDuration;
  startFrameName?: string;
  endFrameName?: string;
  audioName?: string;
  videoUrl?: string;
  createdAt: number;
  errorMessage?: string;
}

const DEFAULT_VIDEO_MODELS: VideoModelOption[] = [
  {
    name: 'Wan 2.6',
    code: 'wan2.6-i2v',
    description: '万相2.6。新增多镜头叙事能力，同时支持自动配音和传入自定义音频文件。',
  },
  {
    name: 'Wan 2.6 Flash',
    code: 'wan2.6-i2v-flash',
    description:
      '万相2.6-图生视频-Flash，生成更快更高性价比。智能分镜调度支持多镜头叙事，多人稳定对话，更自然真实音色，最高支持15秒时长生成',
  },
  {
    name: 'Wan 2.5',
    code: 'wan2.5-i2v-preview',
    description: '万相2.5。图生视频预览版。',
  },
];

const MODEL_CAPABILITY: Record<string, { supportsAudio: boolean; credits: number }> = {
  'wan2.6-i2v': { supportsAudio: true, credits: 20 },
  'wan2.6-i2v-flash': { supportsAudio: true, credits: 20 },
  'wan2.5-i2v-preview': { supportsAudio: true, credits: 15 },
};

const taskTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const VideoStudio: React.FC = () => {
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [videoModels, setVideoModels] = useState<VideoModelOption[]>(DEFAULT_VIDEO_MODELS);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [modelCode, setModelCode] = useState<string>(DEFAULT_VIDEO_MODELS[0].code);
  const [resolution, setResolution] = useState<VideoResolution>('720P');
  const [duration, setDuration] = useState<VideoDuration>(5);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [startFrameFile, setStartFrameFile] = useState<File | null>(null);
  const [endFrameFile, setEndFrameFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioTrim, setAudioTrim] = useState({ start: 0, end: 0, duration: 0 });
  const [startFramePreviewUrl, setStartFramePreviewUrl] = useState<string | null>(null);
  const [endFramePreviewUrl, setEndFramePreviewUrl] = useState<string | null>(null);

  const startFrameInputRef = useRef<HTMLInputElement>(null);
  const endFrameInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
        setIsModelMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadVideoModels = async () => {
      try {
        const models = await getVideoModels();
        if (!isMounted || models.length === 0) {
          return;
        }

        setVideoModels(models);
        setModelCode((prev) => (models.some((item) => item.code === prev) ? prev : models[0].code));
      } catch {
        // Keep fallback models when API is unavailable.
      }
    };

    void loadVideoModels();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedModel = useMemo(
    () => videoModels.find((item) => item.code === modelCode) || videoModels[0] || DEFAULT_VIDEO_MODELS[0],
    [videoModels, modelCode]
  );

  const modelNameMap = useMemo(() => {
    const map = new Map<string, string>();
    DEFAULT_VIDEO_MODELS.forEach((item) => map.set(item.code, item.name));
    videoModels.forEach((item) => map.set(item.code, item.name));
    return map;
  }, [videoModels]);

  const getModelName = useCallback((code: string): string => {
    return modelNameMap.get(code) || code;
  }, [modelNameMap]);

  const currentModelCapability = useMemo(
    () => MODEL_CAPABILITY[selectedModel.code] || { supportsAudio: true, credits: 20 },
    [selectedModel.code]
  );

  const extractFilename = (value?: string): string | undefined => {
    if (!value) {
      return undefined;
    }
    try {
      const pathname = new URL(value).pathname;
      const filename = pathname.split('/').pop();
      return filename || value;
    } catch {
      const filename = value.split('/').pop();
      return filename || value;
    }
  };

  const getMetaString = (meta: Record<string, unknown> | undefined, key: string): string | undefined => {
    if (!meta) {
      return undefined;
    }
    const value = meta[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  const mapBackendTask = useCallback(async (item: VideoTaskItemResponse): Promise<VideoTask> => {
    let videoUrl: string | undefined;
    if (item.status === 'completed' && item.result_video_file_id) {
      try {
        const file = await getFileUrl(item.result_video_file_id, 3600);
        videoUrl = file.url;
      } catch {
        // Keep empty URL if signed URL fetch fails.
      }
    }

    const normalizedStatus: VideoTaskStatus = item.status === 'failed'
      ? 'failed'
      : item.status === 'completed'
        ? 'completed'
        : 'processing';

    const normalizedResolution = (item.resolution || '720P') as VideoResolution;
    const normalizedDuration = typeof item.duration === 'number' ? item.duration : 5;

    return {
      id: item.id,
      status: normalizedStatus,
      prompt: item.prompt,
      modelCode: item.model,
      resolution: normalizedResolution,
      duration: normalizedDuration,
      startFrameName: getMetaString(item.meta, 'image_filename') || item.image_file_id || extractFilename(item.image_url),
      endFrameName: getMetaString(item.meta, 'end_frame_filename') || item.end_frame_file_id || undefined,
      audioName: getMetaString(item.meta, 'audio_filename') || item.audio_file_id || extractFilename(item.audio_url),
      videoUrl,
      createdAt: new Date(item.created_at).getTime(),
      errorMessage: item.error_message || item.provider_message,
    };
  }, []);

  const loadVideoTasks = useCallback(async () => {
    try {
      setTaskError(null);
      const response = await getVideoTasks({ page: 1, page_size: 30 });
      const mapped = await Promise.all(response.tasks.map((item) => mapBackendTask(item)));
      setTasks(mapped);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载视频任务失败';
      setTaskError(message);
      setTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [mapBackendTask]);

  useEffect(() => {
    void loadVideoTasks();
  }, [loadVideoTasks]);

  useEffect(() => {
    if (!tasks.some((task) => task.status === 'processing')) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadVideoTasks();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [tasks, loadVideoTasks]);

  useEffect(() => {
    if (!currentModelCapability.supportsAudio && audioFile) {
      setAudioFile(null);
      setAudioTrim({ start: 0, end: 0, duration: 0 });
    }
  }, [currentModelCapability.supportsAudio, audioFile]);

  useEffect(() => {
    if (!startFrameFile) {
      setStartFramePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(startFrameFile);
    setStartFramePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [startFrameFile]);

  useEffect(() => {
    if (!endFrameFile) {
      setEndFramePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(endFrameFile);
    setEndFramePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [endFrameFile]);

  useEffect(() => {
    if (!audioFile) {
      setAudioPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  const currentCredits = useMemo(() => currentModelCapability.credits, [currentModelCapability.credits]);
  const supportsAudio = useMemo(() => currentModelCapability.supportsAudio, [currentModelCapability.supportsAudio]);

  const handleCreateTask = async () => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt || isGenerating) {
      return;
    }
    if (!startFrameFile) {
      setSubmitError('请先上传首帧图片');
      return;
    }

    setSubmitError(null);
    setIsGenerating(true);
    setIsSettingsOpen(false);
    setIsModelMenuOpen(false);

    try {
      const imageUpload = await uploadMediaFile(startFrameFile);
      const endFrameUpload = endFrameFile ? await uploadMediaFile(endFrameFile) : null;
      let audioFileForUpload = audioFile;
      if (supportsAudio && audioFileForUpload) {
        const shouldTrimAudio = audioTrim.duration > 0
          && (audioTrim.start > 0.01 || audioTrim.end < audioTrim.duration - 0.01);
        if (shouldTrimAudio) {
          audioFileForUpload = await trimAudioFile(audioFileForUpload, audioTrim.start, audioTrim.end);
        }
      }
      const audioUpload = supportsAudio && audioFileForUpload ? await uploadMediaFile(audioFileForUpload) : null;

      await createVideoTask({
        model: selectedModel.code,
        prompt: normalizedPrompt,
        image_file_id: imageUpload.id,
        end_frame_file_id: endFrameUpload?.id,
        audio_file_id: audioUpload?.id,
        resolution,
        duration,
        prompt_extend: true,
        audio: supportsAudio ? (audioUpload ? undefined : true) : undefined,
      });

      setPrompt('');
      setStartFrameFile(null);
      setEndFrameFile(null);
      setAudioFile(null);
      setAudioTrim({ start: 0, end: 0, duration: 0 });
      await loadVideoTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : '提交视频任务失败';
      setSubmitError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReuseTaskConfig = (task: VideoTask) => {
    setPrompt(task.prompt);
    setModelCode(task.modelCode);
    setResolution(task.resolution);
    setDuration(task.duration);
    setIsSettingsOpen(false);
    setIsModelMenuOpen(false);
  };

  const handleSwapFrames = () => {
    setStartFrameFile(endFrameFile);
    setEndFrameFile(startFrameFile);
  };

  const handleResetAudio = (event: React.MouseEvent) => {
    event.stopPropagation();
    setAudioFile(null);
    setAudioTrim({ start: 0, end: 0, duration: 0 });
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const renderTaskStatus = (status: VideoTaskStatus) => {
    if (status === 'completed') {
      return <span className="pill success">生成成功</span>;
    }
    if (status === 'failed') {
      return <span className="pill error">生成失败</span>;
    }
    return <span className="pill warning">生成中</span>;
  };

  const renderFileButton = (
    label: string,
    iconClass: string,
    file: File | null,
    onClick: () => void,
    disabled?: boolean,
    helperText?: string,
    previewUrl?: string | null,
    asImageTile?: boolean
  ) => (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={asImageTile ? 'video-image-upload-tile focus-ring' : `video-upload-chip focus-ring ${previewUrl ? 'has-preview' : ''}`}
      >
        {asImageTile ? (
          previewUrl ? (
            <>
              <img src={previewUrl} alt={`${label}预览`} className="video-image-upload-tile-image" />
              <span className="video-image-upload-tile-badge">{label}</span>
              <span className="video-upload-hover-preview">
                <img src={previewUrl} alt={`${label}大图预览`} className="video-upload-hover-image" />
              </span>
            </>
          ) : (
            <>
              <i className={`fas ${iconClass}`}></i>
              <span>{label}</span>
            </>
          )
        ) : (
          <>
            {previewUrl ? (
              <span className="video-upload-thumb-wrap">
                <img src={previewUrl} alt={`${label}预览`} className="video-upload-thumb" />
                <span className="video-upload-hover-preview">
                  <img src={previewUrl} alt={`${label}大图预览`} className="video-upload-hover-image" />
                </span>
              </span>
            ) : (
              <i className={`fas ${iconClass}`}></i>
            )}
            <span>{label}</span>
          </>
        )}
      </button>
      <p className="video-upload-name">{file ? file.name : helperText || '未选择文件'}</p>
    </div>
  );

  return (
    <div className="pb-2 xl:grid xl:grid-cols-[390px_minmax(0,1fr)] xl:gap-5 xl:items-start space-y-5 xl:space-y-0">
      <section className="order-1 xl:order-2 glass-panel rounded-[28px] p-5 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 mb-4 border-b soft-divider">
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">视频工坊</h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">任务列表展示已生成视频，右侧保留每次生成输入参数，便于复用。</p>
          </div>
          <span className="pill premium-pill">
            <i className="fas fa-film text-[var(--accent-ink)]"></i>
            共 {tasks.length} 条视频任务
          </span>
        </div>

        <div className="space-y-4 max-h-[56vh] overflow-y-auto custom-scrollbar pr-1">
          {isLoadingTasks ? (
            <div className="panel-subtle rounded-2xl p-6 text-center text-[13px] text-[var(--text-secondary)]">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              正在加载视频任务...
            </div>
          ) : null}

          {!isLoadingTasks && taskError ? (
            <div className="panel-subtle rounded-2xl p-6 text-center text-[13px] text-[var(--text-secondary)]">
              <p className="mb-3">{taskError}</p>
              <button type="button" onClick={() => void loadVideoTasks()} className="ghost-button focus-ring h-9 px-4 text-xs font-semibold">
                重新加载
              </button>
            </div>
          ) : null}

          {!isLoadingTasks && !taskError && tasks.length === 0 ? (
            <div className="panel-subtle rounded-2xl p-6 text-center text-[13px] text-[var(--text-secondary)]">
              暂无视频任务
            </div>
          ) : null}

          {!isLoadingTasks && !taskError ? tasks.map((task) => (
            <article key={task.id} className="glass-panel-strong rounded-2xl p-4 md:p-5 video-task-item">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 xl:gap-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {renderTaskStatus(task.status)}
                    <span className="text-[11px] text-[var(--text-muted)]">{taskTimeFormatter.format(task.createdAt)}</span>
                  </div>

                  <div className="video-task-player">
                    {task.status === 'completed' && task.videoUrl ? (
                      <video src={task.videoUrl} controls playsInline className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)] gap-2">
                        <i className={`fas ${task.status === 'failed' ? 'fa-triangle-exclamation' : 'fa-spinner fa-spin'} text-lg`}></i>
                        <p className="text-xs">{task.status === 'failed' ? task.errorMessage || '任务执行失败' : '视频生成中...'}</p>
                      </div>
                    )}
                  </div>

                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed break-words">{task.prompt}</p>
                </div>

                <div className="panel-subtle rounded-2xl p-4 space-y-3 border border-[rgba(125,112,104,0.22)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="muted-label">Input 参数</p>
                    <button
                      type="button"
                      onClick={() => handleReuseTaskConfig(task)}
                      className="ghost-button focus-ring h-8 px-3 text-[11px] font-semibold"
                    >
                      <i className="fas fa-rotate-left mr-1"></i>
                      复用
                    </button>
                  </div>

                  <div className="space-y-2 text-[12px] text-[var(--text-secondary)]">
                    <div className="flex justify-between gap-2">
                      <span>模型</span>
                      <span className="font-semibold text-[var(--text-primary)]">{getModelName(task.modelCode)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>分辨率 / 时长</span>
                      <span className="font-semibold text-[var(--text-primary)]">{task.resolution} · {task.duration}s</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>首帧</span>
                      <span className="font-semibold text-[var(--text-primary)] truncate max-w-[170px]">{task.startFrameName || '未设置'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>尾帧</span>
                      <span className="font-semibold text-[var(--text-primary)] truncate max-w-[170px]">{task.endFrameName || '未设置'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>音频</span>
                      <span className="font-semibold text-[var(--text-primary)] truncate max-w-[170px]">{task.audioName || '未设置'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )) : null}
        </div>
      </section>

      <section className="order-2 xl:order-1 video-composer-inline">
        <div className="rounded-[30px] p-4 md:p-5 video-floating-bar">
          <div className="video-control-row" ref={settingsRef}>
            <div className="video-control-cell">
              <button
                type="button"
                onClick={() => {
                  setIsModelMenuOpen((prev) => !prev);
                  setIsSettingsOpen(false);
                }}
                className="video-model-chip focus-ring"
                aria-expanded={isModelMenuOpen}
                aria-haspopup="listbox"
              >
                <i className="fas fa-globe"></i>
                {selectedModel.name}
                <i className={`fas ${isModelMenuOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
              </button>

              {isModelMenuOpen && (
                <div className="video-model-popover" role="listbox" aria-label="视频模型">
                  {videoModels.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => {
                        setModelCode(option.code);
                        setIsModelMenuOpen(false);
                      }}
                      className={`video-model-option focus-ring ${modelCode === option.code ? 'active' : ''}`}
                      role="option"
                      aria-selected={modelCode === option.code}
                    >
                      <span className="video-model-option-title">{option.name}</span>
                      <span className="video-model-option-subtitle">{option.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="video-control-cell">
              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen((prev) => !prev);
                  setIsModelMenuOpen(false);
                }}
                className="video-params-chip focus-ring"
                aria-expanded={isSettingsOpen}
                aria-haspopup="dialog"
              >
                <span>{resolution}</span>
                <span className="opacity-60">|</span>
                <span>{duration}s</span>
                <i className="fas fa-sliders text-[11px]"></i>
              </button>

              {isSettingsOpen && (
                <div className="video-params-popover" role="dialog" aria-label="视频生成参数">
                  <p className="text-lg text-[var(--text-primary)] mb-4">Setting</p>

                  <div className="segment-control mb-4">
                    {(['1080P', '720P', '480P'] as VideoResolution[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setResolution(option)}
                        className={`segment-btn focus-ring ${resolution === option ? 'active' : ''}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <div className="segment-control">
                    {([5, 10, 15] as VideoDuration[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setDuration(option)}
                        className={`segment-btn focus-ring ${duration === option ? 'active' : ''}`}
                      >
                        {option}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="video-prompt-input"
              placeholder="Describe the action and atmosphere..."
            />
          </div>

          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={startFrameInputRef}
            onChange={(e) => setStartFrameFile(e.target.files?.[0] || null)}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={endFrameInputRef}
            onChange={(e) => setEndFrameFile(e.target.files?.[0] || null)}
          />
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            ref={audioInputRef}
            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
          />

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
              {renderFileButton('首帧', 'fa-image', startFrameFile, () => startFrameInputRef.current?.click(), false, '必填：静态起始画面', startFramePreviewUrl, true)}
              <button
                type="button"
                onClick={handleSwapFrames}
                className="video-swap-button focus-ring"
                title="互换首尾帧"
                aria-label="互换首尾帧"
              >
                <i className="fas fa-right-left"></i>
              </button>
              {renderFileButton('尾帧', 'fa-images', endFrameFile, () => endFrameInputRef.current?.click(), false, '可选：静态结束画面', endFramePreviewUrl, true)}
            </div>

            <div className="space-y-2">
              <label className="muted-label">音频</label>
              <div
                onClick={() => {
                  if (!audioFile && supportsAudio) {
                    audioInputRef.current?.click();
                  }
                }}
                className={`upload-zone p-4 flex flex-col items-center justify-center text-center gap-2 ${
                  audioFile ? 'is-filled' : ''
                } ${!supportsAudio ? 'disabled' : ''}`}
              >
                {!audioFile ? (
                  <>
                    <div className="w-10 h-10 rounded-xl panel-subtle flex items-center justify-center text-[var(--accent-ink)]">
                      <i className="fas fa-music"></i>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {supportsAudio ? '可选：上传音频并裁剪后用于视频生成' : '当前模型不支持音频'}
                    </p>
                  </>
                ) : (
                  <div className="w-full space-y-3 text-left">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="pill success">
                        <i className="fas fa-check"></i>
                        音频参考已就绪
                      </span>
                      <button
                        type="button"
                        onClick={handleResetAudio}
                        className="ghost-button focus-ring h-8 px-3 text-xs font-semibold"
                      >
                        更换音频
                      </button>
                    </div>

                    {audioFile && audioPreviewUrl ? (
                      <AudioWaveformEditor
                        key={`${audioFile.name}-${audioFile.lastModified}`}
                        file={audioFile}
                        audioUrl={audioPreviewUrl}
                        disabled={isGenerating}
                        accent="voice"
                        onTrimChange={(start, end, totalDuration) => {
                          setAudioTrim({ start, end, duration: totalDuration });
                        }}
                      />
                    ) : null}
                  </div>
                )}
              </div>
              <p className="video-upload-name">
                {audioFile
                  ? audioFile.name
                  : supportsAudio
                    ? '可选：对口型或节奏参考'
                    : '当前模型不支持音频'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => void handleCreateTask()}
              disabled={!prompt.trim() || !startFrameFile || isGenerating}
              className="video-submit-button focus-ring w-full"
            >
              <i className={`fas ${isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic'}`}></i>
              <span>{isGenerating ? '生成中...' : '提交视频任务'}</span>
            </button>
            {submitError ? (
              <p className="text-center text-[11px] text-[#b1625b] mt-2">{submitError}</p>
            ) : null}
            <p className="text-center text-[11px] text-[var(--text-muted)] mt-2">
              <i className="fas fa-coins text-[var(--accent-gold)] mr-1"></i>
              每次任务消耗 {currentCredits} 积分
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default VideoStudio;
