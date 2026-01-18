
import React, { useState, useEffect } from 'react';
import { CloneTask } from '../types';

interface TaskListProps {
  tasks: CloneTask[];
  onDeleteTask: (id: string) => void;
  onClearAll: () => void;
}

const TASKS_PER_PAGE = 4;

const TaskList: React.FC<TaskListProps> = ({ tasks, onDeleteTask, onClearAll }) => {
  const [currentPage, setCurrentPage] = useState(1);
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
    onClearAll();
    setCurrentPage(1);
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
        {currentTasks.map((task) => (
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
                  <span className="text-[10px] text-gray-700 font-mono">{new Date(task.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <p className="text-sm text-gray-300 truncate mb-1">"{task.script}"</p>
              </div>
              <button 
                onClick={() => onDeleteTask(task.id)}
                className="text-gray-800 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all shrink-0"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
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
          </div>
        ))}
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