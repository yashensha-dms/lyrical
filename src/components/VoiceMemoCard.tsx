import React, { useEffect, useRef, useState } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import { Play, Pause, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface VoiceMemo {
  id: string;
  project_id: string;
  audio_url: string;
  created_at: string;
  isOptimistic?: boolean;
}

interface VoiceMemoCardProps {
  memo: VoiceMemo;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onDelete: (id: string) => void;
}

export const VoiceMemoCard: React.FC<VoiceMemoCardProps> = ({
  memo,
  isPlaying,
  onPlayToggle,
  onDelete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { wavesurfer } = useWavesurfer({
    container: containerRef,
    url: memo.audio_url,
    waveColor: '#D3C9C0', // Warm ink-light / paper-darker color
    progressColor: '#C0694E', // Terracotta progress color
    height: 36,
    barWidth: 2,
    barGap: 3,
    cursorWidth: 0,
  });

  useEffect(() => {
    if (!wavesurfer) return;

    const handleReady = () => {
      setIsReady(true);
    };

    const handleFinish = () => {
      if (isPlaying) {
        onPlayToggle();
      }
    };

    wavesurfer.on('ready', handleReady);
    wavesurfer.on('finish', handleFinish);

    return () => {
      wavesurfer.un('ready', handleReady);
      wavesurfer.un('finish', handleFinish);
    };
  }, [wavesurfer, isPlaying, onPlayToggle]);

  // Synchronize playback with isPlaying prop
  useEffect(() => {
    if (!wavesurfer || !isReady) return;

    if (isPlaying) {
      wavesurfer.play().catch((err) => {
        console.error('Playback error:', err);
      });
    } else {
      wavesurfer.pause();
    }
  }, [isPlaying, isReady, wavesurfer]);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      // 1. Delete from Supabase Storage
      const urlParts = memo.audio_url.split('/public/audio/');
      if (urlParts.length === 2) {
        const storagePath = urlParts[1];
        const { error: storageError } = await supabase.storage
          .from('audio')
          .remove([storagePath]);

        if (storageError) {
          console.error('Error deleting from storage:', storageError.message);
        }
      }

      // 2. Delete from Database Table
      const { error: dbError } = await supabase
        .from('voice_memos')
        .delete()
        .eq('id', memo.id);

      if (dbError) {
        throw dbError;
      }

      // Call parent callback to remove from state
      onDelete(memo.id);
    } catch (err: any) {
      console.error('Failed to delete voice memo:', err);
      alert('Failed to delete memo: ' + (err.message || String(err)));
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-paper border border-paper-darker rounded-lg p-3 shadow-sm flex flex-col gap-2 select-none relative group transition-all duration-200 hover:border-paper-darkest hover:shadow-paper-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-ink-muted">
          {formatDate(memo.created_at)}
        </span>

        {memo.isOptimistic ? (
          <span className="flex items-center gap-1 text-[9px] bg-paper-dark border border-paper-darker text-ink-light px-1.5 py-0.5 rounded font-mono">
            <Loader2 className="w-2.5 h-2.5 animate-spin text-terracotta" /> Saving...
          </span>
        ) : (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-ink-light hover:text-terracotta hover:bg-paper-darker p-1 rounded transition-colors duration-150 cursor-pointer"
            title="Delete Memo"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onPlayToggle}
          disabled={!isReady}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isPlaying
              ? 'bg-terracotta hover:bg-terracotta-hover text-white'
              : 'bg-paper-dark hover:bg-paper-darker text-ink hover:text-terracotta'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current stroke-[1.5]" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5 stroke-[1.5]" />
          )}
        </button>

        <div className="flex-1 min-h-[36px] bg-paper-dark/30 rounded border border-dashed border-paper-darker/60 px-2 flex items-center relative">
          {!isReady && !memo.isOptimistic && (
            <div className="absolute inset-0 flex items-center justify-center bg-paper/60 backdrop-blur-[0.5px] rounded z-10">
              <Loader2 className="w-4 h-4 animate-spin text-terracotta" />
            </div>
          )}
          <div ref={containerRef} className="w-full" />
        </div>
      </div>
    </div>
  );
};
