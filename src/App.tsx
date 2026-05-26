import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Music } from 'lucide-react';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { Notepad } from './components/Notepad';
import { StatusBar } from './components/StatusBar';
import { MobileLayout } from './components/MobileLayout';
import { LandingPage } from './components/LandingPage';
import { useDrafts } from './hooks/useDrafts';
import { useIsMobile } from './hooks/useIsMobile';
import { useRoute } from './hooks/useRoute';
import { supabase } from './utils/supabaseClient';
import { Login } from './components/Login';
import { RightPanel } from './components/RightPanel';
import { RightActivityBar } from './components/RightActivityBar';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
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
  const [activeRightPanel, setActiveRightPanel] = useState<'info' | 'scrapbook' | 'audio' | 'rhyme' | 'density' | 'swap'>('info');
  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [rhymeResults, setRhymeResults] = useState<any | null>(null);
  const [loadingRhymes, setLoadingRhymes] = useState(false);
  const [rhymeError, setRhymeError] = useState<string | null>(null);

  const handleWordDoubleClicked = async (word: string) => {
    const word_clean = word.trim();
    if (!word_clean) return;
    
    setLookupWord(word_clean);
    setLoadingRhymes(true);
    setRhymeError(null);
    setRhymeResults(null);
    
    setIsRightSidebarOpen(true);
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

  // ── URL ↔ Draft sync ──────────────────────────────────────────────────────
  // Bidirectional sync between URL and activeDraftId
  useEffect(() => {
    if (urlDraftId) {
      if (activeDraft?.id !== urlDraftId) {
        const found = drafts.find(d => d.id === urlDraftId);
        if (found) {
          selectDraft(urlDraftId);
        } else if (drafts.length > 0) {
          loadDrafts(urlDraftId);
        }
      }
    } else {
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
    return <Login />;
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
      />
    );
  }

  // ── Desktop Layout ─────────────────────────────────────────────────────────
  return (
    <div className="w-screen h-screen flex flex-col bg-paper text-ink font-sans select-none overflow-hidden">

      {/* Top Application Header */}
      <header className={`h-10 w-full bg-paper border-b border-paper-darker flex items-center justify-between px-4 select-none flex-shrink-0 transition-all duration-500 ${
        subconsciousActive ? 'opacity-10 pointer-events-none' : ''
      }`}>
        {/* Left: Logo + back to home */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="font-extrabold text-terracotta tracking-wider text-base hover:text-terracotta-hover transition cursor-pointer"
            title="All Songs"
          >
            Lyrical
          </button>
          <span className="text-[10px] bg-paper-dark border border-paper-darker text-ink-muted px-1.5 py-0.5 rounded font-mono font-medium">
            {activeDraft?.title || 'Untitled Song'}
          </span>
        </div>

        {/* Right: User + Sign Out */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-muted hidden sm:inline">{session?.user?.email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-[10px] uppercase font-bold text-ink-muted hover:text-terracotta transition border border-paper-darker hover:border-terracotta/30 px-2 py-1 rounded bg-paper-dark cursor-pointer focus:outline-none"
          >
            Sign Out
          </button>
        </div>

      </header>

      {/* Offline Warning Banner */}
      {healthStatus === 'disconnected' && (
        <div className="bg-amber-light text-ink border-b border-[#F5DDA8] px-4 py-2 flex items-center justify-between text-xs font-medium flex-shrink-0 select-none">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-DEFAULT" />
            <span>You are offline. Changes will automatically merge when database connection is restored.</span>
          </div>
        </div>
      )}

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
              />
            </div>
          </>
        ) : (
          <div className="flex-1 h-full bg-paper paper-lines flex items-center justify-center text-ink-light">
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
