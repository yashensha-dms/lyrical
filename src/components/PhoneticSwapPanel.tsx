import React, { useState } from 'react';
import { Search, Info } from 'lucide-react';

interface SwapData {
  word: string;
  phonemes: string;
  results: string[];
}

export const PhoneticSwapPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<SwapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwapSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/phonetic-swap?word=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        throw new Error('Failed to search phonetic swaps');
      }
      const resData = await response.json();
      setData(resData);
    } catch (err: any) {
      setError(err.message || 'Error executing phonetic swap');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Header */}
      <div className="p-4 border-b border-paper-darker flex flex-col gap-1 select-none flex-shrink-0">
        <span className="text-xs font-semibold text-ink uppercase tracking-wider block">Phonetic Word Swap</span>
        <span className="text-[10px] text-ink-muted leading-relaxed">
          Swaps dummy syllable clusters or gibberish with conversationally frequent hit song words.
        </span>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSwapSearch} className="px-4 py-3 border-b border-paper-darker flex items-center gap-2 select-none flex-shrink-0 bg-paper-dark/10">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Type cluster (e.g. 'bada', 'la-la')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck="false"
            className="w-full bg-paper border border-paper-darker rounded pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition select-text"
          />
          <Search className="w-3.5 h-3.5 text-ink-light absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-3 py-1.5 bg-paper border border-paper-darker text-ink-muted hover:text-ink hover:bg-paper-darker disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs transition cursor-pointer font-semibold"
        >
          Swap
        </button>
      </form>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && (
          <div className="text-xs text-ink-muted font-serif italic py-4 select-none">
            generating word swaps...
          </div>
        )}

        {error && (
          <div className="text-xs text-rose-500 font-serif italic py-4 select-none">
            {error}
          </div>
        )}

        {!data && !isLoading && !error && (
          <div className="text-xs text-ink-muted font-serif italic py-4 select-none leading-relaxed space-y-2">
            <p>
              Type a dummy syllable cluster or sound shape above to find words that sound similar and fit naturally in lyrics.
            </p>
            <div className="bg-paper-dark/25 p-2.5 rounded border border-paper-darker font-sans not-italic text-[10px] space-y-1">
              <span className="font-bold uppercase tracking-wider block text-ink">Examples:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-ink-muted">
                <li><span className="font-mono text-terracotta">bada</span> &rarr; matching rhythmic shapes like "body", "better"</li>
                <li><span className="font-mono text-terracotta">la-la</span> &rarr; matching vowel sounds like "lay down", "light up"</li>
                <li><span className="font-mono text-terracotta">AA AH</span> &rarr; matches raw CMU phoneme sounds</li>
              </ul>
            </div>
          </div>
        )}

        {data && !isLoading && !error && (
          <div className="space-y-4 select-none">
            {/* Phoneme Shape Mapped */}
            {data.phonemes && (
              <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-ink-muted tracking-wider bg-paper border border-paper-darker px-2 py-1 rounded">
                <span>Sound Profile:</span>
                <span className="font-mono text-terracotta text-[10px]">{data.phonemes}</span>
              </div>
            )}

            {/* Swap Results */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-ink-light block">
                Matching Conversational Words
              </span>
              
              {data.results.length === 0 ? (
                <div className="text-xs text-ink-muted font-serif italic py-2">
                  no matching words found
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.results.map((word) => (
                    <span
                      key={word}
                      className="px-2.5 py-1 text-xs bg-paper border border-paper-darker text-ink rounded-full font-serif select-all cursor-pointer hover:border-terracotta/40 hover:text-terracotta transition-all"
                      title="Double click to copy"
                      onDoubleClick={() => {
                        navigator.clipboard.writeText(word);
                        alert(`Copied "${word}" to clipboard!`);
                      }}
                    >
                      {word}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-paper border border-paper-darker rounded-lg p-2.5 text-[10px] text-ink-muted leading-relaxed flex items-start gap-1">
              <Info className="w-3.5 h-3.5 text-ink-light mt-0.5 flex-shrink-0" />
              <span>
                Double-click any word to copy it to your clipboard. Words are sorted by phonetic similarity and corpus frequency.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
