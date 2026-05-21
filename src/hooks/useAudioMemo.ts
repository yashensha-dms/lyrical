import { useState, useEffect, useCallback } from 'react';
import { getLocalAudios, getLocalAudio, saveLocalAudio, deleteLocalAudio } from '../utils/indexedDb';

export interface AudioMemo {
  id: string;
  audioData: string;
  duration: number;
  mimeType: string;
  createdAt: string;
}

export function useAudioMemo(
  draftId: string | undefined,
  isCloudMode: boolean,
  onAudioChange?: (audioCount: number) => void
) {
  const [audioMemos, setAudioMemos] = useState<AudioMemo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAudios = useCallback(async () => {
    if (!draftId) {
      setAudioMemos([]);
      return;
    }

    setLoading(true);
    let loaded = false;

    const sorted = (list: AudioMemo[]) =>
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (isCloudMode) {
      try {
        const res = await fetch(`/api/drafts/${draftId}/audios`);
        if (res.ok) {
          const list = await res.json();
          const memos: AudioMemo[] = list.map((m: any) => ({
            id: m.id,
            audioData: '',
            duration: m.duration,
            mimeType: m.mimeType,
            createdAt: m.createdAt,
          }));
          setAudioMemos(sorted(memos));
          loaded = true;
        }
      } catch (e) {
        console.error('Failed to load cloud audio list, checking local database...', e);
      }
    }

    if (!loaded) {
      try {
        const local = await getLocalAudios(draftId);
        setAudioMemos(sorted(local.map(a => ({
          id: a.id,
          audioData: a.audioData,
          duration: a.duration,
          mimeType: a.mimeType,
          createdAt: a.createdAt,
        }))));
      } catch (e) {
        console.error('Failed to load local audios', e);
        setAudioMemos([]);
      }
    }
    setLoading(false);
  }, [draftId, isCloudMode]);

  useEffect(() => {
    loadAudios();
  }, [loadAudios]);

  const loadAudioData = useCallback(async (audioId: string): Promise<AudioMemo | null> => {
    if (!draftId) return null;

    if (isCloudMode) {
      try {
        const res = await fetch(`/api/drafts/${draftId}/audio/${audioId}`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.error('Failed to load cloud audio data', e);
      }
    }

    try {
      const local = await getLocalAudio(audioId);
      if (local) {
        return {
          id: local.id,
          audioData: local.audioData,
          duration: local.duration,
          mimeType: local.mimeType,
          createdAt: local.createdAt,
        };
      }
    } catch (e) {
      console.error('Failed to load local audio data', e);
    }
    return null;
  }, [draftId, isCloudMode]);

  const saveAudio = useCallback(async (audioData: string, duration: number, mimeType: string) => {
    if (!draftId) return;

    setLoading(true);
    const audioId = `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

    try {
      await saveLocalAudio(audioId, draftId, audioData, duration, mimeType, createdAt);
    } catch (e) {
      console.error('Failed to save audio to IndexedDB', e);
    }

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

    const newMemo: AudioMemo = { id: audioId, audioData, duration, mimeType, createdAt };
    setAudioMemos(prev => [newMemo, ...prev]);
    if (onAudioChange) onAudioChange(audioMemos.length + 1);
    setLoading(false);
  }, [draftId, isCloudMode, onAudioChange, audioMemos.length]);

  const deleteAudio = useCallback(async (audioId: string) => {
    if (!draftId) return;

    setLoading(true);

    try {
      await deleteLocalAudio(audioId);
    } catch (e) {
      console.error('Failed to delete audio from IndexedDB', e);
    }

    if (isCloudMode) {
      try {
        await fetch(`/api/drafts/${draftId}/audio/${audioId}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to delete cloud audio', e);
      }
    }

    const newList = audioMemos.filter(m => m.id !== audioId);
    setAudioMemos(newList);
    if (onAudioChange) onAudioChange(newList.length);
    setLoading(false);
  }, [draftId, isCloudMode, onAudioChange, audioMemos]);

  return {
    audioMemos,
    loading,
    saveAudio,
    deleteAudio,
    loadAudioData,
    reloadAudio: loadAudios
  };
}
