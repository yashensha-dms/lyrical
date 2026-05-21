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
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setTotalDuration(audioMemo.duration);
        
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (e) {
        console.error('Error parsing audio data', e);
        setAudioUrl(null);
      }
    } else {
      setAudioUrl(null);
      setTotalDuration(0);
    }
    setPlaying(false);
    setCurrentTime(0);
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

      const barWidth = 3;
      const gap = 2;
      const barCount = Math.floor(canvas.width / (barWidth + gap));
      const centerY = canvas.height / 2;

      ctx.fillStyle = '#C2593F'; // Terracotta accent

      for (let i = 0; i < barCount; i++) {
        // Map frequency index
        const freqIndex = Math.floor((i / barCount) * bufferLength * 0.5);
        const value = dataArray[freqIndex] || 0;
        const pct = value / 255;
        const barHeight = pct * canvas.height * 0.85;

        const x = i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        ctx.beginPath();
        ctx.roundRect(x, Math.max(1, y), barWidth, Math.max(2, barHeight), 1.5);
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
      const AudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
        <div className="flex-1 flex flex-col justify-between p-4 bg-paper/30 border border-paper-darker rounded-lg m-4">
          <audio ref={audioRef} src={audioUrl} />
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-terracotta-light text-terracotta rounded-lg">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink">Active Demo Vocal</h4>
                <p className="text-[10px] text-ink-muted">Recorded Memo ({audioMemo ? formatTime(audioMemo.duration) : '00:00'})</p>
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
                className="w-full h-1.5 bg-paper-darker rounded-lg appearance-none cursor-pointer accent-terracotta focus:outline-none"
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
              className="text-ink-muted hover:text-terracotta hover:bg-paper-darker p-2 rounded-md transition cursor-pointer"
              title="Delete recording"
              disabled={loading}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              className="bg-terracotta hover:bg-terracotta-hover text-white p-3 rounded-full shadow-paper-md transition cursor-pointer"
            >
              {playing ? <Pause className="w-5 h-5 fill-white stroke-none" /> : <Play className="w-5 h-5 fill-white stroke-none translate-x-[1px]" />}
            </button>

            <a
              href={audioUrl}
              download={`demo_${draftId}.webm`}
              className="text-ink-muted hover:text-ink hover:bg-paper-darker p-2 rounded-md transition cursor-pointer"
              title="Download vocal file"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      ) : recording ? (
        // Recording Active Screen
        <div className="flex-1 flex flex-col justify-between p-4 bg-terracotta-light/30 border border-terracotta/20 rounded-lg m-4">
          <div className="text-center space-y-2">
            <span className="text-[10px] font-bold text-terracotta uppercase tracking-wider animate-pulse flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-terracotta rounded-full"></span> RECORDING MEMO
            </span>
            <div className="text-3xl font-mono font-bold text-ink">
              {formatTime(recordTime)}
            </div>
          </div>

          {/* Symmetrical Soundwave Canvas */}
          <div className="my-6 h-16 w-full flex items-center justify-center bg-paper/40 rounded-lg border border-paper-darker">
            <canvas ref={canvasRef} width={200} height={60} className="w-full h-full" />
          </div>

          <div className="flex justify-center items-center gap-6 mt-4">
            <button
              onClick={cancelRecording}
              className="text-ink-muted hover:text-ink hover:bg-paper-darker p-2 rounded-full transition cursor-pointer flex items-center gap-1 border border-paper-darker bg-paper text-xs px-3 py-1.5"
            >
              <X className="w-3.5 h-3.5" /> Discard
            </button>

            <button
              onClick={stopRecording}
              className="bg-terracotta hover:bg-terracotta-hover text-white p-4 rounded-full shadow-paper-md transition cursor-pointer flex items-center justify-center"
              title="Stop & Save Recording"
            >
              <Square className="w-5 h-5 fill-white stroke-none" />
            </button>
          </div>
        </div>
      ) : (
        // Idle/Start Recording Screen
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 m-4 border border-dashed border-paper-darker rounded-lg bg-paper-dark/20">
          <div className="mb-4 p-4 bg-paper border border-paper-darker rounded-full shadow-paper-sm">
            <Mic className="w-8 h-8 text-ink-muted" />
          </div>

          <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">Record Voice Memo</h4>
          <p className="text-[10px] text-ink-muted leading-relaxed mb-6 max-w-xs">
            Hum your melody, record scratch backing vocals, or map out basic arrangements. Recorded memos show up here whenever you open this song.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <Loader2 className="w-4 h-4 animate-spin text-terracotta" />
              <span>Updating demo vault...</span>
            </div>
          ) : (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white px-4 py-2 rounded-md text-xs font-medium cursor-pointer shadow-paper-sm hover:scale-[1.02] active:scale-[0.98] transition duration-150"
            >
              <Mic className="w-4 h-4" /> Start Recording
            </button>
          )}
        </div>
      )}
    </div>
  );
};
