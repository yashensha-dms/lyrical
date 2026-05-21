import { useState } from 'react';
import { PanelLeftClose, PanelLeft, PanelRightClose, PanelRight } from 'lucide-react';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { Notepad } from './components/Notepad';
import { RightPanel } from './components/RightPanel';
import { StatusBar } from './components/StatusBar';
import { useDrafts } from './hooks/useDrafts';

function App() {
  const {
    drafts,
    activeDraft,
    isSaving,
    selectDraft,
    createDraft,
    updateActiveDraft,
    deleteDraft,
    exportAllDrafts,
    importDrafts,
  } = useDrafts();

  // Layout panel states
  const [activePanel, setActivePanel] = useState<'explorer' | 'scrapbook' | 'settings'>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Selected word for rhyme lookup
  const [selectedWord, setSelectedWord] = useState('');

  return (
    <div className="w-screen h-screen flex flex-col bg-paper text-ink font-sans select-none overflow-hidden">
      
      {/* Top Application Header */}
      <header className="h-10 w-full bg-paper-dark border-b border-paper-darker flex items-center justify-between px-4 select-none flex-shrink-0">
        {/* App Logo */}
        <div className="flex items-center gap-2">
          <span className="font-serif italic font-extrabold text-terracotta tracking-wider text-base">Lyrical</span>
          <span className="text-[10px] bg-paper-darker border border-paper-darker text-ink-muted px-1.5 py-0.5 rounded font-mono font-medium">Core Workspace</span>
        </div>

        {/* Sidebar Toggle Shortcut Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded transition cursor-pointer hover:bg-paper-darker text-ink-muted hover:text-ink ${
              isSidebarOpen ? 'bg-paper-darker/60 text-terracotta' : ''
            }`}
            title="Toggle Left Sidebar"
            aria-label="Toggle Left Sidebar"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
          
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

      {/* Main Workspace Area */}
      <main className="flex-1 flex min-h-0 w-full relative">
        
        {/* 1. Activity Bar (Narrow Left) */}
        <ActivityBar
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />

        {/* 2. Left Collapsible Sidebar */}
        {isSidebarOpen && (
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
          />
        )}

        {/* 3. Central Notepad Writing Canvas */}
        {activeDraft ? (
          <Notepad
            title={activeDraft.title}
            content={activeDraft.content}
            targetTemplate={activeDraft.targetTemplate}
            syllableTolerance={activeDraft.syllableTolerance ?? 1}
            updateActiveDraft={updateActiveDraft}
            setSelectedWord={setSelectedWord}
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
          <RightPanel
            selectedWord={selectedWord}
            targetTemplate={activeDraft.targetTemplate}
            syllableTolerance={activeDraft.syllableTolerance ?? 1}
            updateActiveDraft={updateActiveDraft}
            setIsRightPanelOpen={setIsRightPanelOpen}
          />
        )}
      </main>

      {/* 5. Bottom Status Bar */}
      <StatusBar
        draftTitle={activeDraft?.title || ''}
        isSaving={isSaving}
        content={activeDraft?.content || ''}
      />
    </div>
  );
}

export default App;
