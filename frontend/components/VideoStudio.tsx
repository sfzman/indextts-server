import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFileBlob, getFileUrl, uploadMediaFile } from '../services/fileService';
import AudioWaveformEditor from './AudioWaveformEditor';
import { trimAudioFile } from '../services/audioUtils';
import {
  createVideoTask,
  getVideoModels,
  getVideoTasks,
  type VideoModelOption,
  type VideoTaskItemResponse
} from '../services/videoService';

type VideoResolution = '480P' | '720P' | '768P' | '1080P';
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
  startFrameFileID?: string;
  endFrameFileID?: string;
  audioFileID?: string;
  startFrameUrl?: string;
  endFrameUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  createdAt: number;
  errorMessage?: string;
}

const DEFAULT_VIDEO_MODELS: VideoModelOption[] = [
  {
    name: 'Wan 2.6',
    code: 'wan2.6-i2v',
    description: '万相2.6。新增多镜头叙事能力，同时支持自动配音和传入自定义音频文件。',
    provider: 'wan',
    credits: 20,
    supports_text_only: false,
    supports_first_frame: true,
    supports_end_frame: false,
    supports_audio: true,
    resolutions: ['480P', '720P', '1080P'],
    duration_options_by_resolution: {
      '480P': [5, 10, 15],
      '720P': [5, 10, 15],
      '1080P': [5, 10, 15],
    },
  },
  {
    name: 'Wan 2.6 Flash',
    code: 'wan2.6-i2v-flash',
    description:
      '万相2.6-图生视频-Flash，生成更快更高性价比。智能分镜调度支持多镜头叙事，多人稳定对话，更自然真实音色，最高支持15秒时长生成',
    provider: 'wan',
    credits: 20,
    supports_text_only: false,
    supports_first_frame: true,
    supports_end_frame: false,
    supports_audio: true,
    resolutions: ['480P', '720P', '1080P'],
    duration_options_by_resolution: {
      '480P': [5, 10, 15],
      '720P': [5, 10, 15],
      '1080P': [5, 10, 15],
    },
  },
  {
    name: 'Wan 2.5',
    code: 'wan2.5-i2v-preview',
    description: '万相2.5。图生视频预览版。',
    provider: 'wan',
    credits: 15,
    supports_text_only: false,
    supports_first_frame: true,
    supports_end_frame: false,
    supports_audio: true,
    resolutions: ['480P', '720P', '1080P'],
    duration_options_by_resolution: {
      '480P': [5, 10, 15],
      '720P': [5, 10, 15],
      '1080P': [5, 10, 15],
    },
  },
  {
    name: 'Hailuo 2.3',
    code: 'hailuo-2.3',
    description: '海螺 2.3。支持文生视频与图生视频，不支持音频和尾帧输入。',
    provider: 'hailuo',
    credits: 20,
    supports_text_only: true,
    supports_first_frame: true,
    supports_end_frame: false,
    supports_audio: false,
    resolutions: ['768P', '1080P'],
    duration_options_by_resolution: {
      '768P': [6, 10],
      '1080P': [6],
    },
  },
];

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
  const [reusingTaskID, setReusingTaskID] = useState<string | null>(null);

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

  const availableResolutions = useMemo(
    () => (selectedModel?.resolutions?.length ? selectedModel.resolutions : ['720P']) as VideoResolution[],
    [selectedModel]
  );

  const availableDurations = useMemo(() => {
    const durationOptions = selectedModel?.duration_options_by_resolution?.[resolution];
    if (Array.isArray(durationOptions) && durationOptions.length > 0) {
      return durationOptions as VideoDuration[];
    }

    const fallbackResolution = availableResolutions[0];
    const fallbackOptions = selectedModel?.duration_options_by_resolution?.[fallbackResolution];
    if (Array.isArray(fallbackOptions) && fallbackOptions.length > 0) {
      return fallbackOptions as VideoDuration[];
    }

    return [5] as VideoDuration[];
  }, [availableResolutions, resolution, selectedModel]);

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
    const resolveMediaUrl = async (
      explicitUrl: string | undefined,
      fileID: string | undefined
    ): Promise<string | undefined> => {
      if (explicitUrl && explicitUrl.trim()) {
        return explicitUrl.trim();
      }
      if (!fileID || !fileID.trim()) {
        return undefined;
      }
      try {
        const file = await getFileUrl(fileID.trim(), 3600);
        return file.url;
      } catch {
        return undefined;
      }
    };

    const startFrameFileID = item.image_file_id || getMetaString(item.meta, 'image_file_id');
    const endFrameFileID = item.end_frame_file_id || getMetaString(item.meta, 'end_frame_file_id');
    const audioFileID = item.audio_file_id || getMetaString(item.meta, 'audio_file_id');

    const [videoUrl, startFrameUrl, endFrameUrl, audioUrl] = await Promise.all([
      item.status === 'completed' && item.result_video_file_id
        ? resolveMediaUrl(undefined, item.result_video_file_id)
        : Promise.resolve(undefined),
      resolveMediaUrl(item.image_url || getMetaString(item.meta, 'image_url'), startFrameFileID),
      resolveMediaUrl(getMetaString(item.meta, 'end_frame_url'), endFrameFileID),
      resolveMediaUrl(item.audio_url || getMetaString(item.meta, 'audio_url'), audioFileID),
    ]);

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
      startFrameName: getMetaString(item.meta, 'image_filename') || startFrameFileID || extractFilename(item.image_url),
      endFrameName: getMetaString(item.meta, 'end_frame_filename') || endFrameFileID || undefined,
      audioName: getMetaString(item.meta, 'audio_filename') || audioFileID || extractFilename(item.audio_url),
      startFrameFileID,
      endFrameFileID,
      audioFileID,
      startFrameUrl,
      endFrameUrl,
      audioUrl,
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
    if (availableResolutions.length > 0 && !availableResolutions.includes(resolution)) {
      setResolution(availableResolutions[0]);
    }
  }, [availableResolutions, resolution]);

  useEffect(() => {
    if (availableDurations.length > 0 && !availableDurations.includes(duration)) {
      setDuration(availableDurations[0]);
    }
  }, [availableDurations, duration]);

  useEffect(() => {
    if (!selectedModel.supports_audio && audioFile) {
      setAudioFile(null);
      setAudioTrim({ start: 0, end: 0, duration: 0 });
    }
  }, [selectedModel.supports_audio, audioFile]);

  useEffect(() => {
    if (!selectedModel.supports_end_frame && endFrameFile) {
      setEndFrameFile(null);
    }
  }, [selectedModel.supports_end_frame, endFrameFile]);

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

  const currentCredits = useMemo(() => selectedModel.credits ?? 20, [selectedModel.credits]);
  const supportsAudio = useMemo(() => selectedModel.supports_audio, [selectedModel.supports_audio]);
  const supportsEndFrame = useMemo(() => selectedModel.supports_end_frame, [selectedModel.supports_end_frame]);
  const requiresFirstFrame = useMemo(
    () => selectedModel.supports_first_frame && !selectedModel.supports_text_only,
    [selectedModel.supports_first_frame, selectedModel.supports_text_only]
  );
  const disabledEndFrameReason = useMemo(
    () => (supportsEndFrame ? undefined : '当前模型不支持尾帧输入'),
    [supportsEndFrame]
  );
  const disabledAudioReason = useMemo(
    () => (supportsAudio ? undefined : '当前模型不支持音频输入'),
    [supportsAudio]
  );

  const handleCreateTask = async () => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt || isGenerating) {
      return;
    }
    if (requiresFirstFrame && !startFrameFile) {
      setSubmitError('请先上传首帧图片');
      return;
    }

    setSubmitError(null);
    setIsGenerating(true);
    setIsSettingsOpen(false);
    setIsModelMenuOpen(false);

    try {
      const imageUpload = startFrameFile ? await uploadMediaFile(startFrameFile) : null;
      const endFrameUpload = supportsEndFrame && endFrameFile ? await uploadMediaFile(endFrameFile) : null;
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
        image_file_id: imageUpload?.id,
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

  const handleReuseTaskConfig = async (task: VideoTask) => {
    const fileFromTaskSource = async (
      fileID: string | undefined,
      url: string | undefined,
      filename: string | undefined,
      fallbackPrefix: string
    ): Promise<File | null> => {
      if (!fileID && !url) {
        return null;
      }

      let blob: Blob;
      if (fileID) {
        blob = await getFileBlob(fileID);
      } else if (url) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`获取素材失败: ${response.status}`);
        }
        blob = await response.blob();
      } else {
        return null;
      }

      const baseName = filename || extractFilename(url) || `${fallbackPrefix}-${Date.now()}`;
      const guessedExt = blob.type.includes('/') ? blob.type.split('/')[1] : 'bin';
      const normalizedName = baseName.includes('.') ? baseName : `${baseName}.${guessedExt}`;
      return new File([blob], normalizedName, { type: blob.type || undefined });
    };

    setPrompt(task.prompt);
    setModelCode(task.modelCode);
    setResolution(task.resolution);
    setDuration(task.duration);
    setIsSettingsOpen(false);
    setIsModelMenuOpen(false);

    setSubmitError(null);
    setReusingTaskID(task.id);

    try {
      const startFrame = await fileFromTaskSource(
        task.startFrameFileID,
        task.startFrameUrl,
        task.startFrameName,
        'start-frame'
      );
      if (!startFrame) {
        throw new Error('无法复用首帧素材');
      }

      const [endFrame, audio] = await Promise.all([
        fileFromTaskSource(task.endFrameFileID, task.endFrameUrl, task.endFrameName, 'end-frame'),
        fileFromTaskSource(task.audioFileID, task.audioUrl, task.audioName, 'audio'),
      ]);

      setStartFrameFile(startFrame);
      setEndFrameFile(endFrame);
      setAudioFile(audio);
      setAudioTrim({ start: 0, end: 0, duration: 0 });
    } catch (error) {
      const message = error instanceof Error ? error.message : '复用任务素材失败';
      setSubmitError(message);
    } finally {
      setReusingTaskID(null);
    }
  };

  const handleSwapFrames = () => {
    setStartFrameFile(endFrameFile);
    setEndFrameFile(startFrameFile);
  };

  const handleClearStartFrame = (event: React.MouseEvent) => {
    event.stopPropagation();
    setStartFrameFile(null);
    if (startFrameInputRef.current) {
      startFrameInputRef.current.value = '';
    }
  };

  const handleClearEndFrame = (event: React.MouseEvent) => {
    event.stopPropagation();
    setEndFrameFile(null);
    if (endFrameInputRef.current) {
      endFrameInputRef.current.value = '';
    }
  };

  const handleReplaceAudio = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (supportsAudio) {
      audioInputRef.current?.click();
    }
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
    blockedReason?: string,
    helperText?: string,
    previewUrl?: string | null,
    asImageTile?: boolean,
    onClear?: (event: React.MouseEvent) => void
  ) => {
    const isBlocked = Boolean(blockedReason);

    return (
    <div className={`space-y-1.5 ${asImageTile ? 'video-image-upload-outer' : ''}`} title={blockedReason}>
      <div className={`video-upload-tile-wrap group ${asImageTile ? 'video-image-upload-wrap' : ''}`}>
        <button
          type="button"
          onClick={() => {
            if (!isBlocked) {
              onClick();
            }
          }}
          aria-disabled={isBlocked}
          className={asImageTile
            ? `video-image-upload-tile focus-ring ${previewUrl ? 'has-preview' : ''} ${isBlocked ? 'disabled' : ''}`
            : `video-upload-chip focus-ring ${previewUrl ? 'has-preview' : ''} ${isBlocked ? 'disabled' : ''}`}
          title={blockedReason}
        >
          {asImageTile ? (
            previewUrl ? (
              <>
                <img
                  src={previewUrl}
                  alt={`${label}预览`}
                  className="video-image-upload-tile-image"
                />
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
        {file && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="video-upload-clear-button ghost-button focus-ring h-8 w-8 text-[11px] opacity-70 group-hover:opacity-100 text-[var(--error)]"
            title={`删除${label}`}
            aria-label={`删除${label}`}
          >
            <i className="fas fa-trash-can"></i>
          </button>
        ) : null}
      </div>
      <p className="video-upload-name">{file ? file.name : blockedReason || helperText || '未选择文件'}</p>
    </div>
    );
  };

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
                      <div className="video-task-player-status">
                        <i className={`fas ${task.status === 'failed' ? 'fa-triangle-exclamation' : 'fa-spinner fa-spin'} text-lg`}></i>
                        <p className="text-xs">{task.status === 'failed' ? task.errorMessage || '任务执行失败' : '视频生成中...'}</p>
                      </div>
                    )}
                  </div>

                </div>

                <div className="panel-subtle rounded-2xl p-4 space-y-3 border border-[rgba(125,112,104,0.22)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="muted-label">Input 参数</p>
                    <button
                      type="button"
                      onClick={() => void handleReuseTaskConfig(task)}
                      disabled={reusingTaskID === task.id}
                      className="ghost-button focus-ring h-8 px-3 text-[11px] font-semibold"
                    >
                      <i className={`fas ${reusingTaskID === task.id ? 'fa-spinner fa-spin' : 'fa-rotate-left'} mr-1`}></i>
                      {reusingTaskID === task.id ? '复用中...' : '复用'}
                    </button>
                  </div>

                  <div className="space-y-3 text-[12px] text-[var(--text-secondary)]">
                    <div className="video-task-meta-tags">
                      <span className="video-task-meta-tag">{getModelName(task.modelCode)}</span>
                      <span className="video-task-meta-tag">{task.resolution}</span>
                      <span className="video-task-meta-tag">{task.duration}s</span>
                    </div>

                    <div className="video-task-prompt-block">
                      <p className="video-task-prompt-text">{task.prompt}</p>
                    </div>

                    <div className={`video-task-input-grid ${task.endFrameName || task.endFrameUrl ? '' : 'single'}`}>
                      <div className="video-task-media-card">
                        <span className="video-task-media-label">首帧</span>
                        <div className="video-task-media-preview">
                          {task.startFrameUrl ? (
                            <img src={task.startFrameUrl} alt={task.startFrameName || '首帧预览'} className="video-task-media-image" />
                          ) : (
                            <span className="video-task-media-empty">未设置</span>
                          )}
                        </div>
                      </div>
                      {task.endFrameName || task.endFrameUrl ? (
                        <div className="video-task-media-card">
                          <span className="video-task-media-label">尾帧</span>
                          <div className="video-task-media-preview">
                            {task.endFrameUrl ? (
                              <img src={task.endFrameUrl} alt={task.endFrameName || '尾帧预览'} className="video-task-media-image" />
                            ) : (
                              <span className="video-task-media-empty">暂无预览</span>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="video-task-audio-row">
                      <span className="video-task-media-label">音频</span>
                      {task.audioUrl ? (
                        <audio controls preload="none" src={task.audioUrl} className="video-task-audio-player" />
                      ) : (
                        <span className="video-task-media-empty">未设置</span>
                      )}
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
                    {availableResolutions.map((option) => (
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
                    {availableDurations.map((option) => (
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
            <div className="video-frame-upload-grid grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
              {renderFileButton(
                '首帧',
                'fa-image',
                startFrameFile,
                () => startFrameInputRef.current?.click(),
                undefined,
                requiresFirstFrame ? '必填：静态起始画面' : '可选：不上传则走文生视频',
                startFramePreviewUrl,
                true,
                handleClearStartFrame
              )}
              <button
                type="button"
                onClick={() => {
                  if (supportsEndFrame) {
                    handleSwapFrames();
                  }
                }}
                className={`video-swap-button focus-ring ${supportsEndFrame ? '' : 'disabled'}`}
                title={supportsEndFrame ? '互换首尾帧' : disabledEndFrameReason}
                aria-label={supportsEndFrame ? '互换首尾帧' : disabledEndFrameReason}
              >
                <i className="fas fa-right-left"></i>
              </button>
              {renderFileButton(
                '尾帧',
                'fa-images',
                endFrameFile,
                () => endFrameInputRef.current?.click(),
                disabledEndFrameReason,
                '可选：静态结束画面',
                endFramePreviewUrl,
                true,
                handleClearEndFrame
              )}
            </div>

            <div className="space-y-2">
              <label className="muted-label">音频</label>
              <div
                title={disabledAudioReason}
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
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleReplaceAudio}
                          className="ghost-button focus-ring h-8 px-3 text-xs font-semibold"
                        >
                          更换音频
                        </button>
                        <button
                          type="button"
                          onClick={handleResetAudio}
                          className="ghost-button focus-ring h-8 w-8 text-[11px] opacity-70 hover:opacity-100 text-[var(--error)]"
                          title="删除音频"
                          aria-label="删除音频"
                        >
                          <i className="fas fa-trash-can"></i>
                        </button>
                      </div>
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
                    : '当前模型不支持音频输入'}
              </p>
            </div>
          </div>

          <div className="mt-4">
              <button
                type="button"
                onClick={() => void handleCreateTask()}
              disabled={!prompt.trim() || (requiresFirstFrame && !startFrameFile) || isGenerating}
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
