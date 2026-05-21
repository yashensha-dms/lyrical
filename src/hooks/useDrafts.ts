import { useState, useEffect, useCallback, useMemo } from 'react';

export interface Draft {
  id: string;
  title: string;           // Pinned Title Vault
  content: string;         // Lyric lines
  targetTemplate: string;  // Syllables schema (e.g. "8-6-8-6")
  scrapbook: string;       // Method songwriting scrapbook notes
  syllableTolerance?: number; // strictness setting (0 = strict, 1 = flexible, 2 = relaxed)
  createdAt: number;
  updatedAt: number;
}

const LOCAL_STORAGE_KEY = 'lyrical_drafts_v1';
const ACTIVE_DRAFT_KEY = 'lyrical_active_draft_id_v1';

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
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  }
];

export function useDrafts() {
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load drafts from localStorage', e);
    }
    return DEFAULT_DRAFTS;
  });

  const [activeDraftId, setActiveDraftId] = useState<string | null>(() => {
    try {
      const savedActive = localStorage.getItem(ACTIVE_DRAFT_KEY);
      if (savedActive) {
        return savedActive;
      }
    } catch (e) {
      console.error('Failed to load active draft ID', e);
    }
    // Fallback to first draft if available
    return DEFAULT_DRAFTS[0]?.id || null;
  });

  const [isSaving, setIsSaving] = useState(false);

  // Sync drafts to localStorage on change
  useEffect(() => {
    setIsSaving(true);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(drafts));
      } catch (e) {
        console.error('Failed to save drafts to localStorage', e);
      } finally {
        setIsSaving(false);
      }
    }, 300); // Debounce save to reduce write cycles

    return () => clearTimeout(timer);
  }, [drafts]);

  // Sync active draft ID to localStorage
  useEffect(() => {
    try {
      if (activeDraftId) {
        localStorage.setItem(ACTIVE_DRAFT_KEY, activeDraftId);
      } else {
        localStorage.removeItem(ACTIVE_DRAFT_KEY);
      }
    } catch (e) {
      console.error('Failed to save active draft ID', e);
    }
  }, [activeDraftId]);

  // Get currently active draft
  const activeDraft = useMemo(() => {
    return drafts.find(d => d.id === activeDraftId) || drafts[0] || null;
  }, [drafts, activeDraftId]);

  // Handle active draft ID updates when drafts are changed/deleted
  useEffect(() => {
    if (drafts.length > 0 && (!activeDraftId || !drafts.some(d => d.id === activeDraftId))) {
      setActiveDraftId(drafts[0].id);
    } else if (drafts.length === 0) {
      setActiveDraftId(null);
    }
  }, [drafts, activeDraftId]);

  const selectDraft = useCallback((id: string) => {
    if (drafts.some(d => d.id === id)) {
      setActiveDraftId(id);
    }
  }, [drafts]);

  const createDraft = useCallback((title: string = 'Untitled Song') => {
    const newDraft: Draft = {
      id: `draft-${Date.now()}`,
      title,
      content: '',
      targetTemplate: '',
      scrapbook: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setDrafts(prev => [newDraft, ...prev]);
    setActiveDraftId(newDraft.id);
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

  const deleteDraft = useCallback((id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
  }, []);

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
        // Validate elements
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
          return true;
        }
      }
    } catch (e) {
      console.error('Failed to import drafts', e);
    }
    return false;
  }, []);

  return {
    drafts,
    activeDraft,
    activeDraftId,
    isSaving,
    selectDraft,
    createDraft,
    updateActiveDraft,
    deleteDraft,
    exportAllDrafts,
    importDrafts,
  };
}
