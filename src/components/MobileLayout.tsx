import React, { useState } from 'react';
import { PenLine, Library, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Notepad } from './Notepad';
import { RightPanel } from './RightPanel';
import type { Draft } from '../hooks/useDrafts';

type MobileTab = 'write' | 'library' | 'tools';

interface MobileLayoutProps {
  // App state
  drafts: Draft[];
  activeDraft: Draft | null;
  healthStatus: 'checking' | 'connected' | 'disconnected';
  useLocalMode: boolean;
  isCloudMode: boolean;
  remoteDraft: Draft | null;
  // Actions
  selectDraft: (id: string) => void;
  createDraft: (title?: string) => Promise<Draft>;
  updateActiveDraft: (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => void;
  deleteDraft: (id: string) => void;
  exportAllDrafts: () => void;
  importDrafts: (jsonString: string) => boolean;
  syncLocalToCloud: () => void;
  setUseLocalMode: (v: boolean) => void;
  setIsEditorFocused: (v: boolean) => void;
  syncActiveDraftWithRemote: () => void;
  onSubconsciousActiveChange: (active: boolean) => void;
  subconsciousActive: boolean;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  drafts,
  activeDraft,
  healthStatus,
  useLocalMode,
  isCloudMode,
  remoteDraft,
  selectDraft,
  createDraft,
  updateActiveDraft,
  deleteDraft,
  exportAllDrafts,
  importDrafts,
  syncLocalToCloud,
  setUseLocalMode,
  setIsEditorFocused,
  syncActiveDraftWithRemote,
  onSubconsciousActiveChange,
  subconsciousActive,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('write');
  const [activePanel, setActivePanel] = useState<'explorer' | 'scrapbook' | 'audio' | 'catcher' | 'settings'>('explorer');
  const [selectedWord, setSelectedWord] = useState('');
  
  // Callback function to replace the selected word in the active draft
  const [replaceWordFn, setReplaceWordFn] = useState<((word: string) => void) | null>(null);

  // When a draft is selected on Library tab, switch to Write
  const handleSelectDraft = (id: string) => {
    selectDraft(id);
    setActiveTab('write');
  };

  // When a new draft is created, switch to Write
  const handleCreateDraft = (title?: string) => {
    createDraft(title);
    setActiveTab('write');
  };

  const tabs: { id: MobileTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { id: 'write',   label: 'Write',   Icon: ({ className }) => <PenLine className={className} /> },
    { id: 'library', label: 'Library', Icon: ({ className }) => <Library className={className} /> },
    { id: 'tools',   label: 'Tools',   Icon: ({ className }) => <Sparkles className={className} /> },
  ];

  // Panel tabs for Library
  const librarySubTabs: { id: 'explorer' | 'scrapbook' | 'audio' | 'catcher' | 'settings'; label: string }[] = [
    { id: 'explorer',  label: 'Songs' },
    { id: 'scrapbook', label: 'Scrapbook' },
    { id: 'audio',     label: 'Voice' },
    { id: 'catcher',   label: 'Catcher' },
    { id: 'settings',  label: 'Settings' },
  ];

  return (
    <div className="w-screen h-dvh flex flex-col bg-paper text-ink font-sans select-none overflow-hidden" style={{ height: '100dvh' }}>

      {/* ── Mobile Header ── */}
      <header className={`h-12 w-full bg-paper-dark border-b border-paper-darker flex items-center justify-between px-4 flex-shrink-0 transition-opacity duration-500 ${
        subconsciousActive ? 'opacity-10 pointer-events-none' : ''
      }`}>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-terracotta tracking-wider text-base">Lyrical</span>
          {isCloudMode ? (
            <span className="flex items-center gap-1 text-[9px] bg-paper border border-paper-darker text-[#10B981] px-1.5 py-0.5 rounded font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> Cloud
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] px-1.5 py-0.5 rounded font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-pulse" /> Local
            </span>
          )}
        </div>
        {/* Active song title */}
        {activeDraft && (
          <span className="text-xs text-ink-muted truncate max-w-[140px] font-medium">
            {activeDraft.title || 'Untitled Song'}
          </span>
        )}
      </header>

      {/* ── Offline / Sync Banners ── */}
      {healthStatus === 'disconnected' && !useLocalMode && (
        <div className="bg-[#FEF3C7] text-ink border-b border-[#FDE68A] px-4 py-2 flex items-center justify-between text-xs font-medium flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#D97706] flex-shrink-0" />
            <span>Cloud offline.</span>
          </div>
          <button
            onClick={() => setUseLocalMode(true)}
            className="bg-[#D97706] hover:bg-[#B45309] text-white px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition cursor-pointer ml-2"
          >
            Go Local
          </button>
        </div>
      )}
      {healthStatus === 'connected' && useLocalMode && (
        <div className="bg-terracotta-light text-ink border-b border-terracotta/20 px-4 py-2 flex items-center justify-between text-xs font-medium flex-shrink-0">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-terracotta animate-spin flex-shrink-0" style={{ animationDuration: '3s' }} />
            <span>Connection restored.</span>
          </div>
          <button
            onClick={syncLocalToCloud}
            className="bg-terracotta hover:bg-terracotta-hover text-white px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition cursor-pointer ml-2"
          >
            Sync
          </button>
        </div>
      )}

      {/* ── Library Sub-tab Strip (only when Library tab active) ── */}
      {activeTab === 'library' && (
        <div className={`flex overflow-x-auto bg-paper-dark border-b border-paper-darker flex-shrink-0 transition-opacity duration-500 ${
          subconsciousActive ? 'opacity-10 pointer-events-none' : ''
        }`} style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {librarySubTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              className={`flex-shrink-0 px-4 py-2.5 text-xs font-semibold tracking-wide transition-all duration-200 relative cursor-pointer ${
                activePanel === tab.id
                  ? 'text-terracotta'
                  : 'text-ink-muted'
              }`}
            >
              {tab.label}
              {activePanel === tab.id && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-terracotta rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Main Panel Area ── */}
      <main className="flex-1 min-h-0 w-full overflow-hidden relative">

        {/* Write Tab */}
        {activeTab === 'write' && (
          <div className={`w-full h-full flex flex-col transition-opacity duration-500 ${
            subconsciousActive ? '' : ''
          }`}>
            {activeDraft ? (
              <Notepad
                draftId={activeDraft.id}
                title={activeDraft.title}
                content={activeDraft.content}
                targetTemplate={activeDraft.targetTemplate}
                syllableTolerance={activeDraft.syllableTolerance ?? 1}
                updateActiveDraft={updateActiveDraft}
                setSelectedWord={setSelectedWord}
                onRegisterReplace={setReplaceWordFn}
                remoteDraft={remoteDraft}
                setIsEditorFocused={setIsEditorFocused}
                syncActiveDraftWithRemote={syncActiveDraftWithRemote}
                isCloudMode={isCloudMode}
                onSubconsciousActiveChange={onSubconsciousActiveChange}
                isMobile={true}
              />
            ) : (
              <div className="flex-1 h-full bg-paper flex flex-col items-center justify-center text-ink-light gap-4 px-8">
                <div className="text-center">
                  <span className="text-terracotta font-bold text-lg block mb-1">Lyrical</span>
                  <p className="text-sm text-ink-muted mb-6">Your songwriting workspace</p>
                </div>
                <button
                  onClick={() => { handleCreateDraft(); }}
                  className="bg-terracotta hover:bg-terracotta-hover text-white text-sm px-6 py-3 rounded-xl shadow-paper-md cursor-pointer transition font-semibold w-full max-w-xs"
                >
                  + New Song
                </button>
                <button
                  onClick={() => setActiveTab('library')}
                  className="text-ink-muted text-xs underline cursor-pointer"
                >
                  Open from Library
                </button>
              </div>
            )}
          </div>
        )}

        {/* Library Tab */}
        {activeTab === 'library' && (
          <div className="w-full h-full">
            <Sidebar
              activePanel={activePanel}
              drafts={drafts}
              activeDraft={activeDraft}
              selectDraft={handleSelectDraft}
              createDraft={handleCreateDraft}
              updateActiveDraft={updateActiveDraft}
              deleteDraft={deleteDraft}
              exportAllDrafts={exportAllDrafts}
              importDrafts={importDrafts}
              setIsSidebarOpen={() => {}} // no-op on mobile
              isCloudMode={isCloudMode}
              isMobile={true}
            />
          </div>
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <div className="w-full h-full">
            {activeDraft ? (
              <RightPanel
                selectedWord={selectedWord}
                isMobile={true}
                onReplaceSelectedWord={replaceWordFn || (() => {})}
              />
            ) : (
              <div className="flex-1 h-full bg-paper flex flex-col items-center justify-center text-ink-light gap-3 p-8 text-center">
                <Sparkles className="w-8 h-8 text-ink-light" />
                <p className="text-sm text-ink-muted">Open a song to use Rhymes, Simplifier & Templates.</p>
                <button
                  onClick={() => setActiveTab('library')}
                  className="text-terracotta text-xs font-semibold underline cursor-pointer"
                >
                  Go to Library
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Bottom Navigation Bar ── */}
      <nav className={`h-16 w-full bg-paper-dark border-t border-paper-darker flex items-stretch flex-shrink-0 transition-opacity duration-500 pb-safe-bottom ${
        subconsciousActive ? 'opacity-10 pointer-events-none' : ''
      }`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all duration-200 ${
                isActive ? 'text-terracotta' : 'text-ink-muted hover:text-ink'
              }`}
              aria-label={label}
            >
              <Icon className="w-5 h-5 stroke-[1.5]" />
              <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-terracotta' : ''}`}>
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-10 h-0.5 bg-terracotta rounded-t-full" style={{ position: 'static', display: 'block', marginTop: '-2px', borderRadius: '2px 2px 0 0' }} />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
