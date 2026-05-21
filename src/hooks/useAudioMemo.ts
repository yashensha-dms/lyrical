import { useState, useEffect, useCallback } from 'react';
import { getLocalAudio, saveLocalAudio, deleteLocalAudio } from '../utils/indexedDb';

interface AudioMemo {
  audioData: string; // Base64 data URI
  duration: number;
  mimeType: string;
}

export function useAudioMemo(
  draftId: string | undefined,
  isCloudMode: boolean,
  onAudioChange?: (hasAudio: boolean) => void
) {
  const [audioMemo, setAudioMemo] = useState<AudioMemo | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAudio = useCallback(async () => {
    if (!draftId) {
      setAudioMemo(null);
      return;
    }

    setLoading(true);
    let loaded = false;

    if (isCloudMode) {
      try {
        const res = await fetch(`/api/drafts/${draftId}/audio`);
        if (res.ok) {
          const data = await res.json();
          setAudioMemo({
            audioData: data.audioData,
            duration: data.duration,
            mimeType: data.mimeType
          });
          loaded = true;
        }
      } catch (e) {
        console.error('Failed to load cloud audio, checking local database...', e);
      }
    }

    if (!loaded) {
      try {
        const local = await getLocalAudio(draftId);
        if (local) {
          setAudioMemo({
            audioData: local.audioData,
            duration: local.duration,
            mimeType: local.mimeType
          });
        } else {
          setAudioMemo(null);
        }
      } catch (e) {
        console.error('Failed to load local audio', e);
        setAudioMemo(null);
      }
    }
    setLoading(false);
  }, [draftId, isCloudMode]);

  // Load audio when draft changes
  useEffect(() => {
    loadAudio();
  }, [loadAudio]);

  const saveAudio = useCallback(async (audioData: string, duration: number, mimeType: string) => {
    if (!draftId) return;

    setLoading(true);
    // 1. Save locally to IndexedDB as backup/primary
    try {
      await saveLocalAudio(draftId, audioData, duration, mimeType);
    } catch (e) {
      console.error('Failed to save audio to IndexedDB', e);
    }

    // 2. Save to cloud server if online
    if (isCloudMode) {
      try {
        await fetch(`/api/drafts/${draftId}/audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioData, duration, mimeType })
        });
      } catch (e) {
        console.error('Failed to sync audio to cloud server', e);
      }
    }

    setAudioMemo({ audioData, duration, mimeType });
    if (onAudioChange) onAudioChange(true);
    setLoading(false);
  }, [draftId, isCloudMode, onAudioChange]);

  const deleteAudio = useCallback(async () => {
    if (!draftId) return;

    setLoading(true);
    // 1. Delete locally from IndexedDB
    try {
      await deleteLocalAudio(draftId);
    } catch (e) {
      console.error('Failed to delete audio from IndexedDB', e);
    }

    // 2. Delete from cloud server if online
    if (isCloudMode) {
      try {
        await fetch(`/api/drafts/${draftId}/audio`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to delete cloud audio', e);
      }
    }

    setAudioMemo(null);
    if (onAudioChange) onAudioChange(false);
    setLoading(false);
  }, [draftId, isCloudMode, onAudioChange]);

  return {
    audioMemo,
    loading,
    saveAudio,
    deleteAudio,
    reloadAudio: loadAudio
  };
}
