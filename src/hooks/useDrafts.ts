import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { supabase } from '../utils/supabaseClient';

const parseArray = (val: any): string[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};


export interface Draft {
  id: string;
  title: string;           // Project Title
  content: string;         // Lyric lines (handled by Yjs, empty initially)
  targetTemplate: string;  // Leftover/empty
  syllableTolerance?: number;
  createdAt: number;
  updatedAt: number;
  status: string;
  writers: string[];
  producers: string[];
  featuredArtists: string[];
}

const ACTIVE_DRAFT_KEY = 'lyrical_active_draft_id_v2';

export function useDrafts(session: any) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  const draftsRef = useRef(drafts);
  const isEditorFocusedRef = useRef(false);
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const wsRoomRef = useRef<string | null>(null);

  const [penName, setPenNameState] = useState<string>(() => localStorage.getItem('lyrical_pen_name') || session?.user?.user_metadata?.pen_name || '');

  useEffect(() => {
    if (session?.user?.user_metadata?.pen_name && !localStorage.getItem('lyrical_pen_name')) {
      setPenNameState(session.user.user_metadata.pen_name);
    }
  }, [session]);

  const setPenName = useCallback(async (name: string) => {
    setPenNameState(name);
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem('lyrical_pen_name', trimmed);
      if (session) {
        await supabase.auth.updateUser({
          data: { pen_name: trimmed }
        });
      }
    } else {
      localStorage.removeItem('lyrical_pen_name');
      if (session) {
        await supabase.auth.updateUser({
          data: { pen_name: null }
        });
      }
    }
  }, [session]);

  const getDisplayName = useCallback(() => {
    const savedPenName = localStorage.getItem('lyrical_pen_name') || session?.user?.user_metadata?.pen_name;
    if (savedPenName && savedPenName.trim()) {
      return savedPenName.trim();
    }
    const googleName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name;
    if (googleName) {
      return googleName;
    }
    return session?.user?.email?.split('@')[0] || 'Writer';
  }, [session]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const isCloudMode = !!session;
  const isCloudModeRef = useRef(isCloudMode);
  useEffect(() => { isCloudModeRef.current = isCloudMode; }, [isCloudMode]);

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
      const currentState = awareness.getLocalState();
      const newName = getDisplayName();

      if (!currentState?.user || currentState.user.name !== newName) {
        awareness.setLocalStateField('user', {
          name: newName,
          color: currentState?.user?.color || assignedColor
        });
      }
    };

    providerInstance.awareness.on('change', updateLocalUser);
    providerInstance.awareness.setLocalStateField('user', {
      name: getDisplayName(),
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

  // Update Yjs awareness if penName changes while connected
  useEffect(() => {
    if (provider && session) {
      const displayName = penName.trim() || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Writer';
      const awareness = provider.awareness;
      const currentState = awareness.getLocalState();
      
      if (!currentState?.user || currentState.user.name !== displayName) {
        awareness.setLocalStateField('user', {
          name: displayName,
          color: currentState?.user?.color || '#C0694E'
        });
      }
    }
  }, [penName, provider, session]);

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
    setIsLoading(true);
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

    const cloudActive = dbConnected && !!session;
    let loaded: Draft[] = [];

    if (cloudActive) {
      try {
        const res = await fetch(`/api/projects?t=${Date.now()}`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          console.log('[loadDrafts] API raw projects data:', data);
          loaded = data.map((d: any) => {
            const mapped = {
              id: d.id,
              title: d.title,
              content: '', // Yjs hydrates content dynamically
              targetTemplate: '',
              syllableTolerance: 1,
              createdAt: Date.parse(d.created_at) || Date.now(),
              updatedAt: Date.parse(d.created_at) || Date.now(),
              status: d.status || 'Demo',
              writers: parseArray(d.writers),
              producers: parseArray(d.producers),
              featuredArtists: parseArray(d.featured_artists),
            };
            console.log(`[loadDrafts] mapped project ${d.title}:`, mapped);
            return mapped;
          });
        } else {
          console.warn('Failed to fetch projects from server');
        }
      } catch (e) {
        console.error('Failed to load projects:', e);
      }
    }

    setDrafts(loaded);

    // Determine which draft/project to activate
    if (urlDraftIdToUse) {
      const exists = loaded.some(d => d.id === urlDraftIdToUse);
      if (exists) {
        setActiveDraftId(urlDraftIdToUse);
      } else if (cloudActive) {
        // Attempt to auto-join the shared project link
        try {
          const joinRes = await fetch(`/api/projects/${urlDraftIdToUse}/join`, {
            method: 'POST',
            headers: getAuthHeaders()
          });
          if (joinRes.ok) {
            const data = await joinRes.json();
            const joinedProject: Draft = {
              id: data.id,
              title: data.title,
              content: '',
              targetTemplate: '',
              syllableTolerance: 1,
              createdAt: Date.parse(data.created_at) || Date.now(),
              updatedAt: Date.parse(data.created_at) || Date.now(),
              status: data.status || 'Demo',
              writers: parseArray(data.writers),
              producers: parseArray(data.producers),
              featuredArtists: parseArray(data.featured_artists),
            };
            setDrafts(prev => {
              if (prev.some(d => d.id === joinedProject.id)) return prev;
              return [joinedProject, ...prev];
            });
            setActiveDraftId(joinedProject.id);
          } else {
            console.warn(`[loadDrafts] Failed to join project: ${urlDraftIdToUse}`);
            setActiveDraftId(null);
          }
        } catch (err) {
          console.error('[loadDrafts] Error joining project:', err);
          setActiveDraftId(null);
        }
      } else {
        setActiveDraftId(null);
      }
    } else {
      setActiveDraftId(null);
    }

    setIsSaving(false);
    setIsLoading(false);
  }, [session, getAuthHeaders]);

  // Initial load
  useEffect(() => {
    if (session) {
      loadDrafts();
    } else {
      setDrafts([]);
      setActiveDraftId(null);
      setIsLoading(false);
    }
  }, [session, loadDrafts]);

  // Fetch project metadata from Supabase when the active project opens
  useEffect(() => {
    if (!isCloudMode || !activeDraftId) return;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeDraftId);
    if (!isUuid) return;

    let isMounted = true;

    async function fetchProjectMetadata() {
      try {
        const res = await fetch(`/api/projects/${activeDraftId}`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data && isMounted) {
            console.log('[useDrafts] Fetched latest project metadata via API:', data);
            setDrafts(prev =>
              prev.map(d =>
                d.id === activeDraftId
                  ? {
                      ...d,
                      title: data.title || d.title,
                      status: data.status || 'Demo',
                      writers: parseArray(data.writers),
                      producers: parseArray(data.producers),
                      featuredArtists: parseArray(data.featured_artists),
                    }
                  : d
              )
            );
          }
        } else {
          console.error('[useDrafts] Failed to fetch project metadata via API:', res.statusText);
        }
      } catch (err) {
        console.error('[useDrafts] Failed to fetch project metadata:', err);
      }
    }

    fetchProjectMetadata();

    return () => {
      isMounted = false;
    };
  }, [activeDraftId, isCloudMode, getAuthHeaders]);

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

  // Auto-save removed as app is purely cloud-based

  const selectDraft = useCallback((id: string | null) => {
    if (id === null || id === '') {
      setActiveDraftId(null);
    } else if (drafts.some(d => d.id === id)) {
      setActiveDraftId(id);
    }
  }, [drafts]);

  const createDraft = useCallback(async (title: string = 'Untitled Song') => {
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
        updatedAt: Date.parse(data.created_at) || Date.now(),
        status: data.status || 'Demo',
        writers: parseArray(data.writers),
        producers: parseArray(data.producers),
        featuredArtists: parseArray(data.featured_artists),
      };

      setDrafts(prev => [created, ...prev]);
      setActiveDraftId(created.id);
      return created;
    } catch (e) {
      console.error('Failed to create project:', e);
      throw e;
    }
  }, [isCloudMode, getAuthHeaders]);

  const updateActiveDraft = useCallback(async (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => {
    if (!activeDraftId) return;

    const hasMetadataUpdates = 
      updates.status !== undefined || 
      updates.writers !== undefined || 
      updates.producers !== undefined || 
      updates.featuredArtists !== undefined ||
      updates.title !== undefined;

    setDrafts(prev =>
      prev.map(d =>
        d.id === activeDraftId
          ? { ...d, ...updates, updatedAt: Date.now() }
          : d
      )
    );

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
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeDraftId);
    if (isCloudMode && isUuid) {
      if (hasMetadataUpdates) {
        try {
          const dbUpdates: any = {};
          if (updates.title !== undefined) dbUpdates.title = updates.title;
          if (updates.status !== undefined) dbUpdates.status = updates.status;
          if (updates.writers !== undefined) dbUpdates.writers = updates.writers;
          if (updates.producers !== undefined) dbUpdates.producers = updates.producers;
          if (updates.featuredArtists !== undefined) dbUpdates.featured_artists = updates.featuredArtists;

          const res = await fetch(`/api/projects/${activeDraftId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(dbUpdates)
          });
          if (!res.ok) {
            const errData = await res.json();
            console.error('Failed to update project metadata in Supabase:', errData.error);
            alert('Failed to save to Supabase: ' + errData.error);
          } else {
            console.log('Successfully saved metadata to Supabase via API:', dbUpdates);
          }
        } catch (e: any) {
          console.error('Failed to update project metadata in Supabase:', e);
          alert('Exception saving to Supabase: ' + e.message);
        }
      }
    }

    // Offline / local IndexedDB mirroring removed
  }, [activeDraftId, yDoc, isCloudMode]);

  const deleteDraft = useCallback(async (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));

    if (activeDraftId === id) {
      setActiveDraftId(null);
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (isCloudMode && isUuid) {
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
  }, [activeDraftId, isCloudMode, getAuthHeaders]);

  const renameDraft = useCallback(async (id: string, newTitle: string) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, title: newTitle, updatedAt: Date.now() } : d));

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isCloudMode && isUuid) {
      try {
        const { error } = await supabase
          .from('projects')
          .update({ title: newTitle })
          .eq('id', id);
        if (error) throw error;
      } catch (e) {
        console.error('Failed to rename on cloud:', e);
      }
    }
  }, [isCloudMode]);


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
    isLoading,
    healthStatus,
    useLocalMode: false,
    isCloudMode,
    yDoc,
    provider,
    isEditorFocused: false,
    setIsEditorFocused,
    syncActiveDraftWithRemote,
    setUseLocalMode: () => {},
    checkHealth,
    selectDraft,
    createDraft,
    updateActiveDraft,
    deleteDraft,
    renameDraft,
    syncLocalToCloud,
    exportAllDrafts,
    importDrafts,
    loadDrafts,
    penName,
    setPenName,
  };
}
