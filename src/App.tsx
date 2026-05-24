import { useState, useEffect } from 'react';
import { PanelRightClose, PanelRight, AlertCircle, RefreshCw } from 'lucide-react';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { Notepad } from './components/Notepad';
import { RightPanel } from './components/RightPanel';
import { StatusBar } from './components/StatusBar';
import { MobileLayout } from './components/MobileLayout';
import { LandingPage } from './components/LandingPage';
import { useDrafts } from './hooks/useDrafts';
import { useIsMobile } from './hooks/useIsMobile';
import { useRoute } from './hooks/useRoute';

function App() {
  const {
    drafts,
    activeDraft,
    isSaving,
    healthStatus,
    useLocalMode,
    isCloudMode,
    yDoc,
    provider,
    setIsEditorFocused,
    syncActiveDraftWithRemote,
    setUseLocalMode,
    selectDraft,
    createDraft,
    updateActiveDraft,
    deleteDraft,
    syncLocalToCloud,
    exportAllDrafts,
    importDrafts,
    loadDrafts,
  } = useDrafts();

  const { draftId: urlDraftId, navigate } = useRoute();
  const isMobile = useIsMobile();

  // Layout panel states
  const [activePanel, setActivePanel] = useState<'explorer' | 'scrapbook' | 'audio' | 'catcher' | 'settings'>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Selected word for rhyme lookup
  const [selectedWord, setSelectedWord] = useState('');

  // Word replacement callback
  const [replaceWordFn, setReplaceWordFn] = useState<((word: string) => void) | null>(null);

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
    await deleteDraft(id);
    if (isDeletingActive) {
      navigate('/');
    }
  };

  // Show landing if no active draft
  const showLanding = !activeDraft;

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
        />
      );
    }
    return (
      <MobileLayout
        drafts={drafts}
        activeDraft={activeDraft}
        healthStatus={healthStatus}
        useLocalMode={useLocalMode}
        isCloudMode={isCloudMode}
        yDoc={yDoc}
        provider={provider}
        selectDraft={handleSelectDraft}
        createDraft={handleCreateDraft}
        updateActiveDraft={updateActiveDraft}
        deleteDraft={handleDeleteDraft}
        exportAllDrafts={exportAllDrafts}
        importDrafts={importDrafts}
        syncLocalToCloud={syncLocalToCloud}
        setUseLocalMode={setUseLocalMode}
        setIsEditorFocused={setIsEditorFocused}
        syncActiveDraftWithRemote={syncActiveDraftWithRemote}
        onSubconsciousActiveChange={setSubconsciousActive}
        subconsciousActive={subconsciousActive}
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
            {activeDraft.title || 'Untitled Song'}
          </span>

          {isCloudMode ? (
            <span className="flex items-center gap-1 text-[9px] bg-[#EDF7F2] border border-[#BDE8D4] text-[#2D7A56] px-1.5 py-0.5 rounded font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2D7A56] animate-pulse"></span> Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] bg-amber-light border border-[#F5DDA8] text-amber-DEFAULT px-1.5 py-0.5 rounded font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-DEFAULT animate-pulse"></span> Local
            </span>
          )}
        </div>

        {/* Right: Right Panel Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className={`p-1.5 rounded transition cursor-pointer hover:bg-paper-dark text-ink-muted hover:text-ink ${
              isRightPanelOpen ? 'bg-paper-dark text-terracotta' : ''
            }`}
            title="Toggle Right Panel"
            aria-label="Toggle Right Panel"
          >
            {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Offline Warning Banner */}
      {healthStatus === 'disconnected' && !useLocalMode && (
        <div className="bg-amber-light text-ink border-b border-[#F5DDA8] px-4 py-2 flex items-center justify-between text-xs font-medium flex-shrink-0 select-none">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-DEFAULT" />
            <span>Database connection is offline. Cloud features are unavailable.</span>
          </div>
          <button
            onClick={() => setUseLocalMode(true)}
            className="bg-amber-DEFAULT hover:bg-amber-DEFAULT/80 text-white px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition cursor-pointer"
          >
            Switch to Local Mode
          </button>
        </div>
      )}

      {/* Sync Banner */}
      {healthStatus === 'connected' && useLocalMode && (
        <div className="bg-terracotta-light text-ink border-b border-terracotta/20 px-4 py-2 flex items-center justify-between text-xs font-medium flex-shrink-0 select-none">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-terracotta animate-spin" style={{ animationDuration: '3s' }} />
            <span>Database connection restored! You are currently using offline local storage.</span>
          </div>
          <button
            onClick={syncLocalToCloud}
            className="bg-terracotta hover:bg-terracotta-hover text-white px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition cursor-pointer"
          >
            Publish to Cloud
          </button>
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
              drafts={drafts}
              activeDraft={activeDraft}
              selectDraft={handleSelectDraft}
              createDraft={handleCreateDraft}
              updateActiveDraft={updateActiveDraft}
              deleteDraft={handleDeleteDraft}
              exportAllDrafts={exportAllDrafts}
              importDrafts={importDrafts}
              setIsSidebarOpen={setIsSidebarOpen}
              isCloudMode={isCloudMode}
              yDoc={yDoc}
              provider={provider}
            />
          </div>
        )}

        {/* 3. Notepad */}
        <Notepad
          draftId={activeDraft.id}
          title={activeDraft.title}
          content={activeDraft.content}
          targetTemplate={activeDraft.targetTemplate}
          syllableTolerance={activeDraft.syllableTolerance ?? 1}
          updateActiveDraft={updateActiveDraft}
          setSelectedWord={setSelectedWord}
          onRegisterReplace={setReplaceWordFn}
          remoteDraft={null}
          setIsEditorFocused={setIsEditorFocused}
          syncActiveDraftWithRemote={syncActiveDraftWithRemote}
          isCloudMode={isCloudMode}
          onSubconsciousActiveChange={setSubconsciousActive}
          yDoc={yDoc}
          provider={provider}
        />

        {/* 4. Right Panel */}
        {isRightPanelOpen && (
          <div className={`transition-all duration-500 h-full flex flex-shrink-0 ${
            subconsciousActive ? 'opacity-10 pointer-events-none' : ''
          }`}>
            <RightPanel
              selectedWord={selectedWord}
              onReplaceSelectedWord={replaceWordFn || (() => {})}
            />
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
          content={activeDraft?.content || ''}
        />
      </div>
    </div>
  );
}

export default App;
