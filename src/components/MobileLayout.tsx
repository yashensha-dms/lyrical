import React, { useState } from 'react';
import { PenLine, Library, AlertCircle, RefreshCw } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Notepad } from './Notepad';
import type { Draft } from '../hooks/useDrafts';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

type MobileTab = 'write' | 'library';

interface MobileLayoutProps {
  // App state
  activeDraft: Draft | null;
  healthStatus: 'checking' | 'connected' | 'disconnected';
  useLocalMode: boolean;
  isCloudMode: boolean;
  yDoc?: Y.Doc | null;
  provider?: WebsocketProvider | null;
  // Actions
  createDraft: (title?: string) => Promise<Draft>;
  updateActiveDraft: (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => void;
  exportAllDrafts: () => void;
  importDrafts: (jsonString: string) => boolean;
  syncLocalToCloud: () => void;
  setUseLocalMode: (v: boolean) => void;
  setIsEditorFocused: (v: boolean) => void;
  syncActiveDraftWithRemote: () => void;
  onSubconsciousActiveChange: (active: boolean) => void;
  subconsciousActive: boolean;
  penName: string;
  setPenName: (name: string) => void;
  googleDefaultName: string;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  activeDraft,
  healthStatus,
  useLocalMode,
  isCloudMode,
  yDoc,
  provider,
  createDraft,
  updateActiveDraft,
  exportAllDrafts,
  importDrafts,
  syncLocalToCloud,
  setUseLocalMode,
  setIsEditorFocused,
  syncActiveDraftWithRemote,
  onSubconsciousActiveChange,
  subconsciousActive,
  penName,
  setPenName,
  googleDefaultName,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('write');
  const [activePanel] = useState<'settings' | 'phrases'>('phrases');

  const editorRef = React.useRef<any>(null);

  const handleImportPhrase = (content: string) => {
    if (editorRef.current && editorRef.current.insertText) {
      editorRef.current.insertText(content);
      setActiveTab('write');
    }
  };

  // When a new draft is created, switch to Write
  const handleCreateDraft = (title?: string) => {
    createDraft(title);
    setActiveTab('write');
  };

  const tabs: { id: MobileTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { id: 'write',   label: 'Write',   Icon: ({ className }) => <PenLine className={className} /> },
    { id: 'library', label: 'Library', Icon: ({ className }) => <Library className={className} /> },
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
                yDoc={yDoc}
                provider={provider}
                setIsEditorFocused={setIsEditorFocused}
                syncActiveDraftWithRemote={syncActiveDraftWithRemote}
                isCloudMode={isCloudMode}
                onSubconsciousActiveChange={onSubconsciousActiveChange}
                isMobile={true}
                editorRef={editorRef}
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
              exportAllDrafts={exportAllDrafts}
              importDrafts={importDrafts}
              setIsSidebarOpen={() => {}}
              isCloudMode={isCloudMode}
              isMobile={true}
              penName={penName}
              setPenName={setPenName}
              googleDefaultName={googleDefaultName}
              onImportPhrase={handleImportPhrase}
              isProjectOpen={!!activeDraft}
            />
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
