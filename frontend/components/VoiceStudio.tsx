
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceProject, EmotionType, EmotionVectors, CloneTask, emotionTypeToMode, TaskListItem, BackendTaskStatus } from '../types';
import { fileToBase64 } from '../services/audioUtils';
import { uploadAudioFile } from '../services/fileService';
import { createTask, getTasks, pollTaskUntilDone } from '../services/taskService';
import { getAudioBlobUrl } from '../services/fileService';
import { User, getCurrentUser } from '../services/api';
import TaskList from './TaskList';

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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [tasksPage, setTasksPage] = useState(1);
  const [tasksTotal, setTasksTotal] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const emotionInputRef = useRef<HTMLInputElement>(null);
  const [emotionPreviewUrl, setEmotionPreviewUrl] = useState<string | null>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 自动关闭 Toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 从后端加载任务列表
  const loadTasks = useCallback(async () => {
    try {
      const response = await getTasks({ page: tasksPage, page_size: 10 });
      setTasksTotal(response.total);

      // 将后端任务转换为前端格式
      const frontendTasks: CloneTask[] = await Promise.all(
        response.tasks.map(async (task: TaskListItem): Promise<CloneTask> => {
          let audioUrl: string | null = null;

          // 如果任务已完成且有结果文件，获取音频 URL
          if (task.status === 'completed' && task.result_audio_file_id) {
            try {
              audioUrl = await getAudioBlobUrl(task.result_audio_file_id);
            } catch {
              // 获取音频失败时忽略
            }
          }

          return {
            id: task.id,
            status: task.status === 'pending' ? 'processing' : task.status,
            script: task.text,
            audioUrl,
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

  // 初始化加载任务
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const processVoiceFile = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setToast({ type: 'error', message: "请上传有效的音频文件" });
      return;
    }
    const base64 = await fileToBase64(file);
    const previewUrl = URL.createObjectURL(file);

    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);

    setVoicePreviewUrl(previewUrl);
    setVoiceReferenceFile(file);
    setProject(prev => ({ ...prev, voiceReference: base64 }));
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
    setProject(prev => ({ ...prev, voiceReference: null }));
    if (voiceInputRef.current) voiceInputRef.current.value = '';
  };

  // 情感参考音频处理
  const processEmotionFile = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setToast({ type: 'error', message: "请上传有效的音频文件" });
      return;
    }
    const base64 = await fileToBase64(file);
    const previewUrl = URL.createObjectURL(file);

    if (emotionPreviewUrl) URL.revokeObjectURL(emotionPreviewUrl);

    setEmotionPreviewUrl(previewUrl);
    setEmotionReferenceFile(file);
    setProject(prev => ({ ...prev, emotionReference: base64 }));
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
    setProject(prev => ({ ...prev, emotionReference: null }));
    if (emotionInputRef.current) emotionInputRef.current.value = '';
  };

  const updateVector = (key: keyof EmotionVectors, value: number) => {
    setProject(prev => ({
      ...prev,
      emotionVectors: { ...prev.emotionVectors, [key]: value }
    }));
  };

  const generateVoice = async () => {
    if (!voiceReferenceFile || !project.script) {
      setToast({ type: 'error', message: "请上传声音参考并输入台词内容" });
      return;
    }

    if (user.credits < 1) {
      setToast({ type: 'error', message: "余额不足，请先充值" });
      return;
    }

    setIsProcessing(true);

    try {
      // 1. 上传参考音频
      setToast({ type: 'success', message: "正在上传音频..." });
      const voiceUploadResult = await uploadAudioFile(voiceReferenceFile);

      // 2. 如果需要，上传情感参考音频
      let emotionPromptFileId: string | undefined;
      if (project.emotionType === EmotionType.REFERENCE_AUDIO && emotionReferenceFile) {
        const emotionUploadResult = await uploadAudioFile(emotionReferenceFile);
        emotionPromptFileId = emotionUploadResult.id;
      }

      // 3. 构建情感向量（如果需要）
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

      // 4. 创建任务
      setToast({ type: 'success', message: "正在创建任务..." });
      const createResult = await createTask({
        text: project.script,
        reference_audio_file_id: voiceUploadResult.id,
        emotion_mode: emotionTypeToMode[project.emotionType],
        emotion_prompt_file_id: emotionPromptFileId,
        emotion_vector: emotionVector,
        emotion_alpha: project.emotionAlpha,
      });

      // 5. 添加任务到列表（处理中状态）
      const newTask: CloneTask = {
        id: createResult.id,
        status: 'processing',
        script: project.script,
        audioUrl: null,
        createdAt: new Date(createResult.created_at).getTime(),
      };
      setTasks(prev => [newTask, ...prev]);

      // 6. 轮询任务状态
      setToast({ type: 'success', message: "任务已提交，正在处理中..." });
      const completedTask = await pollTaskUntilDone(createResult.id, {
        interval: 2000,
        timeout: 300000,
        onStatusChange: (status: BackendTaskStatus) => {
          setTasks(prev =>
            prev.map(t =>
              t.id === createResult.id
                ? { ...t, status: status === 'pending' ? 'processing' : status }
                : t
            )
          );
        },
      });

      // 7. 处理完成结果
      if (completedTask.status === 'completed' && completedTask.result_audio_file_id) {
        const audioUrl = await getAudioBlobUrl(completedTask.result_audio_file_id);
        // 刷新用户数据获取最新余额
        try {
          const updatedUser = await getCurrentUser();
          onUserUpdate(updatedUser);
        } catch {
          // 刷新失败时忽略
        }
        setTasks(prev =>
          prev.map(t =>
            t.id === createResult.id ? { ...t, status: 'completed', audioUrl } : t
          )
        );
        setToast({ type: 'success', message: "克隆成功！" });
      } else {
        setTasks(prev =>
          prev.map(t =>
            t.id === createResult.id
              ? { ...t, status: 'failed', errorMessage: completedTask.error_message || '生成失败' }
              : t
          )
        );
        setToast({ type: 'error', message: completedTask.error_message || "克隆任务失败" });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      setToast({ type: 'error', message: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 relative">
      {/* 用户信息菜单 */}
      <div className="absolute -top-16 right-0 z-50" ref={menuRef}>
        <button 
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border shadow-lg ${
            isUserMenuOpen ? 'bg-red-600 border-red-400 scale-110' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <i className="fas fa-user-circle text-xl text-white"></i>
        </button>
        {isUserMenuOpen && (
          <div className="absolute top-14 right-0 w-64 glass-morphism rounded-2xl p-5 shadow-2xl border-white/10 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="space-y-4">
              <div className="border-b border-white/5 pb-3">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">账户 ID</p>
                <p className="text-sm text-white font-medium">{user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</p>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">当前余额</p>
                  <p className="text-xl font-mono font-bold text-red-500">
                    {user.credits} <span className="text-sm">积分</span>
                  </p>
                </div>
              </div>
              <button className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-red-900/20">
                立即充值
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border ${
            toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-300' : 'bg-red-500/20 border-red-500/50 text-red-300'
          }`}>
            <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="glass-morphism rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <i className="fas fa-plus-circle text-red-500"></i>
              克隆工作室
            </h2>
            <div className="bg-red-500/10 text-red-400 text-[10px] px-2 py-1 rounded border border-red-500/20 font-bold">
              $1.00 / 每次
            </div>
          </div>

          {/* 声音参考 (支持拖拽 & 播放器) */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              声音参考音频 (Target Voice)
            </label>
            
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !project.voiceReference && !isProcessing && voiceInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-6 transition-all min-h-[140px] flex flex-col items-center justify-center
                ${isDragging ? 'border-red-500 bg-red-500/10 scale-[1.02]' : 'border-gray-800 hover:border-red-500/50 hover:bg-white/5'}
                ${isProcessing ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                ${project.voiceReference ? 'border-red-500/30 bg-red-500/5' : ''}`}
            >
              <input type="file" ref={voiceInputRef} className="hidden" accept="audio/*" onChange={handleFileChange} />
              
              {!project.voiceReference ? (
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-gray-900 text-gray-500 flex items-center justify-center mx-auto shadow-inner border border-white/5">
                    <i className="fas fa-cloud-upload-alt text-2xl"></i>
                  </div>
                  <div>
                    <p className="text-sm text-gray-200 font-semibold">点击或拖拽音频到此处</p>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">WAV / MP3 / AAC (建议 15s+)</p>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-4 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                      <i className="fas fa-check-circle"></i> 音色已锁定
                    </span>
                    <button 
                      onClick={handleResetVoice}
                      className="text-[10px] font-bold text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      <i className="fas fa-sync-alt"></i> 重新上传
                    </button>
                  </div>
                  
                  <div className="bg-black/40 rounded-xl p-3 flex items-center gap-3 border border-white/5">
                    <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center text-red-500">
                      <i className="fas fa-volume-up"></i>
                    </div>
                    <audio src={voicePreviewUrl!} controls className="h-8 flex-grow invert opacity-80" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">文本脚本 (Script)</label>
            <textarea 
              disabled={isProcessing}
              className="w-full h-24 bg-gray-900/50 border border-gray-800 rounded-xl p-3 text-white focus:ring-1 focus:ring-red-500 outline-none transition-all resize-none text-sm disabled:opacity-40"
              placeholder="输入需要转换成语音的文字内容..."
              value={project.script}
              onChange={(e) => setProject(prev => ({ ...prev, script: e.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">情感倾向</label>
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {['VECTORS', 'SAME_AS_VOICE', 'REFERENCE_AUDIO'].map(key => {
                const type = EmotionType[key as keyof typeof EmotionType];
                const isActive = project.emotionType === type;
                return (
                  <button
                    key={key}
                    disabled={isProcessing}
                    onClick={() => setProject(prev => ({ ...prev, emotionType: type }))}
                    className={`text-[10px] px-3 py-1.5 rounded-md border transition-all whitespace-nowrap ${
                      isActive ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-500'
                    }`}
                  >
                    {key === 'VECTORS' ? '精细调节' : key === 'SAME_AS_VOICE' ? '保持原味' : '模仿参考'}
                  </button>
                );
              })}
            </div>

            {/* 保持原味模式说明 */}
            {project.emotionType === EmotionType.SAME_AS_VOICE && (
              <div className="bg-gray-900/40 rounded-xl p-3 border border-white/5">
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  <i className="fas fa-info-circle text-gray-600 mr-1.5"></i>
                  直接使用声音参考音频中的原始情感色彩，合成的语音将保持与参考音频相同的情感表达。
                </p>
              </div>
            )}

            {project.emotionType === EmotionType.VECTORS && (
              <div className="bg-gray-900/40 rounded-xl p-4 border border-white/5 space-y-4">
                <p className="text-[11px] text-gray-400 leading-relaxed pb-2 border-b border-white/5">
                  <i className="fas fa-sliders-h text-gray-600 mr-1.5"></i>
                  通过调节 8 种情感维度的数值，精确控制合成语音的情感表达。可以混合多种情感创造独特的语气风格。
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {(Object.keys(project.emotionVectors) as Array<keyof EmotionVectors>).map((key) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">{emotionLabels[key]}</span>
                        <span className="text-red-400 font-mono">{project.emotionVectors[key].toFixed(1)}</span>
                      </div>
                      <input
                        type="range" min="0" max="1" step="0.1"
                        disabled={isProcessing}
                        value={project.emotionVectors[key]}
                        onChange={(e) => updateVector(key, parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500 disabled:opacity-30"
                      />
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-white/5 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-400 font-medium">情感强度</span>
                    <span className="text-red-400 font-mono">{project.emotionAlpha.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    disabled={isProcessing}
                    value={project.emotionAlpha}
                    onChange={(e) => setProject(prev => ({ ...prev, emotionAlpha: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500 disabled:opacity-30"
                  />
                </div>
              </div>
            )}

            {project.emotionType === EmotionType.REFERENCE_AUDIO && (
              <div className="space-y-3">
                <div className="bg-gray-900/40 rounded-xl p-3 border border-white/5">
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    <i className="fas fa-theater-masks text-gray-600 mr-1.5"></i>
                    上传一段带有目标情感的音频，系统将提取其中的情感特征并应用到合成语音中，让输出的声音具有相似的情感表达。
                  </p>
                </div>
                <div
                  onClick={() => !project.emotionReference && !isProcessing && emotionInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-4 transition-all min-h-[100px] flex flex-col items-center justify-center
                    ${isProcessing ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    ${project.emotionReference
                      ? 'border-orange-500/30 bg-orange-500/5'
                      : 'border-gray-800 hover:border-orange-500/50 hover:bg-white/5'}`}
                >
                  <input
                    type="file"
                    ref={emotionInputRef}
                    className="hidden"
                    accept="audio/*"
                    onChange={handleEmotionFileChange}
                  />

                  {!project.emotionReference ? (
                    <div className="text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-gray-900 text-gray-500 flex items-center justify-center mx-auto shadow-inner border border-white/5">
                        <i className="fas fa-theater-masks text-lg"></i>
                      </div>
                      <div>
                        <p className="text-xs text-gray-300 font-medium">上传情感参考音频</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">提取该音频的情感特征</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full space-y-3 animate-in fade-in zoom-in duration-300">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2">
                          <i className="fas fa-check-circle"></i> 情感参考已设置
                        </span>
                        <button
                          onClick={handleResetEmotion}
                          className="text-[10px] font-bold text-gray-500 hover:text-orange-400 transition-colors flex items-center gap-1"
                        >
                          <i className="fas fa-sync-alt"></i> 更换
                        </button>
                      </div>

                      <div className="bg-black/40 rounded-lg p-2 flex items-center gap-2 border border-white/5">
                        <div className="w-8 h-8 rounded-md bg-orange-600/20 flex items-center justify-center text-orange-500">
                          <i className="fas fa-theater-masks text-sm"></i>
                        </div>
                        <audio src={emotionPreviewUrl!} controls className="h-7 flex-grow invert opacity-60" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 情感强度滑块 - 控制从参考音频提取的情感特征的混合强度 */}
                <div className="bg-gray-900/40 rounded-xl p-3 border border-white/5 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-400 font-medium">情感强度</span>
                    <span className="text-orange-400 font-mono">{project.emotionAlpha.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    disabled={isProcessing}
                    value={project.emotionAlpha}
                    onChange={(e) => setProject(prev => ({ ...prev, emotionAlpha: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-30"
                  />
                  <p className="text-[10px] text-gray-600 pt-1">强度越高越接近情感参考音频，越低则越像原音频</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={generateVoice}
            disabled={isProcessing}
            className={`w-full py-4 rounded-xl font-bold transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3
              ${isProcessing 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5 opacity-60' 
                : 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-red-900/40'}`}
          >
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

        <div className="glass-morphism rounded-3xl p-8 shadow-2xl flex flex-col h-[650px]">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
            <i className="fas fa-history text-red-500"></i>
            生成历史
          </h2>
          <TaskList 
            tasks={tasks} 
            onDeleteTask={(id) => setTasks(prev => prev.filter(t => t.id !== id))} 
            onClearAll={() => { if(confirm("清空全部任务历史？")) setTasks([]) }} 
          />
        </div>
      </div>
    </div>
  );
};

export default VoiceStudio;