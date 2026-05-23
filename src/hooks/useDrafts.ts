import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getLocalDrafts, saveLocalDraft, deleteLocalDraft, getLocalAudios, getLocalAudioCount } from '../utils/indexedDb';

export interface Draft {
  id: string;
  title: string;           // Pinned Title Vault
  content: string;         // Lyric lines
  targetTemplate: string;  // Syllables schema (e.g. "8-6-8-6")
  scrapbook: string;       // Method songwriting scrapbook notes
  audioCount: number;      // Number of voice recordings
  syllableTolerance?: number;
  createdAt: number;
  updatedAt: number;
}

const ACTIVE_DRAFT_KEY = 'lyrical_active_draft_id_v2';

// Generate a stable client ID for this browser session
const CLIENT_ID = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
      audioCount: 0,
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

  const draftsRef = useRef(drafts);
  const isEditorFocusedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsRoomRef = useRef<string | null>(null);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const isCloudMode = healthStatus === 'connected' && !useLocalMode;
  const isCloudModeRef = useRef(isCloudMode);
  useEffect(() => { isCloudModeRef.current = isCloudMode; }, [isCloudMode]);

  const setUseLocalMode = useCallback((val: boolean) => {
    setUseLocalModeState(val);
    localStorage.setItem('lyrical_use_local_mode', String(val));
  }, []);

  const setIsEditorFocused = useCallback((v: boolean) => {
    isEditorFocusedRef.current = v;
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const intentionalCloseRef = useRef(false);

  const connectWs = useCallback((draftId: string) => {
    // Already connected to this exact room — do nothing
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      wsRoomRef.current === draftId
    ) {
      return;
    }

    // Close previous connection intentionally
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    intentionalCloseRef.current = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    wsRoomRef.current = draftId;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', draftId, clientId: CLIENT_ID }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'update' && msg.draftId === wsRoomRef.current) {
          setDrafts(prev =>
            prev.map(d => {
              if (d.id !== msg.draftId) return d;
              return {
                ...d,
                ...(msg.title !== undefined && { title: msg.title }),
                ...(msg.content !== undefined && { content: msg.content }),
                ...(msg.scrapbook !== undefined && { scrapbook: msg.scrapbook }),
                ...(msg.targetTemplate !== undefined && { targetTemplate: msg.targetTemplate }),
                ...(msg.syllableTolerance !== undefined && { syllableTolerance: msg.syllableTolerance }),
                updatedAt: msg.updatedAt ?? Date.now(),
              };
            })
          );
        }
      } catch (e) {
        console.error('WS message parse error:', e);
      }
    };

    ws.onclose = () => {
      // Only auto-reconnect if this was NOT an intentional close
      if (!intentionalCloseRef.current && isCloudModeRef.current && wsRoomRef.current) {
        const roomToReconnect = wsRoomRef.current;
        setTimeout(() => {
          // Double-check we still want to be connected
          if (isCloudModeRef.current && wsRoomRef.current === roomToReconnect) {
            connectWs(roomToReconnect);
          }
        }, 3000);
      }
    };

    ws.onerror = () => {
      // Error will be followed by onclose; no extra action needed
    };
  }, []);

  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
      wsRoomRef.current = null;
    }
  }, []);

  // Broadcast local change to collaborators
  const broadcastUpdate = useCallback((draft: Draft) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'update',
        draftId: draft.id,
        clientId: CLIENT_ID,
        title: draft.title,
        content: draft.content,
        scrapbook: draft.scrapbook,
        targetTemplate: draft.targetTemplate,
        syllableTolerance: draft.syllableTolerance,
        updatedAt: draft.updatedAt,
      }));
    }
  }, []);

  // Connect/disconnect WS when cloud mode or active draft changes
  useEffect(() => {
    if (isCloudMode && activeDraftId) {
      connectWs(activeDraftId);
    } else {
      disconnectWs();
    }

    return () => {
      // Don't disconnect on every re-render, only when truly unmounting
    };
  }, [isCloudMode, activeDraftId, connectWs, disconnectWs]);

  // Cleanup WS on unmount
  useEffect(() => {
    return () => disconnectWs();
  }, [disconnectWs]);

  // ── Health check ───────────────────────────────────────────────────────────
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

  // ── Load drafts ────────────────────────────────────────────────────────────
  const loadDrafts = useCallback(async (initialDraftId?: string | null) => {
    setIsSaving(true);

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
    let loaded: Draft[] = [];

    if (cloudActive) {
      try {
        const res = await fetch('/api/drafts');
        if (res.ok) {
          const data = await res.json();
          loaded = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            content: d.content,
            targetTemplate: d.targetTemplate,
            scrapbook: d.scrapbook,
            audioCount: d.audioCount || 0,
            syllableTolerance: d.syllableTolerance ?? 1,
            createdAt: Date.parse(d.createdAt) || Date.now(),
            updatedAt: Date.parse(d.updatedAt) || Date.now()
          }));
        } else {
          throw new Error('Failed to fetch drafts from server');
        }
      } catch (e) {
        console.error('Failed to load drafts from server, falling back to local database', e);
        const local = await getLocalDrafts();
        loaded = await Promise.all(local.map(async d => ({
          id: d.id,
          title: d.title,
          content: d.content,
          scrapbook: d.scrapbook,
          targetTemplate: d.targetTemplate,
          audioCount: d.audioCount !== undefined ? d.audioCount : await getLocalAudioCount(d.id),
          syllableTolerance: d.syllableTolerance ?? 1,
          createdAt: Date.parse(d.createdAt) || Date.now(),
          updatedAt: d.updatedAt ? Date.parse(d.updatedAt) : Date.now()
        })));
        if (loaded.length === 0) loaded = DEFAULT_DRAFTS;
      }
    } else {
      // Local (IndexedDB)
      try {
        const local = await getLocalDrafts();
        if (local.length === 0) {
          for (const d of DEFAULT_DRAFTS) {
            await saveLocalDraft({
              id: d.id,
              title: d.title,
              content: d.content,
              scrapbook: d.scrapbook,
              targetTemplate: d.targetTemplate,
              audioCount: d.audioCount,
              syllableTolerance: d.syllableTolerance,
              createdAt: new Date(d.createdAt).toISOString(),
              updatedAt: new Date(d.updatedAt).toISOString()
            });
          }
          loaded = DEFAULT_DRAFTS;
        } else {
          loaded = await Promise.all(local.map(async d => ({
            id: d.id,
            title: d.title,
            content: d.content,
            scrapbook: d.scrapbook,
            targetTemplate: d.targetTemplate,
            audioCount: d.audioCount !== undefined ? d.audioCount : await getLocalAudioCount(d.id),
            syllableTolerance: d.syllableTolerance ?? 1,
            createdAt: Date.parse(d.createdAt) || Date.now(),
            updatedAt: d.updatedAt ? Date.parse(d.updatedAt) : Date.now()
          })));
        }
      } catch (e) {
        console.error('IndexedDB load failed', e);
        loaded = DEFAULT_DRAFTS;
      }
    }

    setDrafts(loaded);

    // Determine which draft to activate
    // Priority: URL-provided ID > last active > first in list
    if (initialDraftId && loaded.some(d => d.id === initialDraftId)) {
      setActiveDraftId(initialDraftId);
    } else if (initialDraftId && cloudActive) {
      // Try fetching a draft from server that's not in our list (shared link)
      try {
        const res = await fetch(`/api/drafts/${initialDraftId}`);
        if (res.ok) {
          const d = await res.json();
          const sharedDraft: Draft = {
            id: d.id,
            title: d.title,
            content: d.content,
            targetTemplate: d.targetTemplate,
            scrapbook: d.scrapbook,
            audioCount: d.audioCount || 0,
            syllableTolerance: d.syllableTolerance ?? 1,
            createdAt: Date.parse(d.createdAt) || Date.now(),
            updatedAt: Date.parse(d.updatedAt) || Date.now()
          };
          setDrafts(prev => {
            const exists = prev.findIndex(x => x.id === sharedDraft.id);
            if (exists > -1) return prev.map(x => x.id === sharedDraft.id ? sharedDraft : x);
            return [sharedDraft, ...prev];
          });
          setActiveDraftId(sharedDraft.id);
        } else {
          // Draft not found — fall back to first
          const savedActive = localStorage.getItem(ACTIVE_DRAFT_KEY);
          if (savedActive && loaded.some(d => d.id === savedActive)) {
            setActiveDraftId(savedActive);
          } else {
            setActiveDraftId(loaded[0]?.id || null);
          }
        }
      } catch {
        setActiveDraftId(loaded[0]?.id || null);
      }
    } else {
      const savedActive = localStorage.getItem(ACTIVE_DRAFT_KEY);
      if (savedActive && loaded.some(d => d.id === savedActive)) {
        setActiveDraftId(savedActive);
      } else if (loaded.length > 0) {
        setActiveDraftId(loaded[0].id);
      } else {
        setActiveDraftId(null);
      }
    }

    setIsSaving(false);
  }, [useLocalMode]);

  // Initial load (called from App with URL draft ID)
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

  const activeDraft = useMemo(() => {
    return drafts.find(d => d.id === activeDraftId) || null;
  }, [drafts, activeDraftId]);

  // ── Auto-save + WS broadcast on change ────────────────────────────────────
  useEffect(() => {
    if (!activeDraft) return;

    setIsSaving(true);
    const draft = { ...activeDraft, updatedAt: Date.now() };

    // Broadcast immediately over WS (real-time feel)
    broadcastUpdate(draft);

    const timer = setTimeout(async () => {
      if (isCloudModeRef.current) {
        try {
          const res = await fetch(`/api/drafts/${draft.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: draft.title,
              content: draft.content,
              scrapbook: draft.scrapbook,
              targetTemplate: draft.targetTemplate,
              syllableTolerance: draft.syllableTolerance ?? 1
            })
          });
          if (!res.ok) throw new Error('Cloud save failed');
        } catch (e) {
          console.error('Failed to save to cloud, writing locally', e);
          await saveLocalDraft({
            ...draft,
            createdAt: new Date(draft.createdAt).toISOString(),
            updatedAt: new Date(draft.updatedAt).toISOString()
          });
        }
      } else {
        await saveLocalDraft({
          ...draft,
          createdAt: new Date(draft.createdAt).toISOString(),
          updatedAt: new Date(draft.updatedAt).toISOString()
        });
      }
      setIsSaving(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [
    activeDraft?.title,
    activeDraft?.content,
    activeDraft?.scrapbook,
    activeDraft?.targetTemplate,
    activeDraft?.syllableTolerance,
    activeDraft?.audioCount,
    broadcastUpdate,
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
      audioCount: 0,
      syllableTolerance: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setDrafts(prev => [newDraft, ...prev]);
    setActiveDraftId(newDraft.id);

    if (isCloudModeRef.current) {
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
  }, []);

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

    if (isCloudModeRef.current) {
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
  }, [activeDraftId, drafts]);

  const syncLocalToCloud = useCallback(async () => {
    setIsSaving(true);
    try {
      const local = await getLocalDrafts();
      if (local.length === 0) {
        setUseLocalMode(false);
        await checkHealth();
        return;
      }

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
        for (const draft of local) {
          if (draft.audioCount > 0) {
            const localAudios = await getLocalAudios(draft.id);
            for (const localAudio of localAudios) {
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

        const reloadRes = await fetch('/api/drafts');
        if (reloadRes.ok) {
          const data = await reloadRes.json();
          const loaded: Draft[] = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            content: d.content,
            targetTemplate: d.targetTemplate,
            scrapbook: d.scrapbook,
            audioCount: d.audioCount || 0,
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

          for (const d of validDrafts) {
            const dToSave = { ...d, updatedAt: Date.now() };
            if (isCloudModeRef.current) {
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
  }, []);

  // Legacy: kept for backward compat (no-op now since WS handles sync)
  const syncActiveDraftWithRemote = useCallback(async () => {}, []);

  return {
    drafts,
    activeDraft,
    activeDraftId,
    isSaving,
    healthStatus,
    useLocalMode,
    isCloudMode,
    remoteDraft: null,         // No longer used — WS handles live sync
    isEditorFocused: false,
    setIsEditorFocused,
    syncActiveDraftWithRemote,
    setUseLocalMode,
    checkHealth,
    selectDraft,
    createDraft,
    updateActiveDraft,
    deleteDraft,
    syncLocalToCloud,
    exportAllDrafts,
    importDrafts,
    loadDrafts,
  };
}
