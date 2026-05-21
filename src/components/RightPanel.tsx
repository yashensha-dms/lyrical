import React, { useState, useEffect, useMemo } from 'react';
import { Music, Sparkles, Loader2, Search } from 'lucide-react';
import { fetchRhymes } from '../utils/rhymes';
import type { RhymeResult } from '../utils/rhymes';
import type { Draft } from '../hooks/useDrafts';
import { scanComplexity } from '../utils/simplifier';

interface RightPanelProps {
  selectedWord: string;
  content: string;
  targetTemplate: string;
  syllableTolerance: number;
  updateActiveDraft: (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => void;
  setIsRightPanelOpen: (open: boolean) => void;
  isMobile?: boolean;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedWord,
  content,
  targetTemplate,
  syllableTolerance,
  updateActiveDraft,
  setIsRightPanelOpen: _setIsRightPanelOpen,
  isMobile = false,
}) => {
  const [activeTab, setActiveTab] = useState<'rhymes' | 'templates' | 'simplifier'>('rhymes');
  
  // Scan for complex words in active draft's content
  const matches = useMemo(() => scanComplexity(content), [content]);

  // Rhymes state
  const [queryWord, setQueryWord] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [rhymes, setRhymes] = useState<RhymeResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync selected word from editor to queryWord (done during render to avoid useEffect cascading renders)
  const [prevSelectedWord, setPrevSelectedWord] = useState(selectedWord);
  if (selectedWord !== prevSelectedWord) {
    setPrevSelectedWord(selectedWord);
    if (selectedWord) {
      setQueryWord(selectedWord);
      setActiveTab('rhymes');
    }
  }

  // Fetch rhymes when queryWord changes
  useEffect(() => {
    if (!queryWord) return;

    const performSearch = async () => {
      setLoading(true);
      try {
        const results = await fetchRhymes(queryWord);
        setRhymes(results);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [queryWord]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualQuery.trim()) {
      setQueryWord(manualQuery.trim());
      setManualQuery('');
    }
  };

  // Group rhymes by syllable count
  const perfectRhymes = rhymes.filter(r => r.type === 'perfect');
  const nearRhymes = rhymes.filter(r => r.type === 'near');

  const groupBySyllable = (list: RhymeResult[]) => {
    const groups: { [key: number]: string[] } = {};
    list.forEach(r => {
      if (!groups[r.syllables]) {
        groups[r.syllables] = [];
      }
      groups[r.syllables].push(r.word);
    });
    return groups;
  };

  const perfectGroups = groupBySyllable(perfectRhymes);
  const nearGroups = groupBySyllable(nearRhymes);

  return (
    <div className={`${isMobile ? 'w-full' : 'w-64'} h-full bg-paper-dark/70 border-l border-paper-darker flex flex-col flex-shrink-0 z-10`}>
      {/* Panel Header with Modern Borderless Tabs */}
      <div className="h-14 px-4 border-b border-paper-darker flex items-center justify-between select-none flex-shrink-0 bg-paper-dark">
        <div className="flex gap-5 text-xs tracking-wider h-full items-stretch">
          <button
            onClick={() => setActiveTab('rhymes')}
            className={`relative flex items-center px-0.5 cursor-pointer transition-all duration-200 ${
              activeTab === 'rhymes'
                ? 'text-terracotta font-semibold'
                : 'text-ink-muted hover:text-ink font-medium'
            }`}
          >
            Rhymes
            <span className={`absolute bottom-0 left-0 right-0 h-[2px] bg-terracotta rounded-t-full transition-all duration-300 origin-center ${
              activeTab === 'rhymes' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
            }`} />
          </button>
          <button
            onClick={() => setActiveTab('simplifier')}
            className={`relative flex items-center px-0.5 cursor-pointer transition-all duration-200 ${
              activeTab === 'simplifier'
                ? 'text-terracotta font-semibold'
                : 'text-ink-muted hover:text-ink font-medium'
            }`}
          >
            <span>Simplifier</span>
            {matches.length > 0 && (
              <span className="ml-1 h-3.5 min-w-[14px] px-1 inline-flex items-center justify-center bg-terracotta text-white rounded-full text-[8px] font-mono font-bold select-none">
                {matches.length}
              </span>
            )}
            <span className={`absolute bottom-0 left-0 right-0 h-[2px] bg-terracotta rounded-t-full transition-all duration-300 origin-center ${
              activeTab === 'simplifier' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
            }`} />
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`relative flex items-center px-0.5 cursor-pointer transition-all duration-200 ${
              activeTab === 'templates'
                ? 'text-terracotta font-semibold'
                : 'text-ink-muted hover:text-ink font-medium'
            }`}
          >
            Templates
            <span className={`absolute bottom-0 left-0 right-0 h-[2px] bg-terracotta rounded-t-full transition-all duration-300 origin-center ${
              activeTab === 'templates' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto min-h-0 select-text">
        {activeTab === 'rhymes' && (
          <div className="p-4 flex flex-col h-full min-h-0">
            {/* Manual Lookup Input */}
            <form onSubmit={handleManualSearch} className="mb-4 relative select-none">
              <input
                type="text"
                placeholder="Search rhymes manually..."
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                className="w-full bg-paper border border-paper-darker rounded-lg pl-3 pr-9 py-2 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta/20 transition-all duration-200 shadow-paper-sm"
                style={{ fontSize: isMobile ? '16px' : undefined }}
              />
              <button
                type="submit"
                className="absolute right-1 top-1 bottom-1 px-2.5 rounded-md hover:bg-paper-darker text-ink-muted hover:text-ink cursor-pointer transition flex items-center justify-center"
                title="Search Rhymes"
              >
                <Search className="w-4 h-4 stroke-[2]" />
              </button>
            </form>

            {/* Results */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-ink-light gap-2 select-none">
                <Loader2 className="w-5 h-5 animate-spin text-terracotta" />
                <span className="text-xs">Searching vocabulary...</span>
              </div>
            ) : queryWord ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-paper-darker pb-2.5 select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider text-ink-muted uppercase">Rhymes for:</span>
                    <span className="text-xs font-serif font-bold text-terracotta italic bg-terracotta-light px-2 py-0.5 rounded border border-terracotta/10">"{queryWord}"</span>
                  </div>
                  <button
                    onClick={() => {
                      setQueryWord('');
                      setManualQuery('');
                    }}
                    className="text-[9px] font-mono font-medium text-ink-light hover:text-terracotta cursor-pointer transition uppercase tracking-wider hover:underline"
                  >
                    Clear
                  </button>
                </div>

                {/* Perfect Rhymes */}
                {perfectRhymes.length > 0 && (
                  <div className="bg-paper/40 p-3 rounded-lg border border-paper-darker/60 shadow-paper-sm">
                    <h5 className="text-[10px] font-bold text-ink uppercase tracking-widest mb-3 select-none flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-terracotta" /> Perfect Rhymes
                    </h5>
                    <div className="space-y-3.5 pl-0.5">
                      {Object.entries(perfectGroups).map(([syllables, words]) => (
                        <div key={syllables} className="text-xs">
                          <span className="text-[9px] font-mono font-semibold text-ink-muted block mb-1.5 select-none uppercase tracking-wide">
                            {syllables} Syllable{parseInt(syllables) > 1 ? 's' : ''}:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {words.map(w => (
                              <span
                                key={w}
                                className={`bg-paper hover:bg-terracotta-light border border-paper-darker hover:border-terracotta/40 px-2.5 rounded-md text-[11px] text-ink cursor-pointer transition-all duration-150 hover:scale-[1.03] active:scale-[0.98] flex items-center ${isMobile ? 'py-2.5 min-h-[44px]' : 'py-1'}`}
                                onClick={() => setQueryWord(w)}
                              >
                                {w}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Near Rhymes */}
                {nearRhymes.length > 0 && (
                  <div className="bg-paper/40 p-3 rounded-lg border border-paper-darker/60 shadow-paper-sm">
                    <h5 className="text-[10px] font-bold text-ink uppercase tracking-widest mb-3 select-none flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-terracotta" /> Near Rhymes
                    </h5>
                    <div className="space-y-3.5 pl-0.5">
                      {Object.entries(nearGroups).map(([syllables, words]) => (
                        <div key={syllables} className="text-xs">
                          <span className="text-[9px] font-mono font-semibold text-ink-muted block mb-1.5 select-none uppercase tracking-wide">
                            {syllables} Syllable{parseInt(syllables) > 1 ? 's' : ''}:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {words.map(w => (
                              <span
                                key={w}
                                className={`bg-paper hover:bg-terracotta-light border border-paper-darker hover:border-terracotta/40 px-2.5 rounded-md text-[11px] text-ink-muted cursor-pointer transition-all duration-150 hover:scale-[1.03] active:scale-[0.98] flex items-center ${isMobile ? 'py-2.5 min-h-[44px]' : 'py-1'}`}
                                onClick={() => setQueryWord(w)}
                              >
                                {w}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rhymes.length === 0 && (
                  <div className="text-center py-6 text-xs text-ink-light select-none">
                    No song-friendly rhymes found for "{queryWord}".
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-paper-dark/30 border border-paper-darker rounded-xl text-ink select-none shadow-paper-sm transition-all duration-300">
                <div className="w-10 h-10 rounded-full bg-terracotta-light flex items-center justify-center text-terracotta mb-3 shadow-inner animate-pulse" style={{ animationDuration: '3s' }}>
                  <Sparkles className="w-5 h-5 stroke-[1.5]" />
                </div>
                <h4 className="text-xs font-semibold text-ink mb-1.5">Find the Perfect Rhyme</h4>
                <p className="text-[11px] text-ink-muted leading-relaxed max-w-[200px] mb-4">
                  Double-click any word in your lyrics, or type in the search bar above to see pop-friendly matches.
                </p>
                <div className="w-full border-t border-paper-darker/60 pt-4">
                  <span className="text-[9px] font-mono font-medium text-ink-light uppercase tracking-wider block mb-2">
                    Try sample words
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {['heart', 'night', 'dream', 'free', 'mind'].map((word) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() => {
                          setQueryWord(word);
                          setManualQuery('');
                        }}
                        className="bg-paper hover:bg-terracotta-light border border-paper-darker hover:border-terracotta/40 px-2 py-0.5 rounded text-[10px] text-ink-muted hover:text-terracotta cursor-pointer transition-all duration-150 active:scale-[0.97] hover:scale-[1.03]"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="p-4 flex flex-col select-text">
            <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2 select-none">
              Syllables Target Template
            </h4>
            <p className="text-[11px] text-ink-muted leading-relaxed mb-4 select-none">
              Set your target syllable counts for each line (one per line, e.g. 8, 6, 8, 6). The editor will highlight lines that do not match.
            </p>

            <div className="relative group select-none">
              <textarea
                value={targetTemplate}
                onChange={(e) => updateActiveDraft({ targetTemplate: e.target.value })}
                placeholder="e.g.&#10;8&#10;7&#10;8&#10;7"
                className="w-full h-32 bg-paper border border-paper-darker rounded-lg p-3 font-mono text-xs text-ink placeholder-ink-light leading-relaxed focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta/20 transition-all duration-200 resize-none shadow-inner select-text"
              />
              <div className="absolute right-2.5 bottom-2.5 pointer-events-none select-none text-[8px] font-mono text-ink-light opacity-60 group-focus-within:opacity-100 transition-opacity">
                lines count
              </div>
            </div>

            {/* Meter Strictness Selector */}
            <div className="mt-6 select-none bg-paper/40 p-3.5 rounded-lg border border-paper-darker/60 shadow-paper-sm">
              <span className="text-[10px] font-bold text-ink uppercase tracking-wider block mb-3">
                Meter Strictness
              </span>
              <div className="relative flex bg-paper-dark p-1 rounded-lg border border-paper-darker/60">
                {[
                  { value: 0, label: 'Strict' },
                  { value: 1, label: 'Flexible' },
                  { value: 2, label: 'Relaxed' },
                ].map((opt) => {
                  const isActive = syllableTolerance === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateActiveDraft({ syllableTolerance: opt.value })}
                      className={`relative flex-1 text-[10px] font-semibold py-1.5 rounded-md cursor-pointer transition-all duration-300 z-10 ${
                        isActive
                          ? 'text-terracotta'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {/* Pill Background Overlay for Active Option */}
                      {isActive && (
                        <span className="absolute inset-0 bg-paper rounded-md shadow-paper-sm border border-paper-darker/30 -z-10 transition-transform duration-300" />
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 p-2 bg-paper/50 rounded border border-paper-darker/40 min-h-[48px] flex items-center">
                <p className="text-[10px] text-ink-muted leading-relaxed">
                  {syllableTolerance === 0 && 'Strict: Line must match syllables exactly.'}
                  {syllableTolerance === 1 && 'Allows ±1 syllable variation (recommended for melodic flow).'}
                  {syllableTolerance === 2 && 'Allows ±2 syllables variation (relaxed speech/rhythm flow).'}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-paper border border-paper-darker rounded-lg text-[10px] text-ink-muted leading-relaxed select-none">
              <span className="font-semibold text-ink block mb-1">Pop Tip:</span>
              Most massive Swedish hits use symmetrical grids. Standard templates like 8-7-8-7 or 8-6-8-6 maintain the mathematical bounce of rhythmic pop hooks.
            </div>
          </div>
        )}

        {activeTab === 'simplifier' && (
          <div className="p-4 flex flex-col h-full min-h-0 select-text">
            <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-1.5 select-none flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-terracotta" /> Anti-Thesaurus
            </h4>
            <p className="text-[11px] text-ink-muted leading-relaxed mb-4 select-none">
              Emily Warren's conversational flow checker. Recommends simple songwriting alternatives to keep your lyrics natural and clear.
            </p>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pb-4 pr-0.5">
              {matches.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-paper-darker rounded-lg text-ink-light select-none">
                  <span className="text-emerald-500 font-bold text-lg block mb-1">✓</span>
                  <p className="text-[11px] leading-relaxed">
                    All words sound conversational. Emily Warren would approve!
                  </p>
                </div>
              ) : (
                matches.map((match, idx) => (
                  <div key={idx} className="bg-paper border border-paper-darker rounded-lg p-3 space-y-2.5 shadow-paper-sm hover:shadow-paper-md transition-shadow duration-200">
                    <div className="flex items-center justify-between select-none">
                      <span className="text-xs font-serif font-bold text-ink italic">
                        "{match.word}"
                      </span>
                      <span className="text-[8px] uppercase font-bold px-2 py-0.5 rounded bg-amber-light text-amber border border-amber/10">
                        {match.reason === 'dictionary' ? 'complex' : '4+ syllables'}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-ink-muted select-none mr-0.5">Try:</span>
                      {match.suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            const before = content.slice(0, match.index);
                            const after = content.slice(match.index + match.word.length);
                            updateActiveDraft({ content: before + s + after });
                          }}
                          className="bg-paper border border-paper-darker hover:bg-terracotta hover:text-white hover:border-terracotta px-2 py-0.5 rounded text-[10px] font-bold text-terracotta transition-all duration-150 hover:scale-[1.03] cursor-pointer"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
