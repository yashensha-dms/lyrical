import React, { useState, useEffect, useRef } from 'react';
import RecordRTC from 'recordrtc';
import { supabase } from '../utils/supabaseClient';
import { VoiceMemoCard } from './VoiceMemoCard';
import { Loader2, Mic, Square, AlertCircle } from 'lucide-react';

interface VoiceMemo {
  id: string;
  project_id: string;
  audio_url: string;
  created_at: string;
  isOptimistic?: boolean;
}

interface VoiceMemosPanelProps {
  projectId: string;
}

export const VoiceMemosPanel: React.FC<VoiceMemosPanelProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(true);
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);

  // Fetch memos on mount or when projectId changes
  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;
    setLoading(true);
    setMemos([]);

    const fetchMemos = async () => {
      try {
        const { data, error } = await supabase
          .from('voice_memos')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (isMounted) {
          setMemos(data || []);
        }
      } catch (err) {
        console.error('Error fetching voice memos:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMemos();

    return () => {
      isMounted = false;
      // Stop recording if panel unmounts
      if (recorderRef.current) {
        recorderRef.current.destroy();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [projectId]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicPermission('granted');

      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder, // safe default for browsers
        numberOfAudioChannels: 1,
      });

      recorderRef.current = recorder;
      recorder.startRecording();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Microphone access denied or error:', err);
      setMicPermission('denied');
    }
  };

  const handleStopRecording = () => {
    const recorder = recorderRef.current;
    const stream = streamRef.current;

    if (!recorder) return;

    recorder.stopRecording(async () => {
      setIsRecording(false);
      
      const blob = recorder.getBlob();
      
      // Stop media tracks
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Generate object URL for optimistic card rendering
      const objectUrl = URL.createObjectURL(blob);
      const tempId = `temp-${Date.now()}`;
      
      const optimisticMemo: VoiceMemo = {
        id: tempId,
        project_id: projectId,
        audio_url: objectUrl,
        created_at: new Date().toISOString(),
        isOptimistic: true,
      };

      // Add to memos immediately
      setMemos((prev) => [optimisticMemo, ...prev]);

      // Upload to Supabase Storage & Database in the background
      try {
        const uniqueFilename = `memo_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
        const storagePath = `audio/${uniqueFilename}`;

        // 1. Upload to Supabase storage bucket
        const { error: uploadError } = await supabase.storage
          .from('audio')
          .upload(storagePath, blob, {
            contentType: 'audio/webm',
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        // 2. Get Public URL
        const { data: urlData } = supabase.storage
          .from('audio')
          .getPublicUrl(storagePath);

        if (!urlData?.publicUrl) {
          throw new Error('Failed to retrieve public audio URL.');
        }

        // 3. Save to database
        const { data: dbMemo, error: dbError } = await supabase
          .from('voice_memos')
          .insert({
            project_id: projectId,
            audio_url: urlData.publicUrl,
          })
          .select()
          .single();

        if (dbError) {
          throw dbError;
        }

        // Replace optimistic memo with actual database record
        setMemos((prev) =>
          prev.map((m) => (m.id === tempId ? { ...dbMemo } : m))
        );
      } catch (err: any) {
        console.error('Failed to save voice memo:', err);
        alert('Failed to save voice memo: ' + (err.message || String(err)));
        // Remove optimistic memo from list on error
        setMemos((prev) => prev.filter((m) => m.id !== tempId));
      }
    });
  };

  const handlePlayToggle = (id: string) => {
    setCurrentlyPlayingId((prev) => (prev === id ? null : id));
  };

  const handleDeleteMemo = (id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id));
    if (currentlyPlayingId === id) {
      setCurrentlyPlayingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent text-ink relative select-none">
      {/* Recording Control Card */}
      <div className="p-4 border-b border-paper-darker flex flex-col items-center gap-3 bg-paper-dark/20 flex-shrink-0">
        {micPermission === 'denied' && (
          <div className="w-full flex items-start gap-2 bg-amber-light border border-[#F5DDA8] text-ink p-2.5 rounded text-xs leading-normal mb-1">
            <AlertCircle className="w-4 h-4 text-amber-DEFAULT flex-shrink-0 mt-0.5" />
            <span>Microphone permission denied. Please enable mic access in your browser settings to record.</span>
          </div>
        )}

        <div className="relative flex flex-col items-center">
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-md border ${
              isRecording
                ? 'bg-terracotta border-terracotta text-white animate-pulse'
                : 'bg-paper hover:bg-paper-darker text-terracotta border-paper-darker hover:border-paper-darkest'
            } cursor-pointer`}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
            aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecording ? (
              <Square className="w-6 h-6 fill-current stroke-[1.5]" />
            ) : (
              <Mic className="w-7 h-7 stroke-[1.5]" />
            )}
          </button>

          {isRecording && (
            <span className="absolute -bottom-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terracotta opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-terracotta"></span>
            </span>
          )}
        </div>

        <span className="text-xs font-semibold text-ink-muted">
          {isRecording ? 'Recording (Click to stop)' : 'Record Voice Memo'}
        </span>
      </div>

      {/* Scrollable list of voice memos */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-ink-light py-8">
          <Loader2 className="w-5 h-5 animate-spin text-terracotta mb-2" />
          <span className="font-serif italic text-xs">Loading Voice Memos...</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 gap-3 paper-lines">
          {memos.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-center text-ink-light px-4">
              <span className="font-serif italic text-xs">No voice memos recorded yet.</span>
            </div>
          ) : (
            memos.map((memo) => (
              <VoiceMemoCard
                key={memo.id}
                memo={memo}
                isPlaying={currentlyPlayingId === memo.id}
                onPlayToggle={() => handlePlayToggle(memo.id)}
                onDelete={handleDeleteMemo}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
