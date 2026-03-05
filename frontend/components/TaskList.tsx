import React, { useState, useEffect } from 'react';
import { CloneTask, EmotionMode } from '../types';
import { getAudioBlobUrl } from '../services/fileService';

interface TaskListProps {
  tasks: CloneTask[];
  onDeleteTask: (id: string) => Promise<void> | void;
  onClearAll: () => Promise<void> | void;
}

const TASKS_PER_PAGE = 4;

const emotionModeLabels: Record<EmotionMode, string> = {
  same_as_reference: '保持原味',
  emotion_prompt: '模仿参考',
  emotion_vector: '精细调节',
  emotion_text: '文本自动情感',
};

const emotionVectorLabels = ['喜悦', '愤怒', '哀伤', '恐惧', '厌恶', '低落', '惊喜', '平静'];

const TaskList: React.FC<TaskListProps> = ({ tasks, onDeleteTask, onClearAll }) => {
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

  const currentTasks = tasks.slice(
    (currentPage - 1) * TASKS_PER_PAGE,
    currentPage * TASKS_PER_PAGE
  );

  if (tasks.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-center space-y-4 opacity-40">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
          <i className="fas fa-clipboard-list text-3xl text-gray-700"></i>
        </div>
        <p className="text-gray-500 text-xs uppercase tracking-widest">暂无生成记录</p>
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

    setLoadingDetailMap(prev => ({ ...prev, [task.id]: true }));
    setDetailErrorMap(prev => ({ ...prev, [task.id]: '' }));

    try {
      if (needReference && task.referenceAudioFileId) {
        const referenceUrl = await getAudioBlobUrl(task.referenceAudioFileId);
        setReferenceAudioUrls(prev => ({ ...prev, [task.id]: referenceUrl }));
      }

      if (needEmotionPrompt && task.emotionPromptFileId) {
        const emotionUrl = await getAudioBlobUrl(task.emotionPromptFileId);
        setEmotionAudioUrls(prev => ({ ...prev, [task.id]: emotionUrl }));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载详情音频失败';
      setDetailErrorMap(prev => ({ ...prev, [task.id]: message }));
    } finally {
      setLoadingDetailMap(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const toggleDetails = async (task: CloneTask) => {
    const isExpanded = expandedTaskIds.has(task.id);

    if (isExpanded) {
      setExpandedTaskIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      return;
    }

    setExpandedTaskIds(prev => new Set(prev).add(task.id));
    await ensureDetailAudioLoaded(task);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
          历史记录 ({tasks.length})
        </span>
        <button
          onClick={handleClear}
          className="text-[10px] font-bold text-red-500/50 hover:text-red-500 transition-colors flex items-center gap-1 uppercase tracking-widest"
        >
          <i className="fas fa-trash-alt"></i>
          清空
        </button>
      </div>

      <div className="flex-grow space-y-3 pr-1 overflow-y-auto custom-scrollbar">
        {currentTasks.map((task) => {
          const isExpanded = expandedTaskIds.has(task.id);
          const taskReferenceAudio = referenceAudioUrls[task.id];
          const taskEmotionAudio = emotionAudioUrls[task.id];
          const detailError = detailErrorMap[task.id];
          const isLoadingDetails = loadingDetailMap[task.id];

          return (
            <div key={task.id} className="glass-morphism rounded-2xl p-4 border border-white/5 bg-black/20 hover:bg-black/40 transition-all group animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {task.status === 'processing' && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] text-red-500 font-bold uppercase tracking-tight">处理中</span>
                      </div>
                    )}
                    {task.status === 'completed' && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                        <span className="text-[10px] text-green-500 font-bold uppercase tracking-tight">已完成</span>
                      </div>
                    )}
                    {task.status === 'failed' && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                        <span className="text-[10px] text-red-600 font-bold uppercase tracking-tight">失败</span>
                      </div>
                    )}
                    <span className="text-[10px] text-gray-700 font-mono">{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 font-mono tracking-wide">任务ID: {task.id.slice(0, 8)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleDetails(task)}
                    className="text-[10px] font-bold text-gray-500 hover:text-red-400 transition-colors uppercase tracking-widest"
                  >
                    {isExpanded ? '收起详情' : '详情'}
                  </button>
                  <button
                    onClick={() => { void onDeleteTask(task.id); }}
                    className="text-gray-800 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <i className="fas fa-times text-xs"></i>
                  </button>
                </div>
              </div>

              {task.status === 'completed' && task.audioUrl && (
                <div className="mt-2 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                  <audio src={task.audioUrl} controls className="h-8 flex-grow invert opacity-60 scale-90 origin-left brightness-125" />
                  <a
                    href={task.audioUrl}
                    download={`vox_clone_${task.id}.wav`}
                    className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-red-600/20 rounded-lg text-gray-600 hover:text-red-500 transition-all border border-white/5 shrink-0"
                  >
                    <i className="fas fa-download text-[10px]"></i>
                  </a>
                </div>
              )}

              {task.status === 'failed' && (
                <p className="text-[10px] text-red-900 italic mt-1 font-medium">错误: {task.errorMessage}</p>
              )}

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">文本脚本</p>
                    <p className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap break-words">{task.script}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">情感控制模式</p>
                      <p className="text-xs text-red-400 font-semibold">{emotionModeLabels[task.emotionMode] || task.emotionMode}</p>
                    </div>
                    {typeof task.emotionAlpha === 'number' && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">情感强度</p>
                        <p className="text-xs text-orange-400 font-mono">{task.emotionAlpha.toFixed(2)}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">音色参考音频</p>
                    {taskReferenceAudio ? (
                      <audio src={taskReferenceAudio} controls className="h-8 w-full invert opacity-70" />
                    ) : (
                      <p className="text-[11px] text-gray-500">{isLoadingDetails ? '加载中...' : '暂无可播放音频'}</p>
                    )}
                  </div>

                  {task.emotionMode === 'emotion_prompt' && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">情感参考音频（模仿参考）</p>
                      {taskEmotionAudio ? (
                        <audio src={taskEmotionAudio} controls className="h-8 w-full invert opacity-70" />
                      ) : (
                        <p className="text-[11px] text-gray-500">{isLoadingDetails ? '加载中...' : '暂无可播放音频'}</p>
                      )}
                    </div>
                  )}

                  {task.emotionMode === 'emotion_vector' && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">向量维度（精细调节）</p>
                      {task.emotionVector && task.emotionVector.length === 8 ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {task.emotionVector.map((value, index) => (
                            <p key={`${task.id}-${index}`} className="text-[11px] text-gray-400 font-mono">
                              {index}. {emotionVectorLabels[index]}: {value.toFixed(2)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-500">未保存向量数据</p>
                      )}
                    </div>
                  )}

                  {detailError && (
                    <p className="text-[11px] text-red-400">详情加载失败: {detailError}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 pt-4 pb-2 border-t border-white/5 flex items-center justify-center gap-6 shrink-0">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className={`w-8 h-8 rounded-full border border-white/5 flex items-center justify-center transition-all
              ${currentPage === 1 ? 'opacity-10 cursor-not-allowed' : 'hover:bg-red-500/10 hover:border-red-500/30 text-red-500/60'}`}
          >
            <i className="fas fa-chevron-left text-xs"></i>
          </button>

          <div className="text-[10px] font-mono select-none tracking-widest">
            <span className="text-red-500 font-bold">{currentPage}</span>
            <span className="mx-2 text-gray-800">/</span>
            <span className="text-gray-600">{totalPages}</span>
          </div>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className={`w-8 h-8 rounded-full border border-white/5 flex items-center justify-center transition-all
              ${currentPage === totalPages ? 'opacity-10 cursor-not-allowed' : 'hover:bg-red-500/10 hover:border-red-500/30 text-red-500/60'}`}
          >
            <i className="fas fa-chevron-right text-xs"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskList;
