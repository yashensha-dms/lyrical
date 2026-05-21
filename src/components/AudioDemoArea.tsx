import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, Play, Pause, Trash2, Download, X, Loader2, Music } from 'lucide-react';
import { useAudioMemo } from '../hooks/useAudioMemo';

interface AudioDemoAreaProps {
  draftId: string;
  isCloudMode: boolean;
  onAudioChange?: (hasAudio: boolean) => void;
}

export const AudioDemoArea: React.FC<AudioDemoAreaProps> = ({
  draftId,
  isCloudMode,
  onAudioChange
}) => {
  const { audioMemo, loading, saveAudio, deleteAudio } = useAudioMemo(draftId, isCloudMode, onAudioChange);

  // Recording State
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Playback State
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  // Refs for Recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);

  // Refs for Audio Visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Refs for Playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLInputElement>(null);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Convert Base64 data to Blob URL for playback
  useEffect(() => {
    let active = true;
    let url: string | null = null;

    if (audioMemo?.audioData) {
      try {
        const parts = audioMemo.audioData.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || audioMemo.mimeType;
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        url = URL.createObjectURL(blob);
        
        const finalUrl = url;
        const finalDuration = audioMemo.duration;
        Promise.resolve().then(() => {
          if (active) {
            setAudioUrl(finalUrl);
            setTotalDuration(finalDuration);
            setPlaying(false);
            setCurrentTime(0);
          }
        });
      } catch (e) {
        console.error('Error parsing audio data', e);
        Promise.resolve().then(() => {
          if (active) {
            setAudioUrl(null);
            setPlaying(false);
            setCurrentTime(0);
          }
        });
      }
    } else {
      Promise.resolve().then(() => {
        if (active) {
          setAudioUrl(null);
          setTotalDuration(0);
          setPlaying(false);
          setCurrentTime(0);
        }
      });
    }

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [audioMemo]);

  // Audio elements event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleDurationChange = () => {
      if (!isNaN(audio.duration) && audio.duration !== Infinity) {
        setTotalDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // Canvas visualizer loop
  const drawVisualizer = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!recording) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Clear with background color
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = 4;
      const gap = 2;
      const barCount = Math.floor(canvas.width / (barWidth + gap));
      const centerY = canvas.height / 2;

      // Premium horizontal gradient across the soundwave canvas
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#C2593F');   // Terracotta primary
      gradient.addColorStop(0.5, '#E07A5F'); // Soft peach accent
      gradient.addColorStop(1, '#A3452F');   // Deep Terracotta

      ctx.fillStyle = gradient;

      for (let i = 0; i < barCount; i++) {
        // Map frequency index
        const freqIndex = Math.floor((i / barCount) * bufferLength * 0.6);
        const value = dataArray[freqIndex] || 0;
        // Subtle sine noise baseline to keep visualizer active when quiet
        const noise = Math.sin(i * 0.15 + Date.now() * 0.008) * 3;
        const pct = value / 255;
        const barHeight = Math.max(3, pct * canvas.height * 0.85 + noise);

        const x = i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }
    };

    draw();
  }, [recording]);

  // Handle Recording visualizer start
  useEffect(() => {
    if (recording) {
      drawVisualizer();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [recording, drawVisualizer]);

  // Helper: detect safari/ios compatible mime type
  const getSupportedMimeType = () => {
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/aac'];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return 'audio/webm'; // Fallback
  };

  // Start Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Setup Web Audio API for visualizer
      const AudioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = AudioCtx.createMediaStreamSource(stream);
      const analyser = AudioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      audioCtxRef.current = AudioCtx;
      analyserRef.current = analyser;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const duration = recordTime;
        
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          await saveAudio(base64data, duration, mimeType);
          setRecordTime(0);
        };
      };

      setRecordTime(0);
      setRecording(true);
      mediaRecorder.start();

      recordIntervalRef.current = window.setInterval(() => {
        setRecordTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to access microphone', err);
      alert('Microphone access is required to record voice demos.');
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }

      // Close Web Audio stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    }
  };

  // Cancel Recording
  const cancelRecording = () => {
    setRecording(false);
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = null; // discard chunks
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    setRecordTime(0);
  };

  // Custom Audio Controls
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(e => console.error('Play error', e));
      setPlaying(true);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = parseFloat(e.target.value);
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const handleDelete = () => {
    if (confirm('Delete this voice demo? This cannot be undone.')) {
      deleteAudio();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full select-none">
      {audioUrl ? (
        // Playback Screen
        <div className="flex-1 flex flex-col justify-between p-4 bg-paper/30 border border-paper-darker rounded-xl m-4 shadow-paper-sm">
          <audio ref={audioRef} src={audioUrl} />
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-terracotta-light border border-terracotta/10 text-terracotta rounded-xl shadow-paper-sm">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink tracking-wide">Active Vocal Demo</h4>
                <p className="text-[10px] font-mono text-ink-muted">Recorded Memo ({audioMemo ? formatTime(audioMemo.duration) : '00:00'})</p>
              </div>
            </div>

            {/* Custom progress slider */}
            <div className="space-y-1">
              <input
                ref={progressRef}
                type="range"
                min={0}
                max={totalDuration || 100}
                value={currentTime}
                onChange={handleScrub}
                className="w-full h-1 bg-paper-darker rounded-lg appearance-none cursor-pointer accent-terracotta focus:outline-none focus:ring-0 [&::-webkit-slider-runnable-track]:bg-paper-darker [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-terracotta [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-125 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-terracotta [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-125"
              />
              <div className="flex justify-between text-[9px] font-mono text-ink-light">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(totalDuration)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 pt-3 border-t border-paper-darker">
            <button
              onClick={handleDelete}
              className="text-ink-muted hover:text-terracotta hover:bg-paper-active p-2 rounded-full transition cursor-pointer"
              title="Delete recording"
              disabled={loading}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              className="bg-terracotta hover:bg-terracotta-hover hover:scale-105 active:scale-95 text-white p-3 rounded-full shadow-paper-md transition cursor-pointer"
            >
              {playing ? <Pause className="w-5 h-5 fill-white stroke-none" /> : <Play className="w-5 h-5 fill-white stroke-none translate-x-[1px]" />}
            </button>

            <a
              href={audioUrl}
              download={`demo_${draftId}.webm`}
              className="text-ink-muted hover:text-ink hover:bg-paper-active p-2 rounded-full transition cursor-pointer"
              title="Download vocal file"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      ) : recording ? (
        // Recording Active Screen
        <div className="flex-1 flex flex-col justify-between p-4 bg-terracotta-light/30 border border-terracotta/20 rounded-xl m-4 shadow-paper-sm">
          <div className="text-center space-y-1">
            <span className="text-[9px] font-bold text-terracotta uppercase tracking-widest animate-pulse flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-terracotta rounded-full"></span> Live Recording
            </span>
            <div className="text-2xl font-mono font-bold text-ink">
              {formatTime(recordTime)}
            </div>
          </div>

          {/* Symmetrical Soundwave Canvas */}
          <div className="my-4 h-16 w-full flex items-center justify-center bg-paper rounded-lg border border-paper-darker shadow-inner overflow-hidden">
            <canvas ref={canvasRef} width={200} height={60} className="w-full h-full" />
          </div>

          <div className="flex justify-center items-center gap-4 mt-2 select-none">
            <button
              onClick={cancelRecording}
              className="text-ink-muted hover:text-ink hover:bg-paper-active p-2 rounded-lg transition-all cursor-pointer flex items-center gap-1 border border-paper-darker bg-paper text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 shadow-paper-sm"
            >
              <X className="w-3.5 h-3.5" /> Discard
            </button>

            <button
              onClick={stopRecording}
              className="bg-terracotta hover:bg-terracotta-hover text-white p-3.5 rounded-full shadow-paper-md hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center relative cursor-pointer"
              title="Stop & Save Recording"
            >
              <span className="absolute inset-0 rounded-full border border-terracotta/30 animate-ping pointer-events-none" />
              <Square className="w-4 h-4 fill-white stroke-none" />
            </button>
          </div>
        </div>
      ) : (
        // Idle/Start Recording Screen
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 m-4 border border-dashed border-paper-darker rounded-xl bg-paper/30 shadow-inner">
          <div className="mb-4 p-4 bg-paper border border-paper-darker rounded-full shadow-paper-sm hover:scale-105 transition-transform duration-300">
            <Mic className="w-6 h-6 text-terracotta" />
          </div>

          <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider mb-2">Record Vocal Draft</h4>
          <p className="text-[10px] text-ink-muted leading-relaxed mb-5 max-w-[200px]">
            Hum your melody, record scratch backing vocals, or map out basic arrangements.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-[11px] text-ink-muted font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-terracotta" />
              <span>Updating demo vault...</span>
            </div>
          ) : (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider cursor-pointer shadow-paper-md hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
            >
              <Mic className="w-3.5 h-3.5" /> Start Recording
            </button>
          )}
        </div>
      )}
    </div>
  );
};
