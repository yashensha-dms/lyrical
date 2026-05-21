import { useState, useEffect, useCallback, useMemo } from 'react';
import { getLocalDrafts, saveLocalDraft, deleteLocalDraft, getLocalAudio } from '../utils/indexedDb';

export interface Draft {
  id: string;
  title: string;           // Pinned Title Vault
  content: string;         // Lyric lines
  targetTemplate: string;  // Syllables schema (e.g. "8-6-8-6")
  scrapbook: string;       // Method songwriting scrapbook notes
  hasAudio: boolean;       // Flag indicating if voice demo exists
  syllableTolerance?: number;
  createdAt: number;
  updatedAt: number;
}

const ACTIVE_DRAFT_KEY = 'lyrical_active_draft_id_v2';

const DEFAULT_DRAFTS: Draft[] = [
  {
    id: 'welcome-draft',
    title: 'Dancing in the Static',
    content: `[Verse 1]
We talk in circles through the night
Watch the colors fade to gray
You whisper words to make it right
But you've got nothing left to say

[Chorus]
We're just dancing in the static
Hoping for a spark of light
Yeah it's tragic and dramatic
But we're holding on tonight`,
    targetTemplate: '8-7-8-7\n8-7-8-7',
    scrapbook: `CONCEPT & OBSERVATIONS:
- Overheard phrase at coffee shop: "We're just dancing in the static."
- Vibe: Melancholic but driving. Mid-tempo synth-pop.
- Key: A minor / BPM: 112.

SONG ASSISTANT NOTES:
- The singer told me they feel like they are just waiting for a signal that never comes. Use "reception", "signal", "radio frequency" metaphors in Verse 2.`,
    hasAudio: false,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  }
];

export function useDrafts() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [useLocalMode, setUseLocalModeState] = useState<boolean>(() => {
    return localStorage.getItem('lyrical_use_local_mode') === 'true';
  });

  const isCloudMode = healthStatus === 'connected' && !useLocalMode;

  // Save local mode state to storage
  const setUseLocalMode = useCallback((val: boolean) => {
    setUseLocalModeState(val);
    localStorage.setItem('lyrical_use_local_mode', String(val));
  }, []);

  // Ping backend database health
  const checkHealth = useCallback(async (): Promise<boolean> => {
    setHealthStatus('checking');
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.database === 'connected') {
        setHealthStatus('connected');
        return true;
      } else {
        setHealthStatus('disconnected');
        return false;
      }
    } catch (e) {
      setHealthStatus('disconnected');
      return false;
    }
  }, []);

  // Load drafts on mount or when mode changes
  const loadDrafts = useCallback(async () => {
    setIsSaving(true);
    
    // Attempt health check first
    let dbConnected = false;
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      dbConnected = data.database === 'connected';
      setHealthStatus(dbConnected ? 'connected' : 'disconnected');
    } catch (e) {
      setHealthStatus('disconnected');
    }

    const cloudActive = dbConnected && !useLocalMode;

    if (cloudActive) {
      try {
        const res = await fetch('/api/drafts');
        if (res.ok) {
          const data = await res.json();
          const loaded: Draft[] = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            content: d.content,
            targetTemplate: d.targetTemplate,
            scrapbook: d.scrapbook,
            hasAudio: d.hasAudio || false,
            syllableTolerance: d.syllableTolerance ?? 1,
            createdAt: Date.parse(d.createdAt) || Date.now(),
            updatedAt: Date.parse(d.updatedAt) || Date.now()
          }));
          
          setDrafts(loaded);
          
          const savedActive = localStorage.getItem(ACTIVE_DRAFT_KEY);
          if (savedActive && loaded.some(d => d.id === savedActive)) {
            setActiveDraftId(savedActive);
          } else if (loaded.length > 0) {
            setActiveDraftId(loaded[0].id);
          } else {
            setActiveDraftId(null);
          }
        } else {
          throw new Error('Failed to fetch drafts from server');
        }
      } catch (e) {
        console.error('Failed to load drafts from server, falling back to local database', e);
        const local = await getLocalDrafts();
        const mappedLocal: Draft[] = local.map(d => ({
          id: d.id,
          title: d.title,
          content: d.content,
          scrapbook: d.scrapbook,
          targetTemplate: d.targetTemplate,
          hasAudio: d.hasAudio || false,
          syllableTolerance: d.syllableTolerance ?? 1,
          createdAt: Date.parse(d.createdAt) || Date.now(),
          updatedAt: d.updatedAt ? Date.parse(d.updatedAt) : Date.now()
        }));
        setDrafts(mappedLocal.length > 0 ? mappedLocal : DEFAULT_DRAFTS);
      }
    } else {
      // Local Database (IndexedDB)
      try {
        const local = await getLocalDrafts();
        let loaded: Draft[] = [];
        if (local.length === 0) {
          // Seed IndexedDB with the default draft
          for (const d of DEFAULT_DRAFTS) {
            await saveLocalDraft({
              id: d.id,
              title: d.title,
              content: d.content,
              scrapbook: d.scrapbook,
              targetTemplate: d.targetTemplate,
              hasAudio: d.hasAudio,
              syllableTolerance: d.syllableTolerance,
              createdAt: new Date(d.createdAt).toISOString(),
              updatedAt: new Date(d.updatedAt).toISOString()
            });
          }
          loaded = DEFAULT_DRAFTS;
        } else {
          loaded = local.map(d => ({
            id: d.id,
            title: d.title,
            content: d.content,
            scrapbook: d.scrapbook,
            targetTemplate: d.targetTemplate,
            hasAudio: d.hasAudio || false,
            syllableTolerance: d.syllableTolerance ?? 1,
            createdAt: Date.parse(d.createdAt) || Date.now(),
            updatedAt: d.updatedAt ? Date.parse(d.updatedAt) : Date.now()
          }));
        }
        setDrafts(loaded);
        
        const savedActive = localStorage.getItem(ACTIVE_DRAFT_KEY);
        if (savedActive && loaded.some(d => d.id === savedActive)) {
          setActiveDraftId(savedActive);
        } else if (loaded.length > 0) {
          setActiveDraftId(loaded[0].id);
        } else {
          setActiveDraftId(null);
        }
      } catch (e) {
        console.error('IndexedDB load failed', e);
        setDrafts(DEFAULT_DRAFTS);
      }
    }
    setIsSaving(false);
  }, [useLocalMode]);

  // Initial load
  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // Sync active draft ID to localStorage
  useEffect(() => {
    if (activeDraftId) {
      localStorage.setItem(ACTIVE_DRAFT_KEY, activeDraftId);
    } else {
      localStorage.removeItem(ACTIVE_DRAFT_KEY);
    }
  }, [activeDraftId]);

  // Get currently active draft
  const activeDraft = useMemo(() => {
    return drafts.find(d => d.id === activeDraftId) || drafts[0] || null;
  }, [drafts, activeDraftId]);

  // Debounced auto-save for changes on the active draft
  useEffect(() => {
    if (!activeDraft) return;

    setIsSaving(true);
    const timer = setTimeout(async () => {
      const draftToSave = { ...activeDraft, updatedAt: Date.now() };
      
      if (isCloudMode) {
        try {
          const res = await fetch(`/api/drafts/${draftToSave.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: draftToSave.title,
              content: draftToSave.content,
              scrapbook: draftToSave.scrapbook,
              targetTemplate: draftToSave.targetTemplate,
              syllableTolerance: draftToSave.syllableTolerance ?? 1
            })
          });
          if (!res.ok) throw new Error('Cloud save failed');
        } catch (e) {
          console.error('Failed to save to cloud server, writing locally', e);
          await saveLocalDraft({
            ...draftToSave,
            createdAt: new Date(draftToSave.createdAt).toISOString(),
            updatedAt: new Date(draftToSave.updatedAt).toISOString()
          });
        }
      } else {
        await saveLocalDraft({
          ...draftToSave,
          createdAt: new Date(draftToSave.createdAt).toISOString(),
          updatedAt: new Date(draftToSave.updatedAt).toISOString()
        });
      }
      setIsSaving(false);
    }, 600); // Debounce editor strokes by 600ms

    return () => clearTimeout(timer);
  }, [
    activeDraft?.title,
    activeDraft?.content,
    activeDraft?.scrapbook,
    activeDraft?.targetTemplate,
    activeDraft?.syllableTolerance,
    activeDraft?.hasAudio,
    isCloudMode
  ]);

  const selectDraft = useCallback((id: string) => {
    if (drafts.some(d => d.id === id)) {
      setActiveDraftId(id);
    }
  }, [drafts]);

  const createDraft = useCallback(async (title: string = 'Untitled Song') => {
    const newDraft: Draft = {
      id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      content: '',
      targetTemplate: '',
      scrapbook: '',
      hasAudio: false,
      syllableTolerance: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setDrafts(prev => [newDraft, ...prev]);
    setActiveDraftId(newDraft.id);

    if (isCloudMode) {
      try {
        const res = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newDraft)
        });
        if (!res.ok) throw new Error('Cloud create failed');
      } catch (e) {
        console.error('Failed to create draft on cloud, writing locally', e);
        await saveLocalDraft({
          ...newDraft,
          createdAt: new Date(newDraft.createdAt).toISOString(),
          updatedAt: new Date(newDraft.updatedAt).toISOString()
        });
      }
    } else {
      await saveLocalDraft({
        ...newDraft,
        createdAt: new Date(newDraft.createdAt).toISOString(),
        updatedAt: new Date(newDraft.updatedAt).toISOString()
      });
    }

    return newDraft;
  }, [isCloudMode]);

  const updateActiveDraft = useCallback((updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => {
    if (!activeDraftId) return;
    setDrafts(prev =>
      prev.map(d =>
        d.id === activeDraftId
          ? { ...d, ...updates, updatedAt: Date.now() }
          : d
      )
    );
  }, [activeDraftId]);

  const deleteDraft = useCallback(async (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
    
    if (activeDraftId === id) {
      setActiveDraftId(drafts.find(d => d.id !== id)?.id || null);
    }

    if (isCloudMode) {
      try {
        const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Cloud delete failed');
      } catch (e) {
        console.error('Failed to delete on cloud, deleting locally', e);
        await deleteLocalDraft(id);
      }
    } else {
      await deleteLocalDraft(id);
    }
  }, [activeDraftId, drafts, isCloudMode]);

  // Bulk sync function to push IndexedDB changes to MongoDB when connecting
  const syncLocalToCloud = useCallback(async () => {
    setIsSaving(true);
    try {
      const local = await getLocalDrafts();
      if (local.length === 0) {
        setUseLocalMode(false);
        await checkHealth();
        return;
      }

      // Convert LocalDraft interface to Draft representation
      const formattedDrafts = local.map(d => ({
        id: d.id,
        title: d.title,
        content: d.content,
        scrapbook: d.scrapbook,
        targetTemplate: d.targetTemplate,
        syllableTolerance: d.syllableTolerance ?? 1
      }));

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drafts: formattedDrafts })
      });

      if (res.ok) {
        // Sync any recorded audio blobs
        for (const draft of local) {
          if (draft.hasAudio) {
            const localAudio = await getLocalAudio(draft.id);
            if (localAudio) {
              await fetch(`/api/drafts/${draft.id}/audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioData: localAudio.audioData,
                  duration: localAudio.duration,
                  mimeType: localAudio.mimeType
                })
              });
            }
          }
        }

        setUseLocalMode(false);
        setHealthStatus('connected');
        
        // Reload synced state from server
        const reloadRes = await fetch('/api/drafts');
        if (reloadRes.ok) {
          const data = await reloadRes.json();
          const loaded: Draft[] = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            content: d.content,
            targetTemplate: d.targetTemplate,
            scrapbook: d.scrapbook,
            hasAudio: d.hasAudio || false,
            syllableTolerance: d.syllableTolerance ?? 1,
            createdAt: Date.parse(d.createdAt) || Date.now(),
            updatedAt: Date.parse(d.updatedAt) || Date.now()
          }));
          setDrafts(loaded);
        }
      } else {
        throw new Error('Bulk sync server endpoint failed');
      }
    } catch (e) {
      console.error('Failed to sync to cloud', e);
      alert('Could not sync data to server. Please verify your connection.');
    } finally {
      setIsSaving(false);
    }
  }, [checkHealth, setUseLocalMode]);

  const exportAllDrafts = useCallback(() => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(drafts, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `lyrical_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error('Failed to export drafts', e);
    }
  }, [drafts]);

  const importDrafts = useCallback((jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        const validDrafts = parsed.filter(item => {
          return item.id && item.title !== undefined && item.content !== undefined;
        }) as Draft[];
        
        if (validDrafts.length > 0) {
          setDrafts(prev => {
            const existingIds = new Set(prev.map(d => d.id));
            const newUniqueDrafts = validDrafts.filter(d => !existingIds.has(d.id));
            return [...newUniqueDrafts, ...prev];
          });
          if (validDrafts[0]) {
            setActiveDraftId(validDrafts[0].id);
          }
          
          // Also save them locally/server
          for (const d of validDrafts) {
            const dToSave = { ...d, updatedAt: Date.now() };
            if (isCloudMode) {
              fetch(`/api/drafts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dToSave)
              }).catch(err => console.error('Import sync error', err));
            }
            saveLocalDraft({
              ...dToSave,
              createdAt: new Date(dToSave.createdAt).toISOString(),
              updatedAt: new Date(dToSave.updatedAt).toISOString()
            }).catch(err => console.error('Import local error', err));
          }
          return true;
        }
      }
    } catch (e) {
      console.error('Failed to import drafts', e);
    }
    return false;
  }, [isCloudMode]);

  return {
    drafts,
    activeDraft,
    activeDraftId,
    isSaving,
    healthStatus,
    useLocalMode,
    isCloudMode,
    setUseLocalMode,
    checkHealth,
    selectDraft,
    createDraft,
    updateActiveDraft,
    deleteDraft,
    syncLocalToCloud,
    exportAllDrafts,
    importDrafts,
    loadDrafts
  };
}
