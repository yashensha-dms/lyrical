import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
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
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const wsRoomRef = useRef<string | null>(null);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const isCloudMode = !useLocalMode;
  const isCloudModeRef = useRef(isCloudMode);
  useEffect(() => { isCloudModeRef.current = isCloudMode; }, [isCloudMode]);

  const setUseLocalMode = useCallback((val: boolean) => {
    setUseLocalModeState(val);
    localStorage.setItem('lyrical_use_local_mode', String(val));
  }, []);

  const setIsEditorFocused = useCallback((v: boolean) => {
    isEditorFocusedRef.current = v;
  }, []);

  // ── Yjs Collaboration ──────────────────────────────────────────────────────
  const disconnectWs = useCallback(() => {
    setProvider(prev => {
      if (prev) prev.destroy();
      return null;
    });
    setYDoc(prev => {
      if (prev) prev.destroy();
      return null;
    });
    wsRoomRef.current = null;
  }, []);

  const connectWs = useCallback((draftId: string) => {
    // Already connected to this exact room — do nothing
    if (
      wsRoomRef.current === draftId
    ) {
      return;
    }

    // Close previous connection
    disconnectWs();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ydoc = new Y.Doc();
    setYDoc(ydoc);

    const providerInstance = new WebsocketProvider(wsUrl, draftId, ydoc);
    setProvider(providerInstance);
    wsRoomRef.current = draftId;

    providerInstance.on('status', (event: any) => {
      setHealthStatus(event.status === 'connected' ? 'connected' : 'disconnected');
    });

    const titleText = ydoc.getText('title');
    const contentText = ydoc.getText('content');
    const scrapbookText = ydoc.getText('scrapbook');
    const templateText = ydoc.getText('targetTemplate');
    const settingsMap = ydoc.getMap('settings');

    const colors = ['#E25C3D', '#2D7A56', '#7C4DB8', '#D97706', '#2563EB', '#DB2777', '#059669', '#78716C'];
    const clientID = providerInstance.awareness.clientID;
    const assignedColor = colors[clientID % colors.length];
    const assignedNumber = (clientID % 99) + 1;

    providerInstance.awareness.setLocalStateField('user', {
      name: `Writer ${assignedNumber}`,
      color: assignedColor
    });

    // Bidirectional sync handler from Yjs to React state
    const syncYjsToReact = () => {
      setDrafts(prev =>
        prev.map(d => {
          if (d.id !== draftId) return d;
          return {
            ...d,
            title: titleText.toString(),
            content: contentText.toString(),
            scrapbook: scrapbookText.toString(),
            targetTemplate: templateText.toString(),
            syllableTolerance: settingsMap.get('syllableTolerance') as number ?? 1,
            updatedAt: Date.now()
          };
        })
      );
    };

    ydoc.on('update', syncYjsToReact);

  }, [disconnectWs]);

  // Connect/disconnect WS when local mode setting or active draft changes
  useEffect(() => {
    if (!useLocalMode && activeDraftId) {
      connectWs(activeDraftId);
    } else {
      disconnectWs();
    }

    return () => {
      // Don't disconnect on every re-render, only when truly unmounting
    };
  }, [useLocalMode, activeDraftId, connectWs, disconnectWs]);

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

    let urlDraftIdToUse = initialDraftId;
    if (urlDraftIdToUse === undefined) {
      const parts = window.location.pathname.split('/');
      if (parts[1] === 'draft' && parts[2]) {
        urlDraftIdToUse = decodeURIComponent(parts[2]);
      } else {
        const searchParams = new URLSearchParams(window.location.search);
        urlDraftIdToUse = searchParams.get('share') || null;
      }
    }

    console.log('[loadDrafts] initialDraftId:', initialDraftId, 'urlDraftIdToUse:', urlDraftIdToUse, 'pathname:', window.location.pathname, 'search:', window.location.search);

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

          // Query IndexedDB local drafts to recover and sync local-only drafts
          try {
            const local = await getLocalDrafts();
            const serverIds = new Set(loaded.map(d => d.id));
            const localOnly = local.filter(d => d.id !== 'welcome-draft' && !serverIds.has(d.id));

            if (localOnly.length > 0) {
              console.log('Recovering and syncing local-only drafts:', localOnly);
              for (const draft of localOnly) {
                const formatted: Draft = {
                  id: draft.id,
                  title: draft.title,
                  content: draft.content,
                  scrapbook: draft.scrapbook,
                  targetTemplate: draft.targetTemplate,
                  syllableTolerance: draft.syllableTolerance ?? 1,
                  audioCount: draft.audioCount || 0,
                  createdAt: Date.parse(draft.createdAt) || Date.now(),
                  updatedAt: draft.updatedAt ? Date.parse(draft.updatedAt) : Date.now()
                };

                try {
                  const postRes = await fetch('/api/drafts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formatted)
                  });
                  if (postRes.ok) {
                    console.log(`Synced local draft "${draft.title}" to server.`);
                  }
                } catch (postErr) {
                  console.error(`Error uploading local draft "${draft.title}" to server:`, postErr);
                }

                loaded.push(formatted);
              }
            }
          } catch (localErr) {
            console.error('Error recovering local drafts:', localErr);
          }
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
    // Priority: URL-provided ID > null (empty/landing state)
    console.log('[loadDrafts] deciding activation. urlDraftIdToUse:', urlDraftIdToUse, 'loaded drafts count:', loaded.length);
    if (urlDraftIdToUse && loaded.some(d => d.id === urlDraftIdToUse)) {
      console.log('[loadDrafts] activating exists draft:', urlDraftIdToUse);
      setActiveDraftId(urlDraftIdToUse);
    } else if (urlDraftIdToUse && cloudActive) {
      // Try fetching a draft from server that's not in our list (shared link)
      try {
        console.log('[loadDrafts] draft not in list, fetching shared link:', urlDraftIdToUse);
        const res = await fetch(`/api/drafts/${urlDraftIdToUse}`);
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
          console.log('[loadDrafts] activating shared draft:', sharedDraft.id);
          setActiveDraftId(sharedDraft.id);
        } else {
          console.log('[loadDrafts] shared draft fetch failed, setting activeDraftId to null');
          setActiveDraftId(null);
        }
      } catch (err) {
        console.error('[loadDrafts] shared draft fetch error, setting activeDraftId to null', err);
        setActiveDraftId(null);
      }
    } else {
      console.log('[loadDrafts] no url draft, setting activeDraftId to null');
      // Always return to empty state (null) unless a specific project link is called
      setActiveDraftId(null);
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

    const timer = setTimeout(async () => {
      // Save locally as backup. In cloud mode, Yjs server auto-saves to MongoDB.
      // In local mode, this is our main save route.
      await saveLocalDraft({
        ...draft,
        createdAt: new Date(draft.createdAt).toISOString(),
        updatedAt: new Date(draft.updatedAt).toISOString()
      });
      setIsSaving(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    activeDraft?.title,
    activeDraft?.content,
    activeDraft?.scrapbook,
    activeDraft?.targetTemplate,
    activeDraft?.syllableTolerance,
    activeDraft?.audioCount,
  ]);

  const selectDraft = useCallback((id: string | null) => {
    if (id === null || id === '') {
      setActiveDraftId(null);
    } else if (drafts.some(d => d.id === id)) {
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

    if (isCloudModeRef.current && yDoc) {
      const ydoc = yDoc;
      ydoc.transact(() => {
        if (updates.title !== undefined) {
          const titleText = ydoc.getText('title');
          if (titleText.toString() !== updates.title) {
            titleText.delete(0, titleText.length);
            titleText.insert(0, updates.title);
          }
        }
        if (updates.content !== undefined) {
          const contentText = ydoc.getText('content');
          if (contentText.toString() !== updates.content) {
            contentText.delete(0, contentText.length);
            contentText.insert(0, updates.content);
          }
        }
        if (updates.scrapbook !== undefined) {
          const scrapbookText = ydoc.getText('scrapbook');
          if (scrapbookText.toString() !== updates.scrapbook) {
            scrapbookText.delete(0, scrapbookText.length);
            scrapbookText.insert(0, updates.scrapbook);
          }
        }
        if (updates.targetTemplate !== undefined) {
          const templateText = ydoc.getText('targetTemplate');
          if (templateText.toString() !== updates.targetTemplate) {
            templateText.delete(0, templateText.length);
            templateText.insert(0, updates.targetTemplate);
          }
        }
        if (updates.syllableTolerance !== undefined) {
          const settingsMap = ydoc.getMap('settings');
          if (settingsMap.get('syllableTolerance') !== updates.syllableTolerance) {
            settingsMap.set('syllableTolerance', updates.syllableTolerance);
          }
        }
      }, 'local-react-update');
    } else {
      setDrafts(prev =>
        prev.map(d =>
          d.id === activeDraftId
            ? { ...d, ...updates, updatedAt: Date.now() }
            : d
        )
      );
    }
  }, [activeDraftId, yDoc]);

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
    yDoc,
    provider,
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
