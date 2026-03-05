import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeAudioFile } from '../services/audioUtils';

interface AudioWaveformEditorProps {
  file: File;
  audioUrl: string;
  disabled?: boolean;
  accent?: 'voice' | 'emotion';
  onTrimChange: (start: number, end: number, duration: number) => void;
}

const formatSeconds = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '00:00';
  }
  const total = Math.max(0, value);
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const AudioWaveformEditor: React.FC<AudioWaveformEditorProps> = ({
  file,
  audioUrl,
  disabled = false,
  accent = 'voice',
  onTrimChange,
}) => {
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [dragMode, setDragMode] = useState<'start' | 'end' | null>(null);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformTrackRef = useRef<HTMLDivElement>(null);

  const accentClass = accent === 'emotion'
    ? {
      selected: 'bg-[rgba(176,149,146,0.82)]',
      unselected: 'bg-[rgba(153,138,129,0.3)]',
      text: 'text-[var(--accent-rose)]',
      range: 'bg-[rgba(176,149,146,0.24)] border-[rgba(176,149,146,0.5)]',
      handle: 'bg-[rgba(176,149,146,0.95)]',
    }
    : {
      selected: 'bg-[rgba(119,141,131,0.85)]',
      unselected: 'bg-[rgba(145,133,124,0.28)]',
      text: 'text-[var(--accent-sage)]',
      range: 'bg-[rgba(119,141,131,0.22)] border-[rgba(119,141,131,0.5)]',
      handle: 'bg-[rgba(119,141,131,0.95)]',
    };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await analyzeAudioFile(file, 120);
        if (cancelled) {
          return;
        }
        setDuration(result.duration);
        setPeaks(result.peaks);
        setStartTime(0);
        setEndTime(result.duration);
        onTrimChange(0, result.duration, result.duration);
      } catch (e) {
        if (cancelled) {
          return;
        }
        setError(e instanceof Error ? e.message : '波形解析失败');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [file]);

  const minGap = useMemo(() => {
    if (duration <= 0) {
      return 0;
    }
    if (duration > 1) {
      return Math.min(0.1, duration);
    }
    return Math.min(0.01, duration / 2);
  }, [duration]);

  const applyTrimRange = useCallback((nextStart: number, nextEnd: number) => {
    if (duration <= 0) {
      return;
    }

    const maxStart = Math.max(0, duration - minGap);
    const normalizedStart = Math.max(0, Math.min(nextStart, maxStart));
    const normalizedEnd = Math.min(duration, Math.max(nextEnd, normalizedStart + minGap));

    setStartTime(normalizedStart);
    setEndTime(normalizedEnd);
    onTrimChange(normalizedStart, normalizedEnd, duration);
  }, [duration, minGap, onTrimChange]);

  const handleStartChange = useCallback((value: number) => {
    applyTrimRange(value, endTime);
  }, [applyTrimRange, endTime]);

  const handleEndChange = useCallback((value: number) => {
    applyTrimRange(startTime, value);
  }, [applyTrimRange, startTime]);

  const getTimeFromClientX = useCallback((clientX: number) => {
    if (!waveformTrackRef.current || duration <= 0) {
      return 0;
    }

    const rect = waveformTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) {
      return 0;
    }

    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || loading || !!error || duration <= 0) {
      return;
    }

    const clickedTime = getTimeFromClientX(e.clientX);
    if (Math.abs(clickedTime - startTime) <= Math.abs(clickedTime - endTime)) {
      handleStartChange(clickedTime);
    } else {
      handleEndChange(clickedTime);
    }
  };

  const handleHandlePointerDown = (mode: 'start' | 'end') => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || loading || !!error) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setDragMode(mode);
    setActivePointerId(e.pointerId);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleHandlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragMode || activePointerId !== e.pointerId || disabled || loading || !!error) {
      return;
    }

    e.preventDefault();
    const nextTime = getTimeFromClientX(e.clientX);
    if (dragMode === 'start') {
      handleStartChange(nextTime);
    } else {
      handleEndChange(nextTime);
    }
  };

  const handleHandlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerId === e.pointerId) {
      setDragMode(null);
      setActivePointerId(null);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handlePreviewTrim = async () => {
    if (!audioRef.current || disabled) {
      return;
    }

    if (isPreviewPlaying) {
      audioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }

    try {
      audioRef.current.currentTime = startTime;
      await audioRef.current.play();
      setIsPreviewPlaying(true);
    } catch {
      setIsPreviewPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) {
      return;
    }
    if (audioRef.current.currentTime >= endTime) {
      audioRef.current.pause();
      audioRef.current.currentTime = startTime;
      setIsPreviewPlaying(false);
    }
  };

  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
  const selectedWidth = Math.max(0, endPercent - startPercent);

  return (
    <div className="space-y-3">
      <div className="audio-surface px-3 py-3">
        <div
          ref={waveformTrackRef}
          className="relative h-[92px] overflow-hidden rounded-lg bg-[rgba(255,255,255,0.3)] select-none touch-none"
          onPointerDown={handleTrackPointerDown}
        >
          {loading && (
            <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
              正在生成波形...
            </div>
          )}

          {!loading && error && (
            <div className="w-full h-full flex items-center justify-center text-xs text-[var(--error)]">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="absolute inset-0 px-2 py-2 flex items-end gap-[2px]">
                {peaks.map((peak, index) => {
                  const pointTime = (index / Math.max(1, peaks.length - 1)) * duration;
                  const isSelected = pointTime >= startTime && pointTime <= endTime;
                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className={`flex-1 rounded-sm transition-colors ${isSelected ? accentClass.selected : accentClass.unselected}`}
                      style={{ height: `${Math.max(8, peak * 66)}px` }}
                    />
                  );
                })}
              </div>

              <div
                className={`absolute top-2 bottom-2 rounded-md border pointer-events-none ${accentClass.range}`}
                style={{ left: `${startPercent}%`, width: `${selectedWidth}%` }}
              />

              <button
                type="button"
                aria-label="拖动裁剪起点"
                className={`absolute top-2 bottom-2 w-3 rounded-full border border-white/60 shadow ${accentClass.handle}`}
                style={{ left: `calc(${startPercent}% - 6px)` }}
                onPointerDown={handleHandlePointerDown('start')}
                onPointerMove={handleHandlePointerMove}
                onPointerUp={handleHandlePointerUp}
              />

              <button
                type="button"
                aria-label="拖动裁剪终点"
                className={`absolute top-2 bottom-2 w-3 rounded-full border border-white/60 shadow ${accentClass.handle}`}
                style={{ left: `calc(${endPercent}% - 6px)` }}
                onPointerDown={handleHandlePointerDown('end')}
                onPointerMove={handleHandlePointerMove}
                onPointerUp={handleHandlePointerUp}
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 items-center gap-2 text-[11px] text-[var(--text-secondary)]">
        <span>起点 {formatSeconds(startTime)}</span>
        <span className="text-center">总长 {formatSeconds(duration)}</span>
        <span className="text-right">终点 {formatSeconds(endTime)}</span>
      </div>

      <p className="text-[11px] text-[var(--text-muted)]">拖动波形上的两端手柄设置裁剪区间，区间部分将用于提交和收藏。</p>

      <div className="grid grid-cols-3 items-center gap-2">
        <button
          type="button"
          onClick={() => applyTrimRange(0, duration)}
          className="ghost-button focus-ring h-8 w-8 text-xs font-semibold flex items-center justify-center"
          disabled={disabled || loading || !!error}
          title="重置裁剪"
          aria-label="重置裁剪"
        >
          <i className="fas fa-rotate-left"></i>
        </button>

        <button
          type="button"
          onClick={() => { void handlePreviewTrim(); }}
          className={`ghost-button focus-ring h-8 w-8 text-xs font-semibold flex items-center justify-center justify-self-center ${accentClass.text}`}
          disabled={disabled || loading || !!error}
          title={isPreviewPlaying ? '暂停试听' : '试听裁剪区间'}
          aria-label={isPreviewPlaying ? '暂停试听' : '试听裁剪区间'}
        >
          <i className={`fas ${isPreviewPlaying ? 'fa-pause' : 'fa-play'}`}></i>
        </button>

        <div></div>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPreviewPlaying(false)}
      />
    </div>
  );
};

export default AudioWaveformEditor;
