import React, { useState } from 'react';
import { Plus, Trash2, Search, FileDown, FileUp, ChevronLeft, Mic, Copy, PlusCircle, FileText, Quote, Edit2, ArrowRight, Check, X } from 'lucide-react';
import type { Draft } from '../hooks/useDrafts';
import { AudioDemoArea } from './AudioDemoArea';

interface Phrase {
  id: string;
  text: string;
  createdAt: number;
}

interface SidebarProps {
  activePanel: 'explorer' | 'scrapbook' | 'audio' | 'catcher' | 'settings';
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
  isCloudMode,
  isMobile = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastTimeoutId, setToastTimeoutId] = useState<any>(null);

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

  // Phrase Catcher state initialized lazily from localStorage
  const [phrases, setPhrases] = useState<Phrase[]>(() => {
    try {
      const stored = localStorage.getItem('lyrical_caught_phrases');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load caught phrases', e);
      return [];
    }
  });
  const [newPhraseText, setNewPhraseText] = useState('');
  const [catcherSearchQuery, setCatcherSearchQuery] = useState('');
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null);
  const [editingPhraseText, setEditingPhraseText] = useState('');

  // Save phrases to localStorage helper
  const savePhrases = (newPhrases: Phrase[]) => {
    setPhrases(newPhrases);
    try {
      localStorage.setItem('lyrical_caught_phrases', JSON.stringify(newPhrases));
    } catch (e) {
      console.error('Failed to save caught phrases', e);
    }
  };

  const handleAddPhrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhraseText.trim()) return;

    const newPhrase: Phrase = {
      id: `phrase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: newPhraseText.trim(),
      createdAt: Date.now(),
    };

    savePhrases([newPhrase, ...phrases]);
    setNewPhraseText('');
    showToast('Phrase caught in snippets pool!');
  };

  const handleDeletePhrase = (id: string) => {
    savePhrases(phrases.filter(p => p.id !== id));
    showToast('Phrase deleted');
  };

  const handleCopyPhrase = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Copied to clipboard!'))
      .catch(() => showToast('Failed to copy', 'error'));
  };

  const handleAddToScrapbook = (text: string) => {
    if (!activeDraft) {
      showToast('Open a song first to scrapbook this phrase', 'error');
      return;
    }
    const currentScrapbook = activeDraft.scrapbook || '';
    const delimiter = currentScrapbook ? '\n' : '';
    updateActiveDraft({
      scrapbook: `${currentScrapbook}${delimiter}- Overheard/Idea: "${text}"`,
    });
    showToast('Added to active scrapbook!');
  };

  const handleCreateSongFromPhrase = (text: string) => {
    createDraft(text);
    showToast('Created new song draft!');
  };

  const handleUpdatePhrase = (id: string, updatedText: string) => {
    if (!updatedText.trim()) return;
    savePhrases(phrases.map(p => p.id === id ? { ...p, text: updatedText.trim() } : p));
    setEditingPhraseId(null);
    showToast('Phrase updated');
  };

  const handleAppendToLyrics = (text: string) => {
    if (!activeDraft) {
      showToast('Open a song first to insert this phrase', 'error');
      return;
    }
    const currentContent = activeDraft.content || '';
    const delimiter = currentContent ? '\n\n' : '';
    updateActiveDraft({
      content: `${currentContent}${delimiter}${text}`,
    });
    showToast('Inserted phrase into lyrics!');
  };

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
          {activePanel === 'scrapbook' && 'Scrapbook'}
          {activePanel === 'audio'     && 'Voice Memos'}
          {activePanel === 'catcher'   && 'Phrase Catcher'}
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
                        ? 'bg-red-50/50 border-red-200 text-red-700 font-medium'
                        : isActive
                        ? 'bg-white text-ink font-semibold border-paper-darker border-l-2 border-l-terracotta shadow-paper-sm -translate-y-[1px] cursor-pointer'
                        : 'text-ink-muted hover:text-ink hover:bg-white hover:border-paper-darker border-transparent hover:shadow-paper-sm hover:-translate-y-[1px] cursor-pointer'
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
                              {draft.audioCount > 0 && (
                                <div className="flex items-center gap-1 text-terracotta flex-shrink-0">
                                  <Mic className="w-3 h-3" />
                                  <span className="text-[9px] font-mono">{draft.audioCount}</span>
                                </div>
                              )}
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

      {/* Phrase Catcher Panel */}
      {activePanel === 'catcher' && (
        <div className="flex-1 p-4 flex flex-col min-h-0 select-text bg-transparent">
          <div className="flex-1 flex flex-col gap-3 h-full min-h-0">
            {/* Header section with title and stats */}
            <div className="flex items-center justify-between flex-shrink-0 select-none border-b border-paper-darker pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-terracotta/10 rounded-lg text-terracotta">
                  <Quote className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-ink font-bold leading-tight">
                    Snippets Pool
                  </span>
                  <span className="text-[9px] text-ink-muted leading-tight">
                    Capture overheard dialogue & hooks
                  </span>
                </div>
              </div>
              {phrases.length > 0 && (
                <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-wider">
                  {isClearingAll ? (
                    <div className="flex items-center gap-2 text-ink-muted">
                      <span className="text-red-500 normal-case font-medium">Confirm clear?</span>
                      <button
                        onClick={() => {
                          savePhrases([]);
                          setIsClearingAll(false);
                          showToast('Snippets pool cleared');
                        }}
                        className="text-red-600 hover:text-red-700 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:outline-none rounded px-1"
                        aria-label="Confirm clear all phrases"
                      >
                        Yes
                      </button>
                      <span className="text-ink-light">|</span>
                      <button
                        onClick={() => setIsClearingAll(false)}
                        className="text-ink-muted hover:text-ink cursor-pointer focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none rounded px-1"
                        aria-label="Cancel clear all phrases"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsClearingAll(true)}
                      className="text-ink-muted hover:text-terracotta cursor-pointer transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none rounded px-1"
                      title="Clear All Phrases"
                      aria-label="Clear all caught phrases"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Search filter for snippets */}
            <div className="relative w-full flex-shrink-0 select-none">
              <Search className="w-3.5 h-3.5 text-ink-light absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search snippets..."
                value={catcherSearchQuery}
                onChange={(e) => setCatcherSearchQuery(e.target.value)}
                className="w-full bg-white border border-paper-darker rounded-lg pl-8 pr-7 py-1.5 text-xs text-ink placeholder-ink-light/80 focus:outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/20 transition-all"
              />
              {catcherSearchQuery && (
                <button
                  onClick={() => setCatcherSearchQuery('')}
                  className="absolute right-2.5 top-2 text-ink-light hover:text-ink cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Unified Input + Embedded Catch Button */}
            <form onSubmit={handleAddPhrase} className="flex-shrink-0 select-none bg-white/40 p-2.5 border border-paper-darker rounded-xl flex flex-col gap-2.5">
              <textarea
                rows={5}
                placeholder="Capture overheard phrase, dialogue, or hook idea..."
                value={newPhraseText}
                onChange={(e) => setNewPhraseText(e.target.value)}
                className="w-full bg-white border border-paper-darker rounded-lg p-2.5 text-xs text-ink placeholder-ink-light/70 focus:outline-none focus:border-terracotta/40 focus:ring-2 focus:ring-terracotta/15 transition resize-none"
                aria-label="Overheard phrase or hook idea"
              />

              {/* Catch Button */}
              <button
                type="submit"
                className="w-full bg-terracotta hover:bg-terracotta-hover text-white text-[10px] uppercase font-bold tracking-wider py-2 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 shadow-paper-sm hover:scale-[1.01] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                title="Catch Phrase"
                aria-label="Catch overheard phrase"
              >
                Catch
              </button>
            </form>

            {/* Caught list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 min-h-[100px] py-1 select-text">
              {(() => {
                const filtered = phrases.filter(phrase => 
                  phrase.text.toLowerCase().includes(catcherSearchQuery.toLowerCase())
                );

                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center select-none">
                      <div className="w-12 h-12 rounded-full bg-paper-dark flex items-center justify-center text-ink-light mb-4 shadow-inner">
                        <Quote className="w-5 h-5 opacity-40" />
                      </div>
                      <p className="text-xs font-bold text-ink-muted mb-1">No phrases found</p>
                      <p className="text-[10px] text-ink-light leading-relaxed max-w-[180px]">
                        {catcherSearchQuery 
                          ? 'Try adjusting your search query.' 
                          : 'Overhear something cool in public? Catch it here, then spawn a song, append to lyrics or copy it to scrapbook.'}
                      </p>
                    </div>
                  );
                }

                return filtered.map((phrase) => {
                  const isEditing = editingPhraseId === phrase.id;
                  
                  if (isEditing) {
                    return (
                      <div key={phrase.id} className="bg-white border border-terracotta/40 rounded-xl p-3 flex flex-col gap-2 shadow-paper-sm">
                        <textarea
                          value={editingPhraseText}
                          onChange={(e) => setEditingPhraseText(e.target.value)}
                          className="w-full bg-paper border border-paper-darker rounded-lg p-2 text-xs text-ink focus:outline-none resize-none"
                          rows={3}
                          autoFocus
                          aria-label="Edit caught phrase text"
                        />
                        <div className="flex justify-end gap-2 select-none">
                          <button
                            onClick={() => handleUpdatePhrase(phrase.id, editingPhraseText)}
                            className="bg-terracotta hover:bg-terracotta-hover text-white text-[9px] px-2.5 py-1 rounded font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button
                            onClick={() => setEditingPhraseId(null)}
                            className="text-ink-muted hover:text-ink text-[9px] px-2.5 py-1 rounded hover:bg-paper-dark transition cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={phrase.id}
                      className="group relative flex flex-col bg-white border border-paper-darker rounded-xl p-3.5 transition-all duration-300 hover:border-terracotta/30 hover:shadow-paper-md hover:-translate-y-[1.5px] focus-within:border-terracotta/20 overflow-hidden"
                    >
                      {/* Subtle decorative Quote background icon */}
                      <Quote className="absolute right-3 top-3 w-8 h-8 text-terracotta/[0.04] pointer-events-none select-none" />

                      {/* Left Border accent highlight */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-terracotta/40 transition-colors duration-300" />
                      
                      <div className="flex items-start justify-between gap-1 mb-2 relative z-10">
                        <p 
                          onDoubleClick={() => {
                            setEditingPhraseId(phrase.id);
                            setEditingPhraseText(phrase.text);
                          }}
                          className="text-xs italic text-ink font-sans leading-relaxed break-words flex-1 cursor-text"
                          title="Double-click to edit"
                        >
                          "{phrase.text}"
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between select-none relative z-10 border-t border-paper-darker/40 pt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] text-ink-light font-mono">
                            {new Date(phrase.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex gap-1.5 opacity-30 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-200 transform translate-y-0.5 group-hover:translate-y-0">
                          {activeDraft && (
                            <button
                              onClick={() => handleAppendToLyrics(phrase.text)}
                              className="text-ink-muted hover:text-terracotta w-6 h-6 flex items-center justify-center hover:bg-paper-dark rounded transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                              title="Insert into active song lyrics"
                              aria-label="Insert phrase into active lyrics"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleCreateSongFromPhrase(phrase.text)}
                            className="text-ink-muted hover:text-terracotta w-6 h-6 flex items-center justify-center hover:bg-paper-dark rounded transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                            title="Spawn Song Draft"
                            aria-label="Spawn song draft from phrase"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleAddToScrapbook(phrase.text)}
                            className="text-ink-muted hover:text-terracotta w-6 h-6 flex items-center justify-center hover:bg-paper-dark rounded transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                            title="Add to Scrapbook"
                            aria-label="Add phrase to scrapbook of active song"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCopyPhrase(phrase.text)}
                            className="text-ink-muted hover:text-terracotta w-6 h-6 flex items-center justify-center hover:bg-paper-dark rounded transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                            title="Copy to Clipboard"
                            aria-label="Copy phrase to clipboard"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingPhraseId(phrase.id);
                              setEditingPhraseText(phrase.text);
                            }}
                            className="text-ink-muted hover:text-terracotta w-6 h-6 flex items-center justify-center hover:bg-paper-dark rounded transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                            title="Edit phrase"
                            aria-label="Edit phrase"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeletePhrase(phrase.id)}
                            className="text-ink-muted hover:text-red-600 w-6 h-6 flex items-center justify-center hover:bg-red-50 rounded transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:outline-none"
                            title="Delete phrase"
                            aria-label="Delete phrase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Scrapbook Panel */}
      {activePanel === 'scrapbook' && (
        <div className="flex-1 p-4 flex flex-col min-h-0 select-text bg-transparent">
          {activeDraft ? (
            <div className="flex-1 flex flex-col gap-2 h-full min-h-0">
              <label htmlFor="scrapbook-editor" className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold select-none">
                Inspirations & Drama Notes
              </label>
              <textarea
                id="scrapbook-editor"
                value={activeDraft.scrapbook}
                onChange={(e) => updateActiveDraft({ scrapbook: e.target.value })}
                placeholder="Dump pop culture quotes, chick flick lines, overheard dialogues, vocalist drama notes, or basic chords here..."
                className="flex-1 w-full bg-paper/60 border border-paper-darker rounded-lg p-3 text-xs text-ink placeholder-ink-light font-serif leading-relaxed resize-none focus:outline-none focus:border-terracotta focus:bg-paper focus:ring-2 focus:ring-terracotta/20 transition"
              />
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-ink-light select-none">
              Open a song to start scrapbooking.
            </div>
          )}
        </div>
      )}

      {/* Voice Memos Panel */}
      {activePanel === 'audio' && (
        <div className="flex-1 flex flex-col min-h-0 bg-transparent">
          {activeDraft ? (
            <AudioDemoArea
              draftId={activeDraft.id}
              isCloudMode={isCloudMode}
              onAudioChange={(audioCount) => updateActiveDraft({ audioCount })}
            />
          ) : (
            <div className="text-center py-8 text-xs text-ink-light select-none">
              Open a song to record and view voice memos.
            </div>
          )}
        </div>
      )}

      {/* Settings Panel */}
      {activePanel === 'settings' && (
        <div className="flex-1 p-4 flex flex-col justify-between select-none bg-transparent">
          <div className="space-y-4">
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
