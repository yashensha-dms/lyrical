import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CornerDownRight, Search } from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { supabase } from '../utils/supabaseClient';

interface Phrase {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface PhraseCatcherProps {
  onImportPhrase?: (content: string) => void;
  isProjectOpen: boolean;
}

export const PhraseCatcher: React.FC<PhraseCatcherProps> = ({
  onImportPhrase,
  isProjectOpen,
}) => {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [newPhraseText, setNewPhraseText] = useState('');
  const [deletingPhraseId, setDeletingPhraseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch phrases on mount
  useEffect(() => {
    const fetchPhrases = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('phrases')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching phrases:', error.message);
        } else if (data) {
          setPhrases(data);
        }
      } catch (err) {
        console.error('Error in fetchPhrases:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPhrases();
  }, []);

  // Handle Add Phrase
  const handleAddPhrase = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newPhraseText.trim();
    if (!trimmed) return;

    // Generate a temporary ID for optimistic UI update
    const tempId = crypto.randomUUID();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newPhraseItem: Phrase = {
      id: tempId,
      user_id: user.id,
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    // Prepend immediately for zero perceived latency
    setPhrases((prev) => [newPhraseItem, ...prev]);
    setNewPhraseText('');

    try {
      const { data, error } = await supabase
        .from('phrases')
        .insert({
          content: trimmed,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving phrase:', error.message);
        // Rollback on error
        setPhrases((prev) => prev.filter((p) => p.id !== tempId));
      } else if (data) {
        // Replace temp item with actual DB item
        setPhrases((prev) =>
          prev.map((p) => (p.id === tempId ? data : p))
        );
      }
    } catch (err) {
      console.error('Exception adding phrase:', err);
      setPhrases((prev) => prev.filter((p) => p.id !== tempId));
    }
  };

  // Handle Delete Phrase
  const handleDeletePhrase = async (id: string) => {
    // Keep reference of deleted phrase for rollback
    const phraseToDelete = phrases.find((p) => p.id === id);
    if (!phraseToDelete) return;

    // Optimistically update UI
    setPhrases((prev) => prev.filter((p) => p.id !== id));
    setDeletingPhraseId(null);

    try {
      const { error } = await supabase
        .from('phrases')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting phrase:', error.message);
        // Rollback
        setPhrases((prev) => [phraseToDelete, ...prev].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
    } catch (err) {
      console.error('Exception deleting phrase:', err);
      // Rollback
      setPhrases((prev) => [phraseToDelete, ...prev].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    }
  };

  const filteredPhrases = phrases.filter((phrase) =>
    phrase.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Phrase Input */}
      <form onSubmit={handleAddPhrase} className="p-4 border-b border-paper-darker select-none flex items-center gap-2">
        <input
          type="text"
          placeholder="Catch a phrase..."
          value={newPhraseText}
          onChange={(e) => setNewPhraseText(e.target.value)}
          spellCheck="false"
          className="flex-1 bg-paper border border-paper-darker rounded px-3 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition select-text"
        />
        <button
          type="submit"
          disabled={!newPhraseText.trim()}
          className="p-1.5 bg-paper border border-paper-darker text-ink-muted hover:text-ink hover:bg-paper-darker disabled:opacity-40 disabled:cursor-not-allowed rounded transition cursor-pointer flex items-center justify-center"
          title="Add Phrase"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* Search Input */}
      <div className="px-4 pb-3 pt-1 border-b border-paper-darker select-none flex items-center gap-2 relative">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search phrases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            spellCheck="false"
            className="w-full bg-paper border border-paper-darker rounded pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition select-text"
          />
          <Search className="w-3.5 h-3.5 text-ink-light absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Phrases List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-ink-light italic">
            Loading phrases...
          </div>
        ) : phrases.length === 0 ? (
          <div className="text-center py-12 select-none">
            <p className="text-xs text-ink-muted font-serif italic">
              Scratchpad is empty. Catch your first lyric snippet above.
            </p>
          </div>
        ) : filteredPhrases.length === 0 ? (
          <div className="text-center py-12 select-none">
            <p className="text-xs text-ink-muted font-serif italic">
              No matching phrases found.
            </p>
          </div>
        ) : (
          filteredPhrases.map((phrase) => (
            <div
              key={phrase.id}
              className="bg-paper border border-paper-darker rounded-lg p-3 relative flex flex-col justify-between group hover:border-terracotta/20 transition-all duration-200 card-warm"
            >
              <p className="text-xs text-ink font-serif leading-relaxed mb-4 pr-12 select-text break-words whitespace-pre-wrap">
                {phrase.content}
              </p>

              {/* Action Buttons */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                {/* Import Button */}
                <Tooltip.Provider delayDuration={200}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span>
                        <button
                          onClick={() => isProjectOpen && onImportPhrase && onImportPhrase(phrase.content)}
                          disabled={!isProjectOpen}
                          className="p-1 text-ink-muted hover:text-terracotta disabled:opacity-40 disabled:hover:text-ink-muted disabled:cursor-not-allowed bg-paper border border-paper-darker hover:bg-paper-darker rounded transition cursor-pointer"
                          aria-label="Import to active editor"
                        >
                          <CornerDownRight className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-ink text-paper text-[10px] px-2.5 py-1 rounded shadow-paper-md max-w-xs z-50 select-none"
                        side="right"
                        sideOffset={6}
                      >
                        {isProjectOpen 
                          ? "Insert at cursor in active editor" 
                          : "Disabled: Open a song project first to import phrases"
                        }
                        <Tooltip.Arrow className="fill-ink" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>

                {/* Delete Trigger */}
                <button
                  onClick={() => setDeletingPhraseId(phrase.id)}
                  className="p-1 text-ink-muted hover:text-terracotta bg-paper border border-paper-darker hover:bg-paper-darker rounded transition cursor-pointer"
                  aria-label="Delete phrase"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Alert */}
      <AlertDialog.Root
        open={!!deletingPhraseId}
        onOpenChange={(open: boolean) => !open && setDeletingPhraseId(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="radix-overlay" />
          <AlertDialog.Content className="radix-dialog-content select-none">
            <AlertDialog.Title className="text-sm font-bold text-ink mb-2">
              Delete Phrase
            </AlertDialog.Title>
            <AlertDialog.Description className="text-xs text-ink-muted mb-5">
              Are you sure you want to delete this phrase? This action will remove it permanently.
            </AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button className="px-3.5 py-1.5 border border-paper-darker rounded-md text-xs font-semibold text-ink-muted hover:bg-paper-active transition cursor-pointer">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={() => {
                    if (deletingPhraseId) {
                      handleDeletePhrase(deletingPhraseId);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-terracotta hover:bg-terracotta-hover text-white rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Delete
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
};
