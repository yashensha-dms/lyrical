import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';

interface RhymeData {
  word: string;
  perfect: string[];
  slant: string[];
  perfect_bigrams: string[];
  slant_bigrams: string[];
}

interface RhymePanelProps {
  lookupWord: string | null;
  data: RhymeData | null;
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
  onSearch: (word: string) => void;
}

export const RhymePanel: React.FC<RhymePanelProps> = ({
  lookupWord,
  data,
  isLoading,
  error,
  onClear,
  onSearch,
}) => {
  const [manualInput, setManualInput] = useState('');

  // Sync manual input with lookupWord when lookupWord changes
  useEffect(() => {
    if (lookupWord) {
      setManualInput(lookupWord);
    } else {
      setManualInput('');
    }
  }, [lookupWord]);

  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualInput.trim();
    if (trimmed) {
      onSearch(trimmed);
    }
  };

  const handleClearClick = () => {
    setManualInput('');
    onClear();
  };

  const hasResults =
    data &&
    (data.perfect.length > 0 ||
      data.slant.length > 0 ||
      data.perfect_bigrams.length > 0 ||
      data.slant_bigrams.length > 0);

  const showEmptyState = !isLoading && (error || (data && !hasResults));

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Header lookup word state */}
      <div className="p-4 border-b border-paper-darker flex items-center justify-between min-h-14 select-none flex-shrink-0">
        {lookupWord ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold text-ink-muted tracking-wider">Lookup:</span>
            <span className="px-2.5 py-0.5 bg-paper border border-paper-darker text-terracotta font-serif text-sm font-semibold rounded truncate shadow-xs">
              {lookupWord}
            </span>
          </div>
        ) : (
          <span className="text-xs text-ink-muted italic font-serif">
            double click any word to find rhymes
          </span>
        )}

        {lookupWord && (
          <button
            onClick={handleClearClick}
            className="p-1 text-ink-muted hover:text-ink hover:bg-paper-darker rounded transition cursor-pointer flex-shrink-0 ml-2"
            title="Clear current word"
            aria-label="Clear current word"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Manual Search Form */}
      <form onSubmit={handleManualSearchSubmit} className="px-4 py-3 border-b border-paper-darker flex items-center gap-2 select-none flex-shrink-0 bg-paper-dark/10">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search rhymes manually..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            spellCheck="false"
            className="w-full bg-paper border border-paper-darker rounded pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition select-text"
          />
          <Search className="w-3.5 h-3.5 text-ink-light absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
        <button
          type="submit"
          disabled={isLoading || !manualInput.trim()}
          className="px-3 py-1.5 bg-paper border border-paper-darker text-ink-muted hover:text-ink hover:bg-paper-darker disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs transition cursor-pointer font-medium"
        >
          Find
        </button>
      </form>

      {/* Rhyme Results Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading && (
          <div className="text-xs text-ink-muted font-serif italic py-4 select-none">
            finding rhymes...
          </div>
        )}

        {showEmptyState && (
          <div className="text-xs text-ink-muted font-serif italic py-4 select-none">
            no rhymes found
          </div>
        )}

        {!lookupWord && !isLoading && !error && (
          <div className="text-xs text-ink-muted font-serif italic py-4 select-none">
            double click any word in the editor to load rhymes.
          </div>
        )}

        {data && !isLoading && !error && hasResults && (
          <>
            {/* 1. Perfect Rhymes */}
            {data.perfect.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-ink-light select-none block">
                  Perfect Rhymes
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {data.perfect.map((word) => (
                    <span
                      key={word}
                      onDoubleClick={() => onSearch(word)}
                      className="px-2.5 py-1 text-xs bg-paper border border-paper-darker text-ink rounded-full font-serif select-all cursor-pointer hover:border-terracotta/40 hover:text-terracotta transition-all"
                      title="Double click to search"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Perfect Phrases */}
            {data.perfect_bigrams.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-ink-light select-none block">
                  Perfect Phrases
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {data.perfect_bigrams.map((phrase) => (
                    <span
                      key={phrase}
                      className="px-2.5 py-1 text-xs bg-paper border border-paper-darker text-ink rounded-full font-serif select-all"
                    >
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Slant Rhymes */}
            {data.slant.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-ink-light select-none block">
                  Slant Rhymes
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {data.slant.map((word) => (
                    <span
                      key={word}
                      onDoubleClick={() => onSearch(word)}
                      className="px-2.5 py-1 text-xs bg-paper border border-paper-darker text-ink rounded-full font-serif select-all cursor-pointer hover:border-terracotta/40 hover:text-terracotta transition-all"
                      title="Double click to search"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Slant Phrases */}
            {data.slant_bigrams.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-ink-light select-none block">
                  Slant Phrases
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {data.slant_bigrams.map((phrase) => (
                    <span
                      key={phrase}
                      className="px-2.5 py-1 text-xs bg-paper border border-paper-darker text-ink rounded-full font-serif select-all"
                    >
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
