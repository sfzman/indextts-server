import React, { useState, useRef, useEffect, useCallback } from 'react';
import { blobToWavFile } from '../services/audioUtils';

interface AudioRecorderProps {
  onComplete: (file: File) => void;
  onCancel: () => void;
}

type RecorderPhase = 'idle' | 'requesting' | 'recording' | 'preview';

const MAX_RECORDING_SECONDS = 60;

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onComplete, onCancel }) => {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordedBlobRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const cleanupMedia = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      cleanupMedia();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [cleanupMedia]);

  const startRecording = async () => {
    setError(null);
    setPhase('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        recordedBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setPhase('preview');
      };

      recorder.onerror = () => {
        setError('录制出错，请重试');
        setPhase('idle');
        cleanupMedia();
      };

      recorder.start(200);
      setPhase('recording');
      startTimeRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setDuration(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS * 1000) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法访问麦克风';
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setError('麦克风权限被拒绝，请在浏览器设置中允许访问');
      } else {
        setError(message);
      }
      setPhase('idle');
      cleanupMedia();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupMedia();
  };

  const handleCancel = () => {
    cleanupMedia();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onCancel();
  };

  const handleUseRecording = async () => {
    const blob = recordedBlobRef.current;
    if (!blob) return;

    try {
      const file = await blobToWavFile(blob, 'recording.wav');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onComplete(file);
    } catch {
      const ext = blob.type.includes('webm') ? 'webm' : 'ogg';
      const fallbackFile = new File([blob], `recording.${ext}`, { type: blob.type });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onComplete(fallbackFile);
    }
  };

  const handleReRecord = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setDuration(0);
    setPhase('idle');
    recordedBlobRef.current = null;
  };

  if (phase === 'requesting') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <i className="fas fa-spinner fa-spin text-lg text-[var(--accent-ink)]"></i>
        <p className="text-sm text-[var(--text-secondary)]">正在请求麦克风权限...</p>
      </div>
    );
  }

  if (phase === 'recording') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 w-full">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
          <span className="text-lg font-mono font-semibold text-[var(--text-primary)]">{formatTime(duration)}</span>
        </div>
        <div className="w-full max-w-[200px] h-1 bg-[var(--glass-border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all"
            style={{ width: `${Math.min(100, (duration / (MAX_RECORDING_SECONDS * 1000)) * 100)}%` }}
          ></div>
        </div>
        <p className="text-[11px] text-[var(--text-muted)]">最长可录制 {MAX_RECORDING_SECONDS} 秒</p>
        <button
          type="button"
          onClick={stopRecording}
          className="action-button focus-ring !bg-red-500 hover:!bg-red-600 flex items-center gap-2 mt-1"
        >
          <i className="fas fa-stop"></i>
          停止录制
        </button>
      </div>
    );
  }

  if (phase === 'preview') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 w-full">
        <audio src={previewUrl || ''} controls className="w-full max-w-[280px]" />
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            type="button"
            onClick={handleUseRecording}
            className="action-button focus-ring flex items-center gap-2"
          >
            <i className="fas fa-check"></i>
            使用此录音
          </button>
          <button
            type="button"
            onClick={handleReRecord}
            className="ghost-button focus-ring h-9 px-4 text-xs font-semibold"
          >
            <i className="fas fa-rotate-left mr-1"></i>
            重新录制
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="ghost-button focus-ring h-9 px-4 text-xs font-semibold text-[var(--error)]"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {error && (
        <p className="text-xs text-[var(--error)] text-center max-w-[240px]">{error}</p>
      )}
      <button
        type="button"
        onClick={startRecording}
        className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 focus-ring"
      >
        <i className="fas fa-microphone text-xl"></i>
      </button>
      <p className="text-sm text-[var(--text-secondary)]">点击开始录音</p>
    </div>
  );
};

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export default AudioRecorder;
