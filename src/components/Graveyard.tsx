import React, { useState, useEffect } from 'react';
import { CornerDownRight, Search } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { supabase } from '../utils/supabaseClient';

interface GraveyardEntry {
  id: string;
  user_id: string;
  content: string;
  project_name: string;
  created_at: string;
}

interface GraveyardProps {
  onImportPhrase?: (content: string) => void;
  isProjectOpen: boolean;
  refreshTrigger?: number; // Prop to trigger refetch when a new item is added
}

export const Graveyard: React.FC<GraveyardProps> = ({
  onImportPhrase,
  isProjectOpen,
  refreshTrigger = 0,
}) => {
  const [entries, setEntries] = useState<GraveyardEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('graveyard')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching graveyard:', error.message);
      } else if (data) {
        setEntries(data);
      }
    } catch (err) {
      console.error('Error in fetchEntries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch entries on mount or when refreshTrigger changes
  useEffect(() => {
    fetchEntries();
  }, [refreshTrigger]);

  const filteredEntries = entries.filter((entry) =>
    entry.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Search Input */}
      <div className="p-4 border-b border-paper-darker select-none flex items-center gap-2 relative">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search graveyard..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            spellCheck="false"
            className="w-full bg-paper border border-paper-darker rounded pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition select-text"
          />
          <Search className="w-3.5 h-3.5 text-ink-light absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-ink-light italic">
            Loading graveyard...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12 select-none">
            <p className="text-xs text-ink-muted font-serif italic leading-relaxed">
              {searchQuery
                ? 'No matching graveyard entries found.'
                : 'The Graveyard is empty. Highlight text or select a line in the editor and press Ctrl+G to move it here.'}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-paper border border-paper-darker rounded-lg p-3 relative flex flex-col justify-between group hover:border-terracotta/20 transition-all duration-200 card-warm"
            >
              <p className="text-xs text-ink font-serif leading-relaxed mb-4 pr-10 select-text break-words whitespace-pre-wrap">
                {entry.content}
              </p>

              {/* Card Footer: Project Name & Date */}
              <div className="flex items-center justify-between text-[9px] text-ink-light select-none border-t border-paper-darker/40 pt-2">
                <span className="font-mono truncate max-w-[120px] font-semibold text-terracotta/80" title={entry.project_name}>
                  {entry.project_name}
                </span>
                <span>{formatDate(entry.created_at)}</span>
              </div>

              {/* Action Buttons */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                {/* Import Button */}
                <Tooltip.Provider delayDuration={200}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span>
                        <button
                          onClick={() => isProjectOpen && onImportPhrase && onImportPhrase(entry.content)}
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
                          : "Disabled: Open a song project first to import"
                        }
                        <Tooltip.Arrow className="fill-ink" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
