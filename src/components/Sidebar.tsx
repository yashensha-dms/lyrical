import React, { useState } from 'react';
import { Plus, Trash2, Search, FileDown, FileUp, ChevronLeft } from 'lucide-react';
import type { Draft } from '../hooks/useDrafts';

interface SidebarProps {
  activePanel: 'explorer' | 'settings';
  drafts: Draft[];
  activeDraft: Draft | null;
  selectDraft: (id: string) => void;
  createDraft: (title?: string) => void;
  updateActiveDraft: (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => void;
  deleteDraft: (id: string) => void;
  exportAllDrafts: () => void;
  importDrafts: (jsonString: string) => boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isCloudMode: boolean;
  isMobile?: boolean;
  penName?: string;
  setPenName?: (name: string) => void;
  googleDefaultName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePanel,
  drafts,
  activeDraft,
  selectDraft,
  createDraft,
  updateActiveDraft,
  deleteDraft,
  exportAllDrafts,
  importDrafts,
  setIsSidebarOpen,
  isMobile = false,
  penName,
  setPenName,
  googleDefaultName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastTimeoutId, setToastTimeoutId] = useState<number | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutId) {
      window.clearTimeout(toastTimeoutId);
    }
    setToast({ message, type });
    const id = window.setTimeout(() => {
      setToast(null);
      setToastTimeoutId(null);
    }, 3000);
    setToastTimeoutId(id);
  };

  React.useEffect(() => {
    return () => {
      if (toastTimeoutId) window.clearTimeout(toastTimeoutId);
    };
  }, [toastTimeoutId]);

  // Handle draft title edit inline
  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setTempTitle(currentTitle);
  };

  const finishRename = (id: string) => {
    if (tempTitle.trim()) {
      if (activeDraft && activeDraft.id === id) {
        updateActiveDraft({ title: tempTitle.trim() });
      }
    }
    setEditingId(null);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importDrafts(content);
      if (success) {
        alert('Drafts imported successfully!');
      } else {
        alert('Failed to import drafts. Make sure the file format is correct.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  // Filter drafts list by search query
  const filteredDrafts = drafts.filter(draft =>
    draft.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    draft.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`${isMobile ? 'w-full' : 'w-64'} h-full bg-paper-dark/70 border-r border-paper-darker flex flex-col flex-shrink-0 z-10`}>
      {/* Sidebar Header */}
      <div className="h-14 px-4 border-b border-paper-darker flex items-center justify-between select-none">
        <span className="font-semibold tracking-wide text-ink text-sm uppercase">
          {activePanel === 'explorer'  && 'Songs'}
          {activePanel === 'settings'  && 'Settings'}
        </span>
        {!isMobile && (
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-ink-muted hover:text-ink hover:bg-paper-darker p-1 rounded cursor-pointer"
            title="Collapse Panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Explorer Panel */}
      {activePanel === 'explorer' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Action Bar */}
          <div className="p-3 flex gap-2 border-b border-paper-darker select-none">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-ink-light absolute left-2 top-2.5" />
              <input
                type="text"
                placeholder="Search lyrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                spellCheck="false"
                className="w-full bg-paper-dark border border-paper-darker rounded px-8 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition"
              />
            </div>
            <button
              onClick={() => createDraft()}
              className="bg-terracotta hover:bg-terracotta-hover text-white p-2 rounded cursor-pointer transition shadow-paper-sm flex-shrink-0"
              title="New Song"
            >
              <Plus className="w-4 h-4 stroke-[2]" />
            </button>
          </div>

          {/* Drafts List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredDrafts.length === 0 ? (
              <div className="text-center py-8 text-xs text-ink-light select-none">
                No songs found
              </div>
            ) : (
              filteredDrafts.map((draft) => {
                const isActive = activeDraft?.id === draft.id;
                const isEditing = editingId === draft.id;
                const isDeleting = deletingDraftId === draft.id;
                
                return (
                  <div
                    key={draft.id}
                    onClick={() => {
                      if (!isDeleting) {
                        selectDraft(draft.id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!isDeleting && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        selectDraft(draft.id);
                      }
                    }}
                    tabIndex={isDeleting ? -1 : 0}
                    className={`group flex items-center justify-between px-3 py-2 rounded-md select-none transition-all duration-200 ease-out border focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none ${
                      isDeleting
                        ? 'bg-red-950/20 border-red-900/50 text-red-400 font-medium'
                        : isActive
                        ? 'bg-paper-dark text-ink font-semibold border-paper-darker border-l-2 border-l-terracotta shadow-paper-sm -translate-y-[1px] cursor-pointer'
                        : 'text-ink-muted hover:text-ink hover:bg-paper-darker hover:border-paper-darker border-transparent hover:shadow-paper-sm hover:-translate-y-[1px] cursor-pointer'
                    }`}
                  >
                    {isDeleting ? (
                      <div className="flex-1 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                        <span className="truncate pr-1 text-red-600 font-medium font-sans">Delete draft?</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              deleteDraft(draft.id);
                              setDeletingDraftId(null);
                              showToast('Song draft deleted');
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white text-[9px] px-2 py-0.5 rounded transition cursor-pointer font-bold uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-red-500 focus:outline-none animate-pulse"
                            aria-label={`Confirm delete draft ${draft.title}`}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeletingDraftId(null)}
                            className="text-ink-muted hover:text-ink text-[9px] px-1.5 py-0.5 rounded hover:bg-paper-dark/50 transition cursor-pointer font-bold uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                            aria-label={`Cancel delete draft ${draft.title}`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 pr-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={tempTitle}
                              onChange={(e) => setTempTitle(e.target.value)}
                              onBlur={() => finishRename(draft.id)}
                              onKeyDown={(e) => e.key === 'Enter' && finishRename(draft.id)}
                              autoFocus
                              spellCheck="false"
                              className="w-full bg-paper border border-terracotta rounded px-1.5 py-0.5 text-xs text-ink focus:outline-none"
                              aria-label="Rename song draft"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                onDoubleClick={() => startRename(draft.id, draft.title)}
                                className="text-xs truncate block"
                                title="Double-click to rename"
                              >
                                {draft.title || 'Untitled Song'}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {!isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingDraftId(draft.id);
                            }}
                            className="text-ink-light hover:text-terracotta opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded hover:bg-paper-dark/50 cursor-pointer transition duration-150 focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                            title="Delete Song"
                            aria-label={`Delete song draft ${draft.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {activePanel === 'settings' && (
        <div className="flex-1 p-4 flex flex-col justify-between select-none bg-transparent">
          <div className="space-y-4">
            {penName !== undefined && setPenName && (
              <div className="border-b border-paper-darker pb-4">
                <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">Pen Name</h4>
                <p className="text-[11px] text-ink-muted leading-relaxed mb-2">
                  Configure your display name for real-time collaboration. Defaults to your Google account name.
                </p>
                <input
                  type="text"
                  placeholder={googleDefaultName || 'Enter your pen name...'}
                  value={penName}
                  onChange={(e) => setPenName(e.target.value)}
                  spellCheck="false"
                  className="w-full bg-paper border border-paper-darker rounded px-3 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition select-text"
                />
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">Backups</h4>
              <p className="text-[11px] text-ink-muted leading-relaxed mb-3">
                Export or import your songwriting workspace. All files remain strictly local in your browser.
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={exportAllDrafts}
                  className="w-full flex items-center justify-center gap-2 bg-paper border border-paper-darker hover:bg-paper-darker text-ink text-xs py-2 rounded-md transition cursor-pointer shadow-paper-sm focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                  aria-label="Backup all drafts library to JSON"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Backup Library (JSON)
                </button>

                <label
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const fileInput = document.getElementById('restore-file-input');
                      if (fileInput) fileInput.click();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-paper border border-paper-darker hover:bg-paper-darker text-ink text-xs py-2 rounded-md transition cursor-pointer shadow-paper-sm focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                  aria-label="Restore library from JSON backup"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  Restore Library
                  <input
                    id="restore-file-input"
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-paper-darker pt-4">
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">About Lyrical</h4>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                Lyrical is designed around the pop math principles of Swedish hitmakers and emotional lyric design.
              </p>
            </div>
          </div>
          
          <div className="text-[10px] text-ink-light text-center">
            Songwriter's Workspace v2.5.0
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      {toast && (
        <div 
          className={`absolute bottom-4 left-4 right-4 text-[10px] uppercase font-bold tracking-wider py-2.5 px-3.5 rounded-lg shadow-paper-md flex items-center justify-between z-50 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
            toast.type === 'error' 
              ? 'bg-red-50 text-red-800 border border-red-200' 
              : 'bg-ink text-paper border border-ink'
          }`}
          role="status"
          aria-live="polite"
        >
          <span>{toast.message}</span>
          <button 
            onClick={() => setToast(null)} 
            className={`text-[9px] cursor-pointer font-bold focus:outline-none focus-visible:underline ml-2 ${
              toast.type === 'error' ? 'text-red-600 hover:text-red-800' : 'text-paper-dark hover:text-white'
            }`}
            aria-label="Dismiss notification"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
