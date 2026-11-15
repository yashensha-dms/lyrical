import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Plus, Filter, Music, Sparkles, BookOpen, Check } from 'lucide-react';
import { analyzeMalayalamWord, isMalayalam } from '../utils/malayalamProsody';
import type { WordMeterProfile } from '../utils/malayalamProsody';
import { transliterateWord, fetchGoogleTransliteration, getTransliterationSync } from '../utils/manglishTransliterate';

interface SynItem {
  w: string;
  f: number;
  a: number;
  m: number;
  p: string;
}

interface ThesaurusHub {
  hub: string;
  meaning: string;
  syns: SynItem[];
}

interface CoreDictItem {
  w: string;
  f: number;
  s: number;
  a: number;
  m: number;
  p: string;
  d: string | null;
  r: string | null;
}

interface MalayalamWordFinderPanelProps {
  lookupWord: string | null;
  onSelectWord?: (word: string) => void;
  onClearLookup?: () => void;
}

const LOCAL_STORAGE_CUSTOM_KEY = 'malayalam_custom_synsets_v1';
const LOCAL_STORAGE_REMOVED_KEY = 'malayalam_removed_syns_v1';

export const MalayalamWordFinderPanel: React.FC<MalayalamWordFinderPanelProps> = ({
  lookupWord,
  onSelectWord,
  onClearLookup
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [thesaurus, setThesaurus] = useState<Record<string, ThesaurusHub>>({});
  const [coreDict, setCoreDict] = useState<CoreDictItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetSyllables, setTargetSyllables] = useState<number | 'all'>('all');
  const [targetPraasam, setTargetPraasam] = useState<'all' | 'dviteeyam' | 'anthyam'>('all');
  const [copiedWord, setCopiedWord] = useState<string | null>(null);
  const [newSynonymInput, setNewSynonymInput] = useState('');
  const [isAddingSyn, setIsAddingSyn] = useState(false);

  // User customizations from localStorage
  const [customSynsets, setCustomSynsets] = useState<Record<string, SynItem[]>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CUSTOM_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [removedSynonyms, setRemovedSynonyms] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_REMOVED_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Load datasets once on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [thesaurusRes, dictRes] = await Promise.all([
          fetch('/malayalam/song_thesaurus.json'),
          fetch('/malayalam/malayalam_core_dictionary.json')
        ]);

        if (thesaurusRes.ok) {
          const tData = await thesaurusRes.json();
          setThesaurus(tData);
        }
        if (dictRes.ok) {
          const dData = await dictRes.json();
          setCoreDict(dData);
        }
      } catch (err) {
        console.error('Failed to load Malayalam dictionaries:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Sync when editor double clicks a word
  useEffect(() => {
    if (lookupWord) {
      setSearchTerm(lookupWord);
    }
  }, [lookupWord]);

  // Handle Search Input (Auto-transliterates Manglish if typed in Latin letters)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // If user types Latin letters, transliterate to Malayalam using Google Input Tools
    if (val && !isMalayalam(val) && /[a-zA-Z]/.test(val)) {
      const cached = getTransliterationSync(val);
      setSearchTerm(cached || transliterateWord(val));
      fetchGoogleTransliteration(val).then(candidates => {
        if (candidates.length > 0) {
          setSearchTerm(candidates[0]);
        }
      });
    } else {
      setSearchTerm(val);
    }
  };

  const activeQuery = searchTerm.trim();

  // Word Prosody Profile
  const wordProfile: WordMeterProfile | null = useMemo(() => {
    if (!activeQuery) return null;
    return analyzeMalayalamWord(activeQuery);
  }, [activeQuery]);

  // Lookup word frequency in songs
  const activeWordFreq = useMemo(() => {
    if (!activeQuery || coreDict.length === 0) return null;
    const match = coreDict.find(item => item.w === activeQuery);
    return match ? { freq: match.f, songs: match.s } : null;
  }, [activeQuery, coreDict]);

  // Resolved Synonyms (combining curated thesaurus + user custom additions - user removals)
  const resolvedSynonyms: SynItem[] = useMemo(() => {
    if (!activeQuery) return [];

    let baseSyns: SynItem[] = [];
    const entry = thesaurus[activeQuery];
    if (entry && entry.syns) {
      baseSyns = [...entry.syns];
    }

    // Add user custom additions
    if (customSynsets[activeQuery]) {
      baseSyns = [...customSynsets[activeQuery], ...baseSyns];
    }

    // Filter out removed words
    const removed = new Set(removedSynonyms[activeQuery] || []);
    const filtered = baseSyns.filter(item => !removed.has(item.w));

    // Deduplicate
    const seen = new Set<string>();
    return filtered.filter(item => {
      if (seen.has(item.w)) return false;
      seen.add(item.w);
      return true;
    });
  }, [activeQuery, thesaurus, customSynsets, removedSynonyms]);

  // Praasam (Rhymes from the 19,685 song core dictionary)
  const praasamMatches: { anthyam: CoreDictItem[]; dviteeyam: CoreDictItem[] } = useMemo(() => {
    if (!wordProfile || coreDict.length === 0) {
      return { anthyam: [], dviteeyam: [] };
    }

    const anthyam: CoreDictItem[] = [];
    const dviteeyam: CoreDictItem[] = [];

    const queryRhyme = wordProfile.rhymeEnding;
    const queryDviteeyam = wordProfile.dviteeyaksharam;

    for (const item of coreDict) {
      if (item.w === activeQuery) continue;

      if (queryRhyme && item.r === queryRhyme) {
        anthyam.push(item);
      }
      if (queryDviteeyam && item.d === queryDviteeyam) {
        dviteeyam.push(item);
      }
    }

    // Sort by song frequency
    anthyam.sort((a, b) => b.f - a.f);
    dviteeyam.sort((a, b) => b.f - a.f);

    return {
      anthyam: anthyam.slice(0, 30),
      dviteeyam: dviteeyam.slice(0, 30)
    };
  }, [wordProfile, coreDict, activeQuery]);

  // Filtered Synonyms based on active meter filters
  const displaySynonyms = useMemo(() => {
    return resolvedSynonyms.filter(item => {
      if (targetSyllables !== 'all' && item.a !== targetSyllables) {
        return false;
      }
      if (targetPraasam === 'dviteeyam' && wordProfile?.dviteeyaksharam) {
        const itemProfile = analyzeMalayalamWord(item.w);
        if (itemProfile.dviteeyaksharam !== wordProfile.dviteeyaksharam) return false;
      }
      if (targetPraasam === 'anthyam' && wordProfile?.rhymeEnding) {
        const itemProfile = analyzeMalayalamWord(item.w);
        if (itemProfile.rhymeEnding !== wordProfile.rhymeEnding) return false;
      }
      return true;
    });
  }, [resolvedSynonyms, targetSyllables, targetPraasam, wordProfile]);

  // Remove word from synset
  const handleRemoveSynonym = (wordToRemove: string) => {
    if (!activeQuery) return;
    const current = removedSynonyms[activeQuery] || [];
    const updated = {
      ...removedSynonyms,
      [activeQuery]: [...current, wordToRemove]
    };
    setRemovedSynonyms(updated);
    localStorage.setItem(LOCAL_STORAGE_REMOVED_KEY, JSON.stringify(updated));
  };

  // Add custom word to synset
  const handleAddCustomSynonym = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newSynonymInput.trim();
    if (!raw || !activeQuery) return;

    let word = raw;
    if (!isMalayalam(raw)) {
      const candidates = await fetchGoogleTransliteration(raw);
      word = candidates[0] || transliterateWord(raw);
    }
    const profile = analyzeMalayalamWord(word);

    const newItem: SynItem = {
      w: word,
      f: 1,
      a: profile.aksharaCount,
      m: profile.totalMatras,
      p: profile.pattern
    };

    const current = customSynsets[activeQuery] || [];
    const updated = {
      ...customSynsets,
      [activeQuery]: [newItem, ...current]
    };
    setCustomSynsets(updated);
    localStorage.setItem(LOCAL_STORAGE_CUSTOM_KEY, JSON.stringify(updated));

    setNewSynonymInput('');
    setIsAddingSyn(false);
  };

  const handleWordClick = (word: string) => {
    navigator.clipboard.writeText(word);
    setCopiedWord(word);
    setTimeout(() => setCopiedWord(null), 1500);
    if (onSelectWord) {
      onSelectWord(word);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent text-ink">
      {/* Search Header */}
      <div className="p-4 border-b border-paper-darker flex flex-col gap-2 select-none flex-shrink-0 bg-paper-dark/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-terracotta" />
            <span className="text-xs font-semibold uppercase tracking-wider text-ink">മലയാളം നിഘണ്ടു & മീറ്റർ</span>
          </div>
          {activeQuery && (
            <button
              onClick={() => {
                setSearchTerm('');
                if (onClearLookup) onClearLookup();
              }}
              className="text-[10px] text-ink-muted hover:text-ink px-1.5 py-0.5 rounded border border-paper-darker bg-paper transition cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Input bar */}
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Type Malayalam word or Manglish (e.g. mazha, sooryan)..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full bg-paper border border-paper-darker rounded pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition select-text font-serif"
          />
          <Search className="w-3.5 h-3.5 text-ink-light absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
        <span className="text-[10px] text-ink-muted leading-tight">
          Double-click any word in the lyrics or type above. Supports Manglish typing.
        </span>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center p-8 text-xs text-ink-muted">
          Loading 7,145-song lyrical dictionary...
        </div>
      ) : !wordProfile ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-ink-muted select-none">
          <Sparkles className="w-8 h-8 text-terracotta/40 mb-3" />
          <span className="text-xs font-serif italic mb-1">Type or select a Malayalam word</span>
          <span className="text-[10px] text-ink-light max-w-[200px]">
            Find song-verified alternatives matching your required syllables and matras.
          </span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col p-4 gap-4">
          {/* Word Meter Profile Card */}
          <div className="p-3 bg-paper border border-paper-darker rounded-lg shadow-xs flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xl font-bold font-serif text-terracotta tracking-wide block">
                  {wordProfile.word}
                </span>
                <span className="text-[11px] text-ink-muted">
                  {thesaurus[activeQuery]?.meaning || 'Song vocabulary'}
                </span>
              </div>
              {activeWordFreq && (
                <div className="flex items-center gap-1 text-[10px] bg-paper-dark px-2 py-0.5 rounded border border-paper-darker text-ink-muted">
                  <Music className="w-2.5 h-2.5 text-terracotta" />
                  <span>{activeWordFreq.freq} times in {activeWordFreq.songs} songs</span>
                </div>
              )}
            </div>

            {/* Syllables & Matras details */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-paper-darker/50 text-[11px]">
              <div className="flex flex-col bg-paper-dark/30 p-2 rounded border border-paper-darker/30">
                <span className="text-[9px] uppercase font-bold text-ink-muted">അക്ഷരങ്ങൾ (Syllables)</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-base font-bold text-ink">{wordProfile.aksharaCount}</span>
                  <span className="text-[10px] text-ink-muted">
                    [{wordProfile.syllables.join(' | ')}]
                  </span>
                </div>
              </div>

              <div className="flex flex-col bg-paper-dark/30 p-2 rounded border border-paper-darker/30">
                <span className="text-[9px] uppercase font-bold text-ink-muted">മാത്രകൾ (Matra Beats)</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-base font-bold text-ink">{wordProfile.totalMatras}</span>
                  <span className="text-[10px] text-ink-muted">({wordProfile.pattern})</span>
                </div>
              </div>
            </div>

            {/* Praasam Keys */}
            <div className="flex items-center gap-3 text-[10px] text-ink-muted pt-1">
              {wordProfile.dviteeyaksharam && (
                <span>ദ്വിതീയം: <strong className="text-ink">{wordProfile.dviteeyaksharam}</strong></span>
              )}
              {wordProfile.rhymeEnding && (
                <span>അന്ത്യപ്രാസം: <strong className="text-ink">{wordProfile.rhymeEnding}</strong></span>
              )}
            </div>
          </div>

          {/* Filter by Syllable Budget */}
          <div className="flex flex-col gap-1.5 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-ink-muted tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3 text-terracotta" />
                Target Syllable Budget
              </span>
              <span className="text-[10px] text-ink-light">
                {displaySynonyms.length} words
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {(['all', 1, 2, 3, 4, 5] as const).map(syl => (
                <button
                  key={syl}
                  onClick={() => setTargetSyllables(syl)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition cursor-pointer ${
                    targetSyllables === syl
                      ? 'bg-terracotta text-white border-terracotta shadow-xs'
                      : 'bg-paper border-paper-darker text-ink-muted hover:text-ink hover:bg-paper-dark'
                  }`}
                >
                  {syl === 'all' ? 'All' : `${syl} Syl`}
                </button>
              ))}
            </div>
          </div>

          {/* Praasam Rhyme Filter */}
          <div className="flex items-center gap-1 text-[10px] select-none">
            <span className="text-ink-muted mr-1 font-bold">Rhyme:</span>
            <button
              onClick={() => setTargetPraasam('all')}
              className={`px-2 py-0.5 rounded border transition cursor-pointer ${
                targetPraasam === 'all'
                  ? 'bg-paper-darker text-ink font-semibold border-paper-darker'
                  : 'bg-paper text-ink-muted border-paper-darker'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTargetPraasam('dviteeyam')}
              className={`px-2 py-0.5 rounded border transition cursor-pointer ${
                targetPraasam === 'dviteeyam'
                  ? 'bg-paper-darker text-ink font-semibold border-paper-darker'
                  : 'bg-paper text-ink-muted border-paper-darker'
              }`}
              title="Second letter rhyme (ദ്വിതീയാക്ഷരപ്രാസം)"
            >
              ദ്വിതീയാക്ഷരം
            </button>
            <button
              onClick={() => setTargetPraasam('anthyam')}
              className={`px-2 py-0.5 rounded border transition cursor-pointer ${
                targetPraasam === 'anthyam'
                  ? 'bg-paper-darker text-ink font-semibold border-paper-darker'
                  : 'bg-paper text-ink-muted border-paper-darker'
              }`}
              title="End rhyme (അന്ത്യപ്രാസം)"
            >
              അന്ത്യപ്രാസം
            </button>
          </div>

          {/* Synonyms / Alternative Words List */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">
                Song-Verified Alternatives
              </span>
              <button
                onClick={() => setIsAddingSyn(!isAddingSyn)}
                className="text-[10px] text-terracotta hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add Word
              </button>
            </div>

            {/* Quick add custom word input */}
            {isAddingSyn && (
              <form onSubmit={handleAddCustomSynonym} className="flex items-center gap-1 bg-paper p-1.5 border border-paper-darker rounded">
                <input
                  type="text"
                  placeholder="Add custom word (Manglish/Malayalam)..."
                  value={newSynonymInput}
                  onChange={(e) => setNewSynonymInput(e.target.value)}
                  className="flex-1 text-xs bg-transparent focus:outline-none text-ink px-1"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 bg-terracotta text-white rounded text-[10px] font-medium cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingSyn(false)}
                  className="p-0.5 text-ink-muted hover:text-ink cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {displaySynonyms.length === 0 ? (
              <div className="p-4 bg-paper/50 border border-dashed border-paper-darker rounded text-center text-[11px] text-ink-muted">
                No matching alternatives for {targetSyllables === 'all' ? 'this word' : `${targetSyllables} syllables`}.
                <br />
                <span className="text-[10px] text-ink-light">Click &quot;Add Word&quot; above to link your own!</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {displaySynonyms.map((syn) => (
                  <div
                    key={syn.w}
                    onClick={() => handleWordClick(syn.w)}
                    className="p-2 bg-paper border border-paper-darker rounded hover:border-terracotta transition cursor-pointer flex items-center justify-between group shadow-2xs"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif font-semibold text-sm text-ink group-hover:text-terracotta">
                        {syn.w}
                      </span>
                      <span className="text-[10px] text-ink-muted">
                        {syn.a} syl, {syn.m} matras
                      </span>
                      {syn.f > 1 && (
                        <span className="text-[9px] text-ink-light">
                          (in {syn.f} songs)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {copiedWord === syn.w ? (
                        <span className="text-[9px] text-emerald-600 flex items-center gap-0.5 font-bold">
                          <Check className="w-3 h-3" /> Copied
                        </span>
                      ) : (
                        <span className="text-[9px] text-ink-light opacity-0 group-hover:opacity-100 transition">
                          Click to use
                        </span>
                      )}

                      {/* Remove button (Dictionary yourself curation) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSynonym(syn.w);
                        }}
                        title="Remove from this cluster"
                        className="text-ink-light hover:text-red-500 p-0.5 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional Praasam (Rhyme) Suggestions from Song Corpus */}
          {(praasamMatches.anthyam.length > 0 || praasamMatches.dviteeyam.length > 0) && (
            <div className="flex flex-col gap-2 pt-3 border-t border-paper-darker">
              <span className="text-xs font-semibold text-ink">
                Corpus Rhymes (പ്രാസം)
              </span>

              {praasamMatches.dviteeyam.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-ink-muted uppercase">
                    ദ്വിതീയാക്ഷരപ്രാസം ({wordProfile.dviteeyaksharam})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {praasamMatches.dviteeyam.slice(0, 10).map(item => (
                      <button
                        key={item.w}
                        onClick={() => handleWordClick(item.w)}
                        className="px-2 py-0.5 bg-paper border border-paper-darker rounded text-xs font-serif text-ink hover:border-terracotta transition cursor-pointer"
                      >
                        {item.w} <span className="text-[9px] text-ink-muted">({item.a}s)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {praasamMatches.anthyam.length > 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-[10px] font-bold text-ink-muted uppercase">
                    അന്ത്യപ്രാസം ({wordProfile.rhymeEnding})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {praasamMatches.anthyam.slice(0, 10).map(item => (
                      <button
                        key={item.w}
                        onClick={() => handleWordClick(item.w)}
                        className="px-2 py-0.5 bg-paper border border-paper-darker rounded text-xs font-serif text-ink hover:border-terracotta transition cursor-pointer"
                      >
                        {item.w} <span className="text-[9px] text-ink-muted">({item.a}s)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
