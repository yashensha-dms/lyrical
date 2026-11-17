import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Music } from 'lucide-react';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { Notepad } from './components/Notepad';
import { StatusBar } from './components/StatusBar';
import { MobileLayout } from './components/MobileLayout';
import { LandingPage } from './components/LandingPage';
import { HeaderNav } from './components/HeaderNav';
import { useDrafts } from './hooks/useDrafts';
import { useIsMobile } from './hooks/useIsMobile';
import { useRoute } from './hooks/useRoute';
import { api } from './utils/apiClient';
import { Login } from './components/Login';
import { RightPanel } from './components/RightPanel';
import { RightActivityBar } from './components/RightActivityBar';
import { isMalayalam } from './utils/malayalamProsody';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    api.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = api.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingAuth(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const {
    drafts,
    activeDraft,
    isSaving,
    isLoading,
    healthStatus,
    isCloudMode,
    yDoc,
    provider,
    setIsEditorFocused,
    syncActiveDraftWithRemote,
    selectDraft,
    createDraft,
    updateActiveDraft,
    deleteDraft,
    renameDraft,
    exportAllDrafts,
    importDrafts,
    loadDrafts,
    penName,
    setPenName,
  } = useDrafts(session);

  const googleDefaultName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Writer';

  const { draftId: urlDraftId, navigate } = useRoute();
  const isMobile = useIsMobile();

  // Layout panel states
  const [activePanel, setActivePanel] = useState<'settings' | 'phrases' | 'graveyard'>('phrases');
  const [refreshGraveyardCount, setRefreshGraveyardCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeRightPanel, setActiveRightPanel] = useState<'info' | 'scrapbook' | 'audio' | 'rhyme' | 'density' | 'swap' | 'malayalam'>('info');
  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [rhymeResults, setRhymeResults] = useState<any | null>(null);
  const [loadingRhymes, setLoadingRhymes] = useState(false);
  const [rhymeError, setRhymeError] = useState<string | null>(null);

  // Malayalam Mode state
  const [manglishActive, setManglishActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lyrical_manglish_active') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleManglish = useCallback(() => {
    setManglishActive(prev => {
      const next = !prev;
      try {
        localStorage.setItem('lyrical_manglish_active', String(next));
      } catch {}
      return next;
    });
  }, []);

  const isMalayalamMode = useMemo(() => {
    return manglishActive || isMalayalam(activeDraft?.content || '') || isMalayalam(activeDraft?.title || '');
  }, [manglishActive, activeDraft?.content, activeDraft?.title]);

  // When in Malayalam mode, automatically switch away from English-only panels
  useEffect(() => {
    if (isMalayalamMode && (activeRightPanel === 'rhyme' || activeRightPanel === 'density' || activeRightPanel === 'swap')) {
      setActiveRightPanel('malayalam');
    }
  }, [isMalayalamMode, activeRightPanel]);

  const handleWordDoubleClicked = async (word: string) => {
    const word_clean = word.trim();
    if (!word_clean) return;
    
    setLookupWord(word_clean);
    setIsRightSidebarOpen(true);

    if (isMalayalam(word_clean) || isMalayalamMode) {
      setActiveRightPanel('malayalam');
      return;
    }

    setLoadingRhymes(true);
    setRhymeError(null);
    setRhymeResults(null);
    setActiveRightPanel('rhyme');
    
    try {
      const response = await fetch(`/api/rhyme?word=${encodeURIComponent(word_clean)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch rhymes');
      }
      const data = await response.json();
      setRhymeResults(data);
    } catch (err: any) {
      setRhymeError(err.message || 'Error fetching rhymes');
    } finally {
      setLoadingRhymes(false);
    }
  };

  const handleClearRhymes = () => {
    setLookupWord(null);
    setRhymeResults(null);
    setRhymeError(null);
  };

  const editorRef = useRef<any>(null);

  const handleImportPhrase = (content: string) => {
    if (editorRef.current && editorRef.current.insertText) {
      editorRef.current.insertText(content);
    }
  };

  // Subconscious writing mode
  const [subconsciousActive, setSubconsciousActive] = useState(false);

  const triedLoadingRef = useRef<string | null>(null);

  // ── URL ↔ Draft sync ──────────────────────────────────────────────────────
  // Bidirectional sync between URL and activeDraftId
  useEffect(() => {
    if (urlDraftId) {
      if (activeDraft?.id !== urlDraftId) {
        const found = drafts.find(d => d.id === urlDraftId);
        if (found) {
          selectDraft(urlDraftId);
          triedLoadingRef.current = null;
        } else if (drafts.length > 0 && triedLoadingRef.current !== urlDraftId) {
          triedLoadingRef.current = urlDraftId;
          loadDrafts(urlDraftId);
        }
      }
    } else {
      triedLoadingRef.current = null;
      if (activeDraft?.id !== null && activeDraft?.id !== undefined) {
        selectDraft(null);
      }
    }
  }, [urlDraftId, drafts, activeDraft?.id, selectDraft, loadDrafts]);

  // Handle select draft: update state AND update URL
  const handleSelectDraft = (id: string) => {
    selectDraft(id);
    navigate(`/draft/${id}`);
  };

  // Handle create draft: create AND navigate to the new URL
  const handleCreateDraft = async (title?: string) => {
    const newDraft = await createDraft(title);
    selectDraft(newDraft.id);
    navigate(`/draft/${newDraft.id}`);
    return newDraft;
  };

  // Handle delete draft: delete and navigate back to homepage if it was the active draft
  const handleDeleteDraft = async (id: string) => {
    const isDeletingActive = activeDraft?.id === id;
    if (isDeletingActive) {
      navigate('/');
    }
    await deleteDraft(id);
  };

  if (loadingAuth) {
    return (
      <div className="w-screen h-screen bg-paper flex items-center justify-center">
        <div className="text-terracotta flex items-center gap-2">
          <Music className="w-5 h-5 animate-spin" />
          <span className="font-serif font-bold text-sm tracking-wide">Loading Lyrical...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={(s) => setSession(s)} />;
  }

  // Show landing if no active draft
  const showLanding = !activeDraft && !urlDraftId;

  // ── Mobile Layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    if (showLanding) {
      return (
        <LandingPage
          drafts={drafts}
          isCloudMode={isCloudMode}
          healthStatus={healthStatus}
          onSelectDraft={handleSelectDraft}
          onCreateDraft={() => handleCreateDraft()}
          onDeleteDraft={handleDeleteDraft}
          onRenameDraft={renameDraft}
          userEmail={session?.user?.email}
          onSignOut={() => api.auth.signOut()}
        />
      );
    }
    return (
      <MobileLayout
        activeDraft={activeDraft}
        healthStatus={healthStatus}
        isCloudMode={isCloudMode}
        yDoc={yDoc}
        provider={provider}
        createDraft={handleCreateDraft}
        updateActiveDraft={updateActiveDraft}
        exportAllDrafts={exportAllDrafts}
        importDrafts={importDrafts}
        setIsEditorFocused={setIsEditorFocused}
        syncActiveDraftWithRemote={syncActiveDraftWithRemote}
        onSubconsciousActiveChange={setSubconsciousActive}
        subconsciousActive={subconsciousActive}
        penName={penName}
        setPenName={setPenName}
        googleDefaultName={googleDefaultName}
      />
    );
  }

  // ── Landing Page (desktop, no draft) ──────────────────────────────────────
  if (showLanding) {
    return (
      <LandingPage
        drafts={drafts}
        isCloudMode={isCloudMode}
        healthStatus={healthStatus}
        onSelectDraft={handleSelectDraft}
        onCreateDraft={() => handleCreateDraft()}
        onDeleteDraft={handleDeleteDraft}
        onRenameDraft={renameDraft}
        userEmail={session?.user?.email}
        onSignOut={() => api.auth.signOut()}
      />
    );
  }

  // ── Desktop Layout ─────────────────────────────────────────────────────────
  return (
    <div className="w-screen h-screen flex flex-col bg-paper text-ink font-sans select-none overflow-hidden">

      {/* Top Application Header */}
      <HeaderNav
        title={activeDraft?.title || 'Untitled Song'}
        userEmail={session?.user?.email}
        onSignOut={() => api.auth.signOut()}
        onLogoClick={() => navigate('/')}
        subconsciousActive={subconsciousActive}
      />


      {/* Main Workspace Area */}
      <main className="flex-1 flex min-h-0 w-full relative">

        {/* 1. Activity Bar */}
        <div className={`transition-all duration-500 h-full flex flex-shrink-0 ${
          subconsciousActive ? 'opacity-10 pointer-events-none' : ''
        }`}>
          <ActivityBar
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        </div>

        {/* 2. Left Sidebar */}
        {isSidebarOpen && (
          <div className={`transition-all duration-500 h-full flex flex-shrink-0 ${
            subconsciousActive ? 'opacity-10 pointer-events-none' : ''
          }`}>
            <Sidebar
              activePanel={activePanel}
              exportAllDrafts={exportAllDrafts}
              importDrafts={importDrafts}
              setIsSidebarOpen={setIsSidebarOpen}
              isCloudMode={isCloudMode}
              penName={penName}
              setPenName={setPenName}
              googleDefaultName={googleDefaultName}
              onImportPhrase={handleImportPhrase}
              isProjectOpen={!!activeDraft}
              refreshGraveyardCount={refreshGraveyardCount}
            />
          </div>
        )}

        {/* 3. Notepad */}
        {activeDraft ? (
          <>
            <Notepad
              draftId={activeDraft.id}
              title={activeDraft.title}
              content={activeDraft.content}
              targetTemplate={activeDraft.targetTemplate}
              syllableTolerance={activeDraft.syllableTolerance ?? 1}
              updateActiveDraft={updateActiveDraft}
              remoteDraft={null}
              setIsEditorFocused={setIsEditorFocused}
              syncActiveDraftWithRemote={syncActiveDraftWithRemote}
              isCloudMode={isCloudMode}
              onSubconsciousActiveChange={setSubconsciousActive}
              yDoc={yDoc}
              provider={provider}
              editorRef={editorRef}
              onMoveToGraveyard={() => setRefreshGraveyardCount(prev => prev + 1)}
              onWordDoubleClicked={handleWordDoubleClicked}
              manglishActive={manglishActive}
              onToggleManglish={handleToggleManglish}
            />
            {isRightSidebarOpen && (
              <div className={`transition-all duration-500 h-full flex flex-shrink-0 ${
                subconsciousActive ? 'opacity-10 pointer-events-none' : ''
              }`}>
                <RightPanel
                  activeDraft={activeDraft}
                  updateActiveDraft={updateActiveDraft}
                  setIsSidebarOpen={setIsRightSidebarOpen}
                  activePanel={activeRightPanel}
                  lookupWord={lookupWord}
                  rhymeResults={rhymeResults}
                  loadingRhymes={loadingRhymes}
                  rhymeError={rhymeError}
                  onClearRhymes={handleClearRhymes}
                  onSearchRhymes={handleWordDoubleClicked}
                  isMalayalamMode={isMalayalamMode}
                />
              </div>
            )}
            <div className={`transition-all duration-500 h-full flex flex-shrink-0 ${
              subconsciousActive ? 'opacity-10 pointer-events-none' : ''
            }`}>
              <RightActivityBar
                isSidebarOpen={isRightSidebarOpen}
                setIsSidebarOpen={setIsRightSidebarOpen}
                activePanel={activeRightPanel}
                setActivePanel={setActiveRightPanel}
                isMalayalamMode={isMalayalamMode}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 h-full bg-paper flex items-center justify-center text-ink-light">
            <span className="font-serif italic text-sm">Loading workspace...</span>
          </div>
        )}
      </main>

      {/* 5. Status Bar */}
      <div className={`transition-all duration-500 w-full flex-shrink-0 ${
        subconsciousActive ? 'opacity-10 pointer-events-none' : ''
      }`}>
        <StatusBar
          draftTitle={activeDraft?.title || ''}
          isSaving={isSaving}
          isLoading={isLoading}
          isCloudMode={isCloudMode}
          content={activeDraft?.content || ''}
        />
      </div>
    </div>
  );
}

export default App;
