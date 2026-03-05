import React, { useState, useEffect } from 'react';
import { CloneTask, EmotionMode } from '../types';
import { getAudioBlobUrl } from '../services/fileService';

interface TaskListProps {
  tasks: CloneTask[];
  onDeleteTask: (id: string) => Promise<void> | void;
  onClearAll: () => Promise<void> | void;
  onAddFavorite?: (category: 'voice' | 'emotion', audioUrl: string, nameHint: string) => Promise<void> | void;
}

const TASKS_PER_PAGE = 4;

const emotionModeLabels: Record<EmotionMode, string> = {
  same_as_reference: '保持原味',
  emotion_prompt: '模仿参考',
  emotion_vector: '精细调节',
  emotion_text: '文本自动情感',
};

const emotionVectorLabels = ['喜悦', '愤怒', '哀伤', '恐惧', '厌恶', '低落', '惊喜', '平静'];

const TaskList: React.FC<TaskListProps> = ({ tasks, onDeleteTask, onClearAll, onAddFavorite }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [referenceAudioUrls, setReferenceAudioUrls] = useState<Record<string, string>>({});
  const [emotionAudioUrls, setEmotionAudioUrls] = useState<Record<string, string>>({});
  const [loadingDetailMap, setLoadingDetailMap] = useState<Record<string, boolean>>({});
  const [detailErrorMap, setDetailErrorMap] = useState<Record<string, string>>({});

  const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [tasks.length, totalPages, currentPage]);

  const currentTasks = tasks.slice((currentPage - 1) * TASKS_PER_PAGE, currentPage * TASKS_PER_PAGE);

  if (tasks.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-center gap-4 py-10 text-[var(--text-muted)]">
        <div className="w-16 h-16 rounded-2xl panel-subtle flex items-center justify-center">
          <i className="fas fa-clock-rotate-left text-xl"></i>
        </div>
        <p className="text-xs tracking-[0.16em] uppercase">暂无历史任务</p>
      </div>
    );
  }

  const handleClear = () => {
    void onClearAll();
  };

  const ensureDetailAudioLoaded = async (task: CloneTask) => {
    if (loadingDetailMap[task.id]) {
      return;
    }

    const needReference = task.referenceAudioFileId && !referenceAudioUrls[task.id];
    const needEmotionPrompt = task.emotionMode === 'emotion_prompt' && task.emotionPromptFileId && !emotionAudioUrls[task.id];

    if (!needReference && !needEmotionPrompt) {
      return;
    }

    setLoadingDetailMap((prev) => ({ ...prev, [task.id]: true }));
    setDetailErrorMap((prev) => ({ ...prev, [task.id]: '' }));

    try {
      if (needReference && task.referenceAudioFileId) {
        const referenceUrl = await getAudioBlobUrl(task.referenceAudioFileId);
        setReferenceAudioUrls((prev) => ({ ...prev, [task.id]: referenceUrl }));
      }

      if (needEmotionPrompt && task.emotionPromptFileId) {
        const emotionUrl = await getAudioBlobUrl(task.emotionPromptFileId);
        setEmotionAudioUrls((prev) => ({ ...prev, [task.id]: emotionUrl }));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载详情音频失败';
      setDetailErrorMap((prev) => ({ ...prev, [task.id]: message }));
    } finally {
      setLoadingDetailMap((prev) => ({ ...prev, [task.id]: false }));
    }
  };

  const toggleDetails = async (task: CloneTask) => {
    const isExpanded = expandedTaskIds.has(task.id);

    if (isExpanded) {
      setExpandedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      return;
    }

    setExpandedTaskIds((prev) => new Set(prev).add(task.id));
    await ensureDetailAudioLoaded(task);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="muted-label">历史记录（{tasks.length}）</span>
        <button onClick={handleClear} className="ghost-button focus-ring h-8 px-3 text-[11px] font-semibold">
          <i className="fas fa-trash-can mr-1.5"></i>
          清空
        </button>
      </div>

      <div className="flex-grow pr-1 overflow-y-auto custom-scrollbar space-y-3">
        {currentTasks.map((task) => {
          const isExpanded = expandedTaskIds.has(task.id);
          const taskReferenceAudio = referenceAudioUrls[task.id];
          const taskEmotionAudio = emotionAudioUrls[task.id];
          const detailError = detailErrorMap[task.id];
          const isLoadingDetails = loadingDetailMap[task.id];

          return (
            <div key={task.id} className="glass-panel-strong rounded-2xl p-4 border border-[rgba(125,112,104,0.2)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {task.status === 'processing' && <span className="pill warning">处理中</span>}
                    {task.status === 'completed' && <span className="pill success">已完成</span>}
                    {task.status === 'failed' && <span className="pill error">失败</span>}
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium">任务 ID: {task.id.slice(0, 8)}</p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggleDetails(task)} className="secondary-button focus-ring h-8 px-3 text-[11px] font-semibold">
                    {isExpanded ? '收起' : '详情'}
                  </button>
                  <button
                    onClick={() => {
                      void onDeleteTask(task.id);
                    }}
                    className="ghost-button focus-ring h-8 w-8 text-[11px]"
                    title="删除任务"
                  >
                    <i className="fas fa-xmark"></i>
                  </button>
                </div>
              </div>

              {task.status === 'completed' && task.audioUrl && (
                <div className="audio-surface mt-3 flex items-center gap-2">
                  <audio src={task.audioUrl} controls className="h-9 flex-grow" />
                  <a
                    href={task.audioUrl}
                    download={`vox_clone_${task.id}.wav`}
                    className="secondary-button focus-ring h-9 w-9 flex items-center justify-center"
                    title="下载"
                  >
                    <i className="fas fa-download text-xs"></i>
                  </a>
                </div>
              )}

              {task.status === 'failed' && (
                <p className="mt-2 text-[12px] text-[var(--error)]">错误：{task.errorMessage}</p>
              )}

              {isExpanded && (
                <div className="mt-3 pt-3 border-t soft-divider space-y-3">
                  <div>
                    <p className="muted-label mb-1">文本脚本</p>
                    <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-words">{task.script}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="panel-subtle rounded-xl p-2.5">
                      <p className="muted-label mb-1">情感模式</p>
                      <p className="text-[13px] text-[var(--text-primary)] font-semibold">
                        {emotionModeLabels[task.emotionMode] || task.emotionMode}
                      </p>
                    </div>

                    {typeof task.emotionAlpha === 'number' && (
                      <div className="panel-subtle rounded-xl p-2.5">
                        <p className="muted-label mb-1">情感强度</p>
                        <p className="text-[13px] text-[var(--text-primary)] font-semibold">{task.emotionAlpha.toFixed(2)}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="muted-label">音色参考音频</p>
                      {taskReferenceAudio && onAddFavorite && (
                        <button
                          onClick={() => {
                            void onAddFavorite('voice', taskReferenceAudio, `任务${task.id.slice(0, 6)}音色`);
                          }}
                          className="ghost-button focus-ring h-7 px-2.5 text-[11px] font-semibold"
                        >
                          <i className="fas fa-bookmark mr-1"></i>
                          收藏
                        </button>
                      )}
                    </div>
                    {taskReferenceAudio ? (
                      <div className="audio-surface">
                        <audio src={taskReferenceAudio} controls className="h-8" />
                      </div>
                    ) : (
                      <p className="text-[12px] text-[var(--text-muted)]">{isLoadingDetails ? '加载中...' : '暂无可播放音频'}</p>
                    )}
                  </div>

                  {task.emotionMode === 'emotion_prompt' && (
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="muted-label">情感参考音频</p>
                        {taskEmotionAudio && onAddFavorite && (
                          <button
                            onClick={() => {
                              void onAddFavorite('emotion', taskEmotionAudio, `任务${task.id.slice(0, 6)}情感`);
                            }}
                            className="ghost-button focus-ring h-7 px-2.5 text-[11px] font-semibold"
                          >
                            <i className="fas fa-bookmark mr-1"></i>
                            收藏
                          </button>
                        )}
                      </div>
                      {taskEmotionAudio ? (
                        <div className="audio-surface">
                          <audio src={taskEmotionAudio} controls className="h-8" />
                        </div>
                      ) : (
                        <p className="text-[12px] text-[var(--text-muted)]">{isLoadingDetails ? '加载中...' : '暂无可播放音频'}</p>
                      )}
                    </div>
                  )}

                  {task.emotionMode === 'emotion_vector' && (
                    <div>
                      <p className="muted-label mb-2">向量维度</p>
                      {task.emotionVector && task.emotionVector.length === 8 ? (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {task.emotionVector.map((value, index) => (
                            <p key={`${task.id}-${index}`} className="text-[12px] text-[var(--text-secondary)]">
                              {emotionVectorLabels[index]}: {value.toFixed(2)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-[var(--text-muted)]">未保存向量数据</p>
                      )}
                    </div>
                  )}

                  {detailError && <p className="text-[12px] text-[var(--error)]">详情加载失败：{detailError}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 pt-4 border-t soft-divider flex items-center justify-center gap-3 shrink-0">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="secondary-button focus-ring h-8 w-8 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-left"></i>
          </button>

          <span className="text-xs text-[var(--text-secondary)] px-2">
            {currentPage} / {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className="secondary-button focus-ring h-8 w-8 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskList;
