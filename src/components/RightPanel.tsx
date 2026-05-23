import React, { useState, useEffect } from 'react';
import { Music, Sparkles, Loader2, Search, Layers } from 'lucide-react';

interface RightPanelProps {
  selectedWord: string;
  isMobile?: boolean;
  onReplaceSelectedWord: (word: string) => void;
}

interface RhymeItem {
  word: string;
  count: number;
  isPhrase: boolean;
  similarity: number;
}

interface PopAssociationResult {
  word: string;
  rhymes: {
    perfect: RhymeItem[];
    slant: RhymeItem[];
    vowel: RhymeItem[];
  };
  associations: {
    word: string;
    count: number;
    similarity: number;
  }[];
}

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedWord,
  isMobile = false,
  onReplaceSelectedWord,
}) => {
  const [queryWord, setQueryWord] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [associationData, setAssociationData] = useState<PopAssociationResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync selected word from editor to queryWord
  const [prevSelectedWord, setPrevSelectedWord] = useState(selectedWord);
  if (selectedWord !== prevSelectedWord) {
    setPrevSelectedWord(selectedWord);
    if (selectedWord) {
      setQueryWord(selectedWord);
    }
  }

  // Fetch pop associations when queryWord changes
  useEffect(() => {
    if (!queryWord) {
      setAssociationData(null);
      return;
    }

    const performSearch = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pop-associations?word=${encodeURIComponent(queryWord.toLowerCase())}`);
        if (res.ok) {
          const data = await res.json();
          setAssociationData(data);
        } else {
          setAssociationData(null);
        }
      } catch (e) {
        console.error('Error fetching pop associations:', e);
        setAssociationData(null);
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

  return (
    <div className={`${isMobile ? 'w-full' : 'w-80'} h-full bg-paper-dark border-l border-paper-darker flex flex-col flex-shrink-0 z-10 font-sans text-ink select-none`}>
      {/* Panel Header */}
      <div className="h-12 px-4 border-b border-paper-darker flex items-center flex-shrink-0 bg-paper">
        <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-ink-muted flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-terracotta" /> Pop Vibe &amp; Rhymes
        </span>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto min-h-0 select-text p-4 flex flex-col space-y-4">
        {/* Manual Lookup Input */}
        <form onSubmit={handleManualSearch} className="relative select-none">
          <input
            type="text"
            placeholder="Search a word…"
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            className="w-full bg-paper border border-paper-darker rounded-lg pl-3 pr-9 py-2 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta/60 focus:ring-1 focus:ring-terracotta/20 transition-all duration-150 shadow-paper-sm cursor-text"
            style={{ fontSize: isMobile ? '16px' : undefined }}
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-ink-light hover:text-terracotta cursor-pointer transition"
            title="Search associations"
          >
            <Search className="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </form>

        {/* Results Area */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-ink-muted gap-3 select-none py-12">
            <Loader2 className="w-5 h-5 animate-spin text-terracotta/60" />
            <span className="text-[11px] font-mono text-ink-light">Analyzing pop chemistry…</span>
          </div>
        ) : queryWord ? (
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            {/* Header info */}
            <div className="flex items-center justify-between pb-2.5 border-b border-paper-darker select-none flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono font-semibold tracking-wider text-ink-light uppercase flex-shrink-0">Focus:</span>
                <span className="text-xs font-mono font-bold text-terracotta bg-terracotta-light px-2 py-0.5 rounded border border-terracotta/20 truncate">
                  "{queryWord}"
                </span>
              </div>
              <button
                onClick={() => {
                  setQueryWord('');
                  setManualQuery('');
                  setAssociationData(null);
                }}
                className="text-[10px] font-semibold text-ink-light hover:text-terracotta cursor-pointer transition uppercase tracking-wider flex-shrink-0"
              >
                Clear
              </button>
            </div>

            {/* Split List View */}
            <div className="space-y-3 overflow-y-auto flex-1 pr-0.5">

              {/* 1. Perfect Rhymes */}
              <div className="bg-paper rounded-xl border border-paper-darker p-3 card-warm">
                <h5 className="text-[10px] font-mono font-bold text-[#2D7A56] uppercase tracking-widest mb-2.5 select-none flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" /> Perfect Rhymes
                </h5>
                {associationData && associationData.rhymes.perfect.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {associationData.rhymes.perfect.map((r) => (
                      <button
                        key={r.word}
                        onClick={() => onReplaceSelectedWord(r.word)}
                        className="group bg-[#EDF7F2] hover:bg-[#2D7A56] hover:text-white border border-[#BDE8D4] hover:border-[#2D7A56] px-2.5 py-1 rounded-lg text-xs text-[#2D7A56] font-medium cursor-pointer transition-all duration-150 active:scale-[0.96] flex items-center gap-1.5"
                      >
                        <span>{r.word}</span>
                        {r.isPhrase && <span className="text-[8px] bg-[#BDE8D4] text-[#2D7A56] group-hover:bg-white/20 group-hover:text-white px-1 rounded font-mono">2W</span>}
                        {r.similarity > 0.01 && (
                          <span className="text-[8px] text-[#2D7A56]/60 group-hover:text-white/70 font-mono">
                            {Math.round(r.similarity * 100)}%
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-ink-light select-none pl-0.5 italic font-mono">
                    No perfect rhymes found.
                  </div>
                )}
              </div>

              {/* 2. Slant Rhymes */}
              <div className="bg-paper rounded-xl border border-paper-darker p-3 card-warm">
                <h5 className="text-[10px] font-mono font-bold text-amber-DEFAULT uppercase tracking-widest mb-2.5 select-none flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Slant / Soft Rhymes
                </h5>
                {associationData && associationData.rhymes.slant.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {associationData.rhymes.slant.map((r) => (
                      <button
                        key={r.word}
                        onClick={() => onReplaceSelectedWord(r.word)}
                        className="group bg-[#FEF6E4] hover:bg-amber-DEFAULT hover:text-white border border-[#F5DDA8] hover:border-amber-DEFAULT px-2.5 py-1 rounded-lg text-xs text-amber-DEFAULT font-medium cursor-pointer transition-all duration-150 active:scale-[0.96] flex items-center gap-1.5"
                      >
                        <span>{r.word}</span>
                        {r.isPhrase && <span className="text-[8px] bg-[#F5DDA8] text-amber-DEFAULT group-hover:bg-white/20 group-hover:text-white px-1 rounded font-mono">2W</span>}
                        {r.similarity > 0.01 && (
                          <span className="text-[8px] text-amber-DEFAULT/60 group-hover:text-white/70 font-mono">
                            {Math.round(r.similarity * 100)}%
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-ink-light select-none pl-0.5 italic font-mono">
                    No slant rhymes found.
                  </div>
                )}
              </div>

              {/* 3. Vowel Rhymes */}
              <div className="bg-paper rounded-xl border border-paper-darker p-3 card-warm">
                <h5 className="text-[10px] font-mono font-bold text-[#7C4DB8] uppercase tracking-widest mb-2.5 select-none flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" /> Vowel Nucleus Rhymes
                </h5>
                {associationData && associationData.rhymes.vowel.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {associationData.rhymes.vowel.map((r) => (
                      <button
                        key={r.word}
                        onClick={() => onReplaceSelectedWord(r.word)}
                        className="group bg-[#F5EEFF] hover:bg-[#7C4DB8] hover:text-white border border-[#D9BBFF] hover:border-[#7C4DB8] px-2.5 py-1 rounded-lg text-xs text-[#7C4DB8] font-medium cursor-pointer transition-all duration-150 active:scale-[0.96] flex items-center gap-1.5"
                      >
                        <span>{r.word}</span>
                        {r.isPhrase && <span className="text-[8px] bg-[#D9BBFF] text-[#7C4DB8] group-hover:bg-white/20 group-hover:text-white px-1 rounded font-mono">2W</span>}
                        {r.similarity > 0.01 && (
                          <span className="text-[8px] text-[#7C4DB8]/60 group-hover:text-white/70 font-mono">
                            {Math.round(r.similarity * 100)}%
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-ink-light select-none pl-0.5 italic font-mono">
                    No vowel sound matches.
                  </div>
                )}
              </div>

              {/* 4. Thematic Vibe */}
              <div className="bg-paper rounded-xl border border-paper-darker p-3 card-warm">
                <h5 className="text-[10px] font-mono font-bold text-terracotta uppercase tracking-widest mb-2.5 select-none flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Thematic Vibe
                </h5>
                {associationData && associationData.associations.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {associationData.associations.map((a) => (
                      <button
                        key={a.word}
                        onClick={() => onReplaceSelectedWord(a.word)}
                        className="group bg-terracotta-light hover:bg-terracotta hover:text-white border border-terracotta/20 hover:border-terracotta px-2.5 py-1 rounded-lg text-xs text-terracotta font-medium cursor-pointer transition-all duration-150 active:scale-[0.96] flex items-center gap-1.5"
                      >
                        <span>{a.word}</span>
                        <span className="text-[8px] text-terracotta/60 group-hover:text-white/70 font-mono">
                          {Math.round(a.similarity * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-ink-light select-none pl-0.5 italic font-mono">
                    No co-occurring vibe terms.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Default State */
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 space-y-5 select-none py-6">
            {/* Icon & intro */}
            <div className="bg-paper rounded-2xl border border-paper-darker p-5 card-warm-md text-center flex flex-col items-center w-full">
              <div className="w-9 h-9 rounded-full bg-terracotta-light border border-terracotta/20 flex items-center justify-center text-terracotta mb-3">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-1">Pop Lyric Co-pilot</h4>
              <p className="text-[11px] text-ink-muted leading-relaxed max-w-[190px]">
                Double-click a word in the notepad to instantly pull up perfect, slant, and vowel rhymes.
              </p>

              <div className="w-full border-t border-paper-darker mt-4 pt-4">
                <span className="text-[9px] font-mono text-ink-light uppercase tracking-widest block mb-2">Seed Lookup</span>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {['heart', 'night', 'dream', 'fire', 'cry'].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setQueryWord(w)}
                      className="bg-paper-active hover:bg-terracotta hover:text-white border border-paper-darker hover:border-terracotta px-2.5 py-1 rounded text-[10px] text-ink-muted font-mono transition-all duration-150 active:scale-[0.96] cursor-pointer"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
