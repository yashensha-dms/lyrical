import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getLocalDrafts, saveLocalDraft, deleteLocalDraft } from '../utils/indexedDb';

export interface Draft {
  id: string;
  title: string;           // Project Title
  content: string;         // Lyric lines (handled by Yjs, empty initially)
  targetTemplate: string;  // Leftover/empty
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
    targetTemplate: '',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  }
];

export function useDrafts(session: any) {
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

  const isCloudMode = !useLocalMode && !!session;
  const isCloudModeRef = useRef(isCloudMode);
  useEffect(() => { isCloudModeRef.current = isCloudMode; }, [isCloudMode]);

  const setUseLocalMode = useCallback((val: boolean) => {
    setUseLocalModeState(val);
    localStorage.setItem('lyrical_use_local_mode', String(val));
  }, []);

  const setIsEditorFocused = useCallback((v: boolean) => {
    isEditorFocusedRef.current = v;
  }, []);

  // Get Auth headers helper
  const getAuthHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, [session]);

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
    if (wsRoomRef.current === draftId) {
      return;
    }

    disconnectWs();

    const token = session?.access_token;
    if (!token) {
      console.warn('[connectWs] No session token available for WebSocket connection.');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    // Pass JWT token as query parameter
    const roomName = `${draftId}?token=${encodeURIComponent(token)}`;
    
    const ydoc = new Y.Doc();
    setYDoc(ydoc);

    const providerInstance = new WebsocketProvider(wsUrl, roomName, ydoc);
    setProvider(providerInstance);
    wsRoomRef.current = draftId;

    providerInstance.on('status', (event: any) => {
      setHealthStatus(event.status === 'connected' ? 'connected' : 'disconnected');
    });

    const titleText = ydoc.getText('title');
    const contentText = ydoc.getText('content');
    const templateText = ydoc.getText('targetTemplate');
    const settingsMap = ydoc.getMap('settings');

    const colors = [
      '#E25C3D', '#2D7A56', '#7C4DB8', '#D97706', '#2563EB', '#DB2777', '#059669', '#78716C',
      '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
      '#EC4899', '#F43F5E', '#14B8A6', '#84CC16'
    ];
    const assignedColor = colors[Math.floor(Math.random() * colors.length)];

    const updateLocalUser = () => {
      const awareness = providerInstance.awareness;
      const states = Array.from(awareness.getStates().keys()).sort((a, b) => a - b);
      const index = states.indexOf(awareness.clientID);
      const writerNum = index >= 0 ? index + 1 : 1;

      const currentState = awareness.getLocalState();
      const newName = `Writer ${writerNum}`;

      if (!currentState?.user || currentState.user.name !== newName) {
        awareness.setLocalStateField('user', {
          name: newName,
          color: currentState?.user?.color || assignedColor
        });
      }
    };

    providerInstance.awareness.on('change', updateLocalUser);
    providerInstance.awareness.setLocalStateField('user', {
      name: 'Writer 1',
      color: assignedColor
    });
    updateLocalUser();

    // Bidirectional sync handler from Yjs to React state
    const syncYjsToReact = () => {
      setDrafts(prev =>
        prev.map(d => {
          if (d.id !== draftId) return d;
          return {
            ...d,
            title: titleText.toString(),
            content: contentText.toString(),
            targetTemplate: templateText.toString(),
            syllableTolerance: settingsMap.get('syllableTolerance') as number ?? 1,
            updatedAt: Date.now()
          };
        })
      );
    };

    ydoc.on('update', syncYjsToReact);

  }, [disconnectWs, session]);

  // Connect/disconnect WS when local mode setting or active draft changes
  useEffect(() => {
    if (isCloudMode && activeDraftId) {
      connectWs(activeDraftId);
    } else {
      disconnectWs();
    }
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

  // ── Load drafts / projects ──────────────────────────────────────────────────
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

    console.log('[loadDrafts] initialDraftId:', initialDraftId, 'urlDraftIdToUse:', urlDraftIdToUse);

    let dbConnected = false;
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      dbConnected = data.database === 'connected';
      setHealthStatus(dbConnected ? 'connected' : 'disconnected');
    } catch (e) {
      setHealthStatus('disconnected');
    }

    const cloudActive = dbConnected && !useLocalMode && !!session;
    let loaded: Draft[] = [];

    if (cloudActive) {
      try {
        const res = await fetch('/api/projects', {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          loaded = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            content: '', // Yjs hydrates content dynamically
            targetTemplate: '',
            syllableTolerance: 1,
            createdAt: Date.parse(d.created_at) || Date.now(),
            updatedAt: Date.parse(d.created_at) || Date.now()
          }));
        } else {
          throw new Error('Failed to fetch projects from server');
        }
      } catch (e) {
        console.error('Failed to load projects, falling back to local database', e);
        const local = await getLocalDrafts();
        loaded = local.map(d => ({
          id: d.id,
          title: d.title,
          content: d.content,
          targetTemplate: d.targetTemplate,
          syllableTolerance: d.syllableTolerance ?? 1,
          createdAt: Date.parse(d.createdAt) || Date.now(),
          updatedAt: d.updatedAt ? Date.parse(d.updatedAt) : Date.now()
        }));
        if (loaded.length === 0) loaded = DEFAULT_DRAFTS;
      }
    } else {
      // Local mode (IndexedDB)
      try {
        const local = await getLocalDrafts();
        if (local.length === 0) {
          for (const d of DEFAULT_DRAFTS) {
            await saveLocalDraft({
              id: d.id,
              title: d.title,
              content: d.content,
              targetTemplate: d.targetTemplate,
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
            targetTemplate: d.targetTemplate,
            syllableTolerance: d.syllableTolerance ?? 1,
            createdAt: Date.parse(d.createdAt) || Date.now(),
            updatedAt: d.updatedAt ? Date.parse(d.updatedAt) : Date.now()
          }));
        }
      } catch (e) {
        console.error('IndexedDB load failed', e);
        loaded = DEFAULT_DRAFTS;
      }
    }

    setDrafts(loaded);

    // Determine which draft/project to activate
    if (urlDraftIdToUse && loaded.some(d => d.id === urlDraftIdToUse)) {
      setActiveDraftId(urlDraftIdToUse);
    } else {
      setActiveDraftId(null);
    }

    setIsSaving(false);
  }, [useLocalMode, session, getAuthHeaders]);

  // Initial load
  useEffect(() => {
    if (session) {
      loadDrafts();
    } else {
      setDrafts([]);
      setActiveDraftId(null);
    }
  }, [session, loadDrafts]);

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

  // Auto-save local updates (IndexedDB fallback only, in cloud mode Yjs handles it)
  useEffect(() => {
    if (!activeDraft || isCloudMode) return;

    setIsSaving(true);
    const draft = { ...activeDraft, updatedAt: Date.now() };

    const timer = setTimeout(async () => {
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
    isCloudMode
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
      syllableTolerance: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (isCloudMode) {
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ title })
        });
        if (!res.ok) throw new Error('Cloud create failed');
        const data = await res.json();
        
        const created: Draft = {
          id: data.id,
          title: data.title,
          content: '',
          targetTemplate: '',
          syllableTolerance: 1,
          createdAt: Date.parse(data.created_at) || Date.now(),
          updatedAt: Date.parse(data.created_at) || Date.now()
        };

        setDrafts(prev => [created, ...prev]);
        setActiveDraftId(created.id);
        return created;
      } catch (e) {
        console.error('Failed to create project on cloud, writing locally', e);
      }
    }

    // Local mode / fallback
    setDrafts(prev => [newDraft, ...prev]);
    setActiveDraftId(newDraft.id);
    await saveLocalDraft({
      ...newDraft,
      createdAt: new Date(newDraft.createdAt).toISOString(),
      updatedAt: new Date(newDraft.updatedAt).toISOString()
    });

    return newDraft;
  }, [isCloudMode, getAuthHeaders]);

  const updateActiveDraft = useCallback((updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => {
    if (!activeDraftId) return;

    if (isCloudMode && yDoc) {
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
  }, [activeDraftId, yDoc, isCloudMode]);

  const deleteDraft = useCallback(async (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));

    if (activeDraftId === id) {
      setActiveDraftId(null);
    }

    if (isCloudMode) {
      try {
        const res = await fetch(`/api/projects/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Cloud delete failed');
      } catch (e) {
        console.error('Failed to delete on cloud:', e);
      }
    }
    await deleteLocalDraft(id);
  }, [activeDraftId, isCloudMode, getAuthHeaders]);

  // Legacy/No-op now
  const syncLocalToCloud = useCallback(async () => {}, []);
  const exportAllDrafts = useCallback(() => {}, []);
  const importDrafts = useCallback(() => false, []);
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
