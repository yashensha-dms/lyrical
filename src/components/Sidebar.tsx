import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, FileDown, FileUp, ChevronLeft, Mic, Copy, PlusCircle, FileText, ChevronDown, ChevronUp, Quote } from 'lucide-react';
import type { Draft } from '../hooks/useDrafts';
import { AudioDemoArea } from './AudioDemoArea';

interface Phrase {
  id: string;
  text: string;
  createdAt: number;
}

interface SidebarProps {
  activePanel: 'explorer' | 'scrapbook' | 'audio' | 'settings';
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  // Phrase Catcher state
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [newPhraseText, setNewPhraseText] = useState('');
  const [isPhraseCatcherOpen, setIsPhraseCatcherOpen] = useState(true);

  // Load phrases from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('lyrical_caught_phrases');
      if (stored) {
        setPhrases(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load caught phrases', e);
    }
  }, []);

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
    newPhraseText.trim();
    setNewPhraseText('');
  };

  const handleDeletePhrase = (id: string) => {
    savePhrases(phrases.filter(p => p.id !== id));
  };

  const handleCopyPhrase = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleAddToScrapbook = (text: string) => {
    if (!activeDraft) {
      alert('Open a song first to add this phrase to its scrapbook.');
      return;
    }
    const currentScrapbook = activeDraft.scrapbook || '';
    const delimiter = currentScrapbook ? '\n' : '';
    updateActiveDraft({
      scrapbook: `${currentScrapbook}${delimiter}- Overheard/Idea: "${text}"`,
    });
  };

  const handleCreateSongFromPhrase = (text: string) => {
    createDraft(text);
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
    <div className="w-64 h-full bg-paper-dark/70 border-r border-paper-darker flex flex-col flex-shrink-0 z-10">
      {/* Sidebar Header */}
      <div className="h-14 px-4 border-b border-paper-darker flex items-center justify-between select-none">
        <span className="font-semibold tracking-wide text-ink text-sm uppercase">
          {activePanel === 'explorer' && 'Songs'}
          {activePanel === 'scrapbook' && 'Scrapbook'}
          {activePanel === 'audio' && 'Voice Memos'}
          {activePanel === 'settings' && 'Settings'}
        </span>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="text-ink-muted hover:text-ink hover:bg-paper-darker p-1 rounded cursor-pointer"
          title="Collapse Panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
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
                
                return (
                  <div
                    key={draft.id}
                    onClick={() => !isEditing && selectDraft(draft.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition select-none ${
                      isActive
                        ? 'bg-paper-darker text-ink font-medium border border-paper-darker shadow-paper-sm'
                        : 'text-ink-muted hover:text-ink hover:bg-paper-dark/30'
                    }`}
                  >
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
                          {draft.hasAudio && (
                            <Mic className="w-3 h-3 text-terracotta flex-shrink-0" />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {!isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${draft.title}"? This cannot be undone.`)) {
                            deleteDraft(draft.id);
                          }
                        }}
                        className="text-ink-light hover:text-terracotta opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-paper-dark/50 cursor-pointer transition duration-150"
                        title="Delete Song"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Phrase Catcher Collapsible Drawer */}
          <div className="border-t border-paper-darker flex flex-col bg-paper-dark/20 flex-shrink-0">
            {/* Header */}
            <div
              onClick={() => setIsPhraseCatcherOpen(!isPhraseCatcherOpen)}
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-paper-dark/40 transition select-none"
            >
              <div className="flex items-center gap-1.5">
                <Quote className="w-3.5 h-3.5 text-terracotta" />
                <span className="text-[10px] font-semibold tracking-wider text-ink uppercase">
                  Phrase Catcher
                </span>
                {phrases.length > 0 && (
                  <span className="bg-terracotta text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-none">
                    {phrases.length}
                  </span>
                )}
              </div>
              <button className="text-ink-muted">
                {isPhraseCatcherOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Content Drawer */}
            {isPhraseCatcherOpen && (
              <div className="p-3 border-t border-paper-darker space-y-2 flex flex-col max-h-56">
                <form onSubmit={handleAddPhrase} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Overheard phrase..."
                    value={newPhraseText}
                    onChange={(e) => setNewPhraseText(e.target.value)}
                    className="flex-1 bg-paper border border-paper-darker rounded px-2 py-1 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition"
                  />
                  <button
                    type="submit"
                    className="bg-paper border border-paper-darker hover:bg-paper-darker text-ink text-xs px-2 py-1 rounded cursor-pointer transition shadow-paper-sm flex-shrink-0"
                    title="Catch Phrase"
                  >
                    Catch
                  </button>
                </form>

                {/* Caught list */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 select-text min-h-[60px]">
                  {phrases.length === 0 ? (
                    <div className="text-center py-4 text-[10px] text-ink-light select-none italic leading-relaxed">
                      No phrases logged yet.<br />Save overheard dialogue here!
                    </div>
                  ) : (
                    phrases.map((phrase) => (
                      <div
                        key={phrase.id}
                        className="group flex flex-col bg-paper border border-paper-darker rounded p-2 transition hover:border-terracotta"
                      >
                        <p className="text-xs font-serif italic text-ink leading-normal mb-1 break-words">
                          "{phrase.text}"
                        </p>
                        
                        <div className="flex items-center justify-between select-none">
                          <span className="text-[8px] text-ink-light font-mono">
                            {new Date(phrase.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition duration-150">
                            <button
                              onClick={() => handleCreateSongFromPhrase(phrase.text)}
                              className="text-ink-light hover:text-terracotta p-0.5 rounded cursor-pointer"
                              title="Create Song from Phrase"
                            >
                              <PlusCircle className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleAddToScrapbook(phrase.text)}
                              className="text-ink-light hover:text-terracotta p-0.5 rounded cursor-pointer"
                              title="Add to Scrapbook"
                            >
                              <FileText className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleCopyPhrase(phrase.text)}
                              className="text-ink-light hover:text-terracotta p-0.5 rounded cursor-pointer"
                              title="Copy to Clipboard"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeletePhrase(phrase.id)}
                              className="text-ink-light hover:text-terracotta p-0.5 rounded cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scrapbook Panel */}
      {activePanel === 'scrapbook' && (
        <div className="flex-1 p-4 flex flex-col min-h-0 select-text">
          {activeDraft ? (
            <div className="flex-1 flex flex-col gap-2 h-full min-h-0">
              <label className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold select-none">
                Inspirations & Drama Notes
              </label>
              <textarea
                value={activeDraft.scrapbook}
                onChange={(e) => updateActiveDraft({ scrapbook: e.target.value })}
                placeholder="Dump pop culture quotes, chick flick lines, overheard dialogues, vocalist drama notes, or basic chords here..."
                className="flex-1 w-full bg-paper/60 border border-paper-darker rounded-lg p-3 text-xs text-ink placeholder-ink-light font-serif leading-relaxed resize-none focus:outline-none focus:border-terracotta focus:bg-paper transition"
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
        <div className="flex-1 flex flex-col min-h-0">
          {activeDraft ? (
            <AudioDemoArea
              draftId={activeDraft.id}
              isCloudMode={isCloudMode}
              onAudioChange={(hasAudio) => updateActiveDraft({ hasAudio })}
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
        <div className="flex-1 p-4 flex flex-col justify-between select-none">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">Backups</h4>
              <p className="text-[11px] text-ink-muted leading-relaxed mb-3">
                Export or import your songwriting workspace. All files remain strictly local in your browser.
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={exportAllDrafts}
                  className="w-full flex items-center justify-center gap-2 bg-paper border border-paper-darker hover:bg-paper-darker text-ink text-xs py-2 rounded-md transition cursor-pointer shadow-paper-sm"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Backup Library (JSON)
                </button>

                <label
                  className="w-full flex items-center justify-center gap-2 bg-paper border border-paper-darker hover:bg-paper-darker text-ink text-xs py-2 rounded-md transition cursor-pointer shadow-paper-sm"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  Restore Library
                  <input
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
    </div>
  );
};
