import { useState } from 'react';
import { PanelRightClose, PanelRight, AlertCircle, RefreshCw } from 'lucide-react';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { Notepad } from './components/Notepad';
import { RightPanel } from './components/RightPanel';
import { StatusBar } from './components/StatusBar';
import { MobileLayout } from './components/MobileLayout';
import { useDrafts } from './hooks/useDrafts';
import { useIsMobile } from './hooks/useIsMobile';

function App() {
  const {
    drafts,
    activeDraft,
    isSaving,
    healthStatus,
    useLocalMode,
    isCloudMode,
    remoteDraft,
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
  } = useDrafts();

  // Layout panel states
  const [activePanel, setActivePanel] = useState<'explorer' | 'scrapbook' | 'audio' | 'catcher' | 'settings'>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Selected word for rhyme lookup
  const [selectedWord, setSelectedWord] = useState('');

  // Subconscious writing mode focus state
  const [subconsciousActive, setSubconsciousActive] = useState(false);

  // Responsive layout detection
  const isMobile = useIsMobile();

  // ── Mobile Layout ──
  if (isMobile) {
    return (
      <MobileLayout
        drafts={drafts}
        activeDraft={activeDraft}
        healthStatus={healthStatus}
        useLocalMode={useLocalMode}
        isCloudMode={isCloudMode}
        remoteDraft={remoteDraft}
        selectDraft={selectDraft}
        createDraft={createDraft}
        updateActiveDraft={updateActiveDraft}
        deleteDraft={deleteDraft}
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

  // ── Desktop Layout ──
  return (
    <div className="w-screen h-screen flex flex-col bg-paper text-ink font-sans select-none overflow-hidden">
      
      {/* Top Application Header */}
      <header className={`h-10 w-full bg-paper-dark border-b border-paper-darker flex items-center justify-between px-4 select-none flex-shrink-0 transition-all duration-500 ${
        subconsciousActive ? 'opacity-10 pointer-events-none' : ''
      }`}>
        {/* Left Side: App Logo */}
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-terracotta tracking-wider text-base">Lyrical</span>
          <span className="text-[10px] bg-paper-darker border border-paper-darker text-ink-muted px-1.5 py-0.5 rounded font-mono font-medium">Core Workspace</span>
          
          {isCloudMode ? (
            <span className="flex items-center gap-1 text-[9px] bg-paper border border-paper-darker text-[#10B981] px-1.5 py-0.5 rounded font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span> Cloud
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] px-1.5 py-0.5 rounded font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-pulse"></span> Local
            </span>
          )}
        </div>

        {/* Right Side: Right Panel Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className={`p-1.5 rounded transition cursor-pointer hover:bg-paper-darker text-ink-muted hover:text-ink ${
              isRightPanelOpen ? 'bg-paper-darker/60 text-terracotta' : ''
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
        <div className="bg-[#FEF3C7] text-ink border-b border-[#FDE68A] px-4 py-2 flex items-center justify-between text-xs font-medium flex-shrink-0 select-none">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#D97706]" />
            <span>Database connection is offline. Cloud features are unavailable.</span>
          </div>
          <button
            onClick={() => setUseLocalMode(true)}
            className="bg-[#D97706] hover:bg-[#B45309] text-white px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition cursor-pointer"
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
        
        {/* 1. Activity Bar (Narrow Left) */}
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

        {/* 2. Left Collapsible Sidebar */}
        {isSidebarOpen && (
          <div className={`transition-all duration-500 h-full flex flex-shrink-0 ${
            subconsciousActive ? 'opacity-10 pointer-events-none' : ''
          }`}>
            <Sidebar
              activePanel={activePanel}
              drafts={drafts}
              activeDraft={activeDraft}
              selectDraft={selectDraft}
              createDraft={createDraft}
              updateActiveDraft={updateActiveDraft}
              deleteDraft={deleteDraft}
              exportAllDrafts={exportAllDrafts}
              importDrafts={importDrafts}
              setIsSidebarOpen={setIsSidebarOpen}
              isCloudMode={isCloudMode}
            />
          </div>
        )}

        {/* 3. Central Notepad Writing Canvas */}
        {activeDraft ? (
          <Notepad
            draftId={activeDraft.id}
            title={activeDraft.title}
            content={activeDraft.content}
            targetTemplate={activeDraft.targetTemplate}
            syllableTolerance={activeDraft.syllableTolerance ?? 1}
            updateActiveDraft={updateActiveDraft}
            setSelectedWord={setSelectedWord}
            remoteDraft={remoteDraft}
            setIsEditorFocused={setIsEditorFocused}
            syncActiveDraftWithRemote={syncActiveDraftWithRemote}
            isCloudMode={isCloudMode}
            onSubconsciousActiveChange={setSubconsciousActive}
          />
        ) : (
          <div className="flex-1 h-full bg-paper flex flex-col items-center justify-center text-ink-light select-none">
            <p className="text-sm font-serif italic mb-2">Write your masterpiece.</p>
            <button
              onClick={() => createDraft()}
              className="bg-terracotta hover:bg-terracotta-hover text-white text-xs px-3 py-1.5 rounded shadow-paper-sm cursor-pointer transition font-medium"
            >
              Create New Song
            </button>
          </div>
        )}

        {/* 4. Right Collapsible Utility Panel */}
        {isRightPanelOpen && activeDraft && (
          <div className={`transition-all duration-500 h-full flex flex-shrink-0 ${
            subconsciousActive ? 'opacity-10 pointer-events-none' : ''
          }`}>
            <RightPanel
              selectedWord={selectedWord}
              content={activeDraft.content}
              targetTemplate={activeDraft.targetTemplate}
              syllableTolerance={activeDraft.syllableTolerance ?? 1}
              updateActiveDraft={updateActiveDraft}
              setIsRightPanelOpen={setIsRightPanelOpen}
            />
          </div>
        )}
      </main>

      {/* 5. Bottom Status Bar */}
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
