import React, { useState, useEffect, useMemo } from 'react';
import { Music, AlertCircle, Sparkles, ChevronRight, Loader2, Search } from 'lucide-react';
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
}

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedWord,
  content,
  targetTemplate,
  syllableTolerance,
  updateActiveDraft,
  setIsRightPanelOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'rhymes' | 'templates' | 'simplifier'>('rhymes');
  
  // Scan for complex words in active draft's content
  const matches = useMemo(() => scanComplexity(content), [content]);

  // Rhymes state
  const [queryWord, setQueryWord] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [rhymes, setRhymes] = useState<RhymeResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync selected word from editor to queryWord
  useEffect(() => {
    if (selectedWord) {
      setQueryWord(selectedWord);
      setActiveTab('rhymes');
    }
  }, [selectedWord]);

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
    <div className="w-64 h-full bg-paper-dark/70 border-l border-paper-darker flex flex-col flex-shrink-0 z-10">
      {/* Panel Header */}
      <div className="h-14 px-4 border-b border-paper-darker flex items-center justify-between select-none flex-shrink-0">
        <div className="flex gap-2.5 text-[10px] font-semibold tracking-wide uppercase">
          <button
            onClick={() => setActiveTab('rhymes')}
            className={`py-4 border-b-2 cursor-pointer transition ${
              activeTab === 'rhymes'
                ? 'border-terracotta text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            Rhymes
          </button>
          <button
            onClick={() => setActiveTab('simplifier')}
            className={`py-4 border-b-2 cursor-pointer transition relative ${
              activeTab === 'simplifier'
                ? 'border-terracotta text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            Simplifier
            {matches.length > 0 && (
              <span className="absolute top-3.5 -right-2.5 w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 border-b-2 cursor-pointer transition ${
              activeTab === 'templates'
                ? 'border-terracotta text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            Templates
          </button>
        </div>
        <button
          onClick={() => setIsRightPanelOpen(false)}
          className="text-ink-muted hover:text-ink hover:bg-paper-darker p-1 rounded cursor-pointer"
          title="Collapse Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto min-h-0 select-text">
        {activeTab === 'rhymes' && (
          <div className="p-4 flex flex-col h-full min-h-0">
            {/* Manual Lookup Input */}
            <form onSubmit={handleManualSearch} className="mb-4 flex gap-1.5 select-none">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Type word to rhyme..."
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  className="w-full bg-paper border border-paper-darker rounded px-3 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition"
                />
              </div>
              <button
                type="submit"
                className="bg-paper border border-paper-darker hover:bg-paper-darker text-ink px-2.5 rounded cursor-pointer transition text-xs shadow-paper-sm"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Results */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-ink-light gap-2 select-none">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs">Searching vocabulary...</span>
              </div>
            ) : queryWord ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-paper-darker pb-2 select-none">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase">Rhymes for:</span>
                  <span className="text-xs font-serif font-bold text-terracotta italic">"{queryWord}"</span>
                </div>

                {/* Perfect Rhymes */}
                {perfectRhymes.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-bold text-ink uppercase tracking-wider mb-2 select-none flex items-center gap-1">
                      <Music className="w-3 h-3 text-terracotta" /> Perfect Rhymes
                    </h5>
                    <div className="space-y-3 pl-1">
                      {Object.entries(perfectGroups).map(([syllables, words]) => (
                        <div key={syllables} className="text-xs">
                          <span className="text-[10px] font-mono text-ink-light block mb-1 select-none">
                            {syllables} syllable{parseInt(syllables) > 1 ? 's' : ''}:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {words.map(w => (
                              <span
                                key={w}
                                className="bg-paper border border-paper-darker px-2 py-0.5 rounded text-[11px] text-ink cursor-pointer hover:border-terracotta hover:text-terracotta transition"
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
                  <div>
                    <h5 className="text-[10px] font-bold text-ink uppercase tracking-wider mb-2 select-none flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber" /> Near Rhymes / Similar Sounds
                    </h5>
                    <div className="space-y-3 pl-1">
                      {Object.entries(nearGroups).map(([syllables, words]) => (
                        <div key={syllables} className="text-xs">
                          <span className="text-[10px] font-mono text-ink-light block mb-1 select-none">
                            {syllables} syllable{parseInt(syllables) > 1 ? 's' : ''}:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {words.map(w => (
                              <span
                                key={w}
                                className="bg-paper border border-paper-darker px-2 py-0.5 rounded text-[11px] text-ink-muted cursor-pointer hover:border-terracotta hover:text-terracotta transition"
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
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-paper-darker rounded-lg text-ink-light select-none">
                <AlertCircle className="w-6 h-6 mb-2 text-ink-light/70" />
                <p className="text-[11px] leading-relaxed">
                  Double-click any word in your lyrics, or type in the box above, to see rhyming suggestions filtered for pop vocabulary.
                </p>
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

            <textarea
              value={targetTemplate}
              onChange={(e) => updateActiveDraft({ targetTemplate: e.target.value })}
              placeholder="e.g.&#10;8&#10;7&#10;8&#10;7"
              className="w-full h-40 bg-paper border border-paper-darker rounded-lg p-3 font-mono text-xs text-ink placeholder-ink-light leading-relaxed focus:outline-none focus:border-terracotta transition resize-none"
            />

            {/* Meter Strictness Selector */}
            <div className="mt-4 select-none">
              <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block mb-2">
                Meter Strictness
              </span>
              <div className="grid grid-cols-3 gap-1 bg-paper-darker p-0.5 rounded-md border border-paper-darker">
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
                      className={`text-[10px] py-1 rounded cursor-pointer transition ${
                        isActive
                          ? 'bg-paper text-ink font-semibold shadow-paper-sm'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-ink-muted mt-1.5 leading-relaxed">
                {syllableTolerance === 0 && 'Strict: Line must match syllables exactly.'}
                {syllableTolerance === 1 && 'Flexible: Allows ±1 syllable (recommended for melodic variance).'}
                {syllableTolerance === 2 && 'Relaxed: Allows ±2 syllables (relaxed speech/rhythm flow).'}
              </p>
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
                  <div key={idx} className="bg-paper border border-paper-darker rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between select-none">
                      <span className="text-xs font-serif font-bold text-ink italic">
                        "{match.word}"
                      </span>
                      <span className="text-[8px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-light text-amber-DEFAULT">
                        {match.reason === 'dictionary' ? 'complex' : '4+ syllables'}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-ink-light select-none mr-0.5">Try:</span>
                      {match.suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            const before = content.slice(0, match.index);
                            const after = content.slice(match.index + match.word.length);
                            updateActiveDraft({ content: before + s + after });
                          }}
                          className="bg-paper border border-paper-darker hover:bg-terracotta hover:text-white hover:border-terracotta px-2 py-0.5 rounded text-[10px] font-semibold text-terracotta transition cursor-pointer"
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
