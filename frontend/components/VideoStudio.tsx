import React, { useEffect, useMemo, useRef, useState } from 'react';

type VideoResolution = '720P' | '1080P';
type VideoDuration = 5 | 10 | 15;
type VideoTaskStatus = 'processing' | 'completed' | 'failed';
type VideoModel = 'Wan 2.6' | 'Wan 2.5';

interface VideoTask {
  id: string;
  status: VideoTaskStatus;
  prompt: string;
  model: VideoModel;
  resolution: VideoResolution;
  duration: VideoDuration;
  startFrameName?: string;
  endFrameName?: string;
  audioName?: string;
  videoUrl?: string;
  createdAt: number;
  errorMessage?: string;
}

const DEMO_VIDEO_URLS = [
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'https://www.w3schools.com/html/mov_bbb.mp4',
];

const MODEL_CAPABILITY: Record<VideoModel, { supportsAudio: boolean; credits: number }> = {
  'Wan 2.6': { supportsAudio: true, credits: 20 },
  'Wan 2.5': { supportsAudio: false, credits: 15 },
};

const DEFAULT_TASKS: VideoTask[] = [
  {
    id: 'video-task-001',
    status: 'completed',
    prompt: '定场镜头，二次元风格，女生对镜头轻声说话，然后微笑。',
    model: 'Wan 2.5',
    resolution: '720P',
    duration: 5,
    startFrameName: 'cover_start.png',
    endFrameName: 'cover_end.png',
    createdAt: Date.now() - 1000 * 60 * 18,
    videoUrl: DEMO_VIDEO_URLS[0],
  },
  {
    id: 'video-task-002',
    status: 'processing',
    prompt: '室内近景，角色从左向右转头，发丝轻微摆动，电影感光影。',
    model: 'Wan 2.6',
    resolution: '1080P',
    duration: 10,
    startFrameName: 'portrait_begin.jpg',
    createdAt: Date.now() - 1000 * 60 * 7,
  },
];

const taskTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const VideoStudio: React.FC = () => {
  const [tasks, setTasks] = useState<VideoTask[]>(DEFAULT_TASKS);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<VideoModel>('Wan 2.6');
  const [resolution, setResolution] = useState<VideoResolution>('720P');
  const [duration, setDuration] = useState<VideoDuration>(5);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [startFrameFile, setStartFrameFile] = useState<File | null>(null);
  const [endFrameFile, setEndFrameFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const startFrameInputRef = useRef<HTMLInputElement>(null);
  const endFrameInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const simulationTimerRef = useRef<number | null>(null);

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
    return () => {
      if (simulationTimerRef.current) {
        window.clearTimeout(simulationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!MODEL_CAPABILITY[model].supportsAudio && audioFile) {
      setAudioFile(null);
    }
  }, [model, audioFile]);

  const currentCredits = useMemo(() => MODEL_CAPABILITY[model].credits, [model]);
  const supportsAudio = useMemo(() => MODEL_CAPABILITY[model].supportsAudio, [model]);

  const handleCreateTask = () => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setIsSettingsOpen(false);
    setIsModelMenuOpen(false);

    const taskId = `video-task-${Date.now()}`;
    const pendingTask: VideoTask = {
      id: taskId,
      status: 'processing',
      prompt: normalizedPrompt,
      model,
      resolution,
      duration,
      startFrameName: startFrameFile?.name,
      endFrameName: endFrameFile?.name,
      audioName: audioFile?.name,
      createdAt: Date.now(),
    };

    setTasks((prev) => [pendingTask, ...prev]);
    setPrompt('');

    simulationTimerRef.current = window.setTimeout(() => {
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const nextUrl = DEMO_VIDEO_URLS[Math.floor(Math.random() * DEMO_VIDEO_URLS.length)];
          return {
            ...task,
            status: 'completed',
            videoUrl: nextUrl,
          };
        })
      );
      setIsGenerating(false);
    }, 2500);
  };

  const handleReuseTaskConfig = (task: VideoTask) => {
    setPrompt(task.prompt);
    setModel(task.model);
    setResolution(task.resolution);
    setDuration(task.duration);
    setIsSettingsOpen(false);
    setIsModelMenuOpen(false);
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
    helperText?: string
  ) => (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="video-upload-chip focus-ring"
      >
        <i className={`fas ${iconClass}`}></i>
        <span>{label}</span>
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
          {tasks.map((task) => (
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
                      <span className="font-semibold text-[var(--text-primary)]">{task.model}</span>
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
          ))}
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
                {model}
                <i className={`fas ${isModelMenuOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
              </button>

              {isModelMenuOpen && (
                <div className="video-model-popover" role="listbox" aria-label="视频模型">
                  {(['Wan 2.6', 'Wan 2.5'] as VideoModel[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setModel(option);
                        setIsModelMenuOpen(false);
                      }}
                      className={`video-model-option focus-ring ${model === option ? 'active' : ''}`}
                      role="option"
                      aria-selected={model === option}
                    >
                      <span>{option}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {MODEL_CAPABILITY[option].supportsAudio ? '支持音频' : '无音频'}
                      </span>
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
                    {(['1080P', '720P'] as VideoResolution[]).map((option) => (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {renderFileButton('首帧', 'fa-image', startFrameFile, () => startFrameInputRef.current?.click(), false, '可选：静态起始画面')}
              {renderFileButton('尾帧', 'fa-images', endFrameFile, () => endFrameInputRef.current?.click(), false, '可选：静态结束画面')}
            </div>
            <div>
              {renderFileButton(
                '音频',
                'fa-music',
                audioFile,
                () => audioInputRef.current?.click(),
                !supportsAudio,
                supportsAudio ? '可选：对口型或节奏参考' : '当前模型不支持音频'
              )}
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleCreateTask}
              disabled={!prompt.trim() || isGenerating}
              className="video-submit-button focus-ring w-full"
            >
              <i className={`fas ${isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic'}`}></i>
              <span>{isGenerating ? '生成中...' : '提交视频任务'}</span>
            </button>
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
