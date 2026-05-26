import React, { useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface DensityData {
  line: string;
  density: number;
  rhyming_syllables: number;
  total_syllables: number;
  status: string;
  message: string;
}

export const RhymeDensityPanel: React.FC = () => {
  const [lineInput, setLineInput] = useState('');
  const [data, setData] = useState<DensityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = lineInput.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rhyme-density?line=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch density score');
      }
      const resData = await response.json();
      setData(resData);
    } catch (err: any) {
      setError(err.message || 'Error analyzing line');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status.includes('sweet')) return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400';
    if (status.includes('over')) return 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400';
    return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400';
  };

  const getStatusIcon = (status: string) => {
    if (status.includes('sweet')) return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Header */}
      <div className="p-4 border-b border-paper-darker flex flex-col gap-1 select-none flex-shrink-0">
        <span className="text-xs font-semibold text-ink uppercase tracking-wider block">Rhyme Density Scorer</span>
        <span className="text-[10px] text-ink-muted leading-relaxed">
          Checks phonetic matches relative to syllable count. Trained on 23k hits.
        </span>
      </div>

      {/* Input Form */}
      <form onSubmit={handleAnalyze} className="p-4 border-b border-paper-darker flex flex-col gap-2 select-none flex-shrink-0 bg-paper-dark/10">
        <textarea
          rows={2}
          placeholder="Paste or type a lyric line to score..."
          value={lineInput}
          onChange={(e) => setLineInput(e.target.value)}
          spellCheck="false"
          className="w-full bg-paper border border-paper-darker rounded p-2 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition select-text resize-none"
        />
        <button
          type="submit"
          disabled={isLoading || !lineInput.trim()}
          className="w-full py-1.5 bg-terracotta hover:bg-terracotta-hover text-white disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs transition cursor-pointer font-bold flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Score Line
        </button>
      </form>

      {/* Results Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && (
          <div className="text-xs text-ink-muted font-serif italic py-4 select-none">
            calculating density...
          </div>
        )}

        {error && (
          <div className="text-xs text-rose-500 font-serif italic py-4 select-none">
            {error}
          </div>
        )}

        {!data && !isLoading && !error && (
          <div className="text-xs text-ink-muted font-serif italic py-4 select-none leading-relaxed">
            Enter a line above to see its rhyme density and check if it lands in the songwriters' sweet spot.
          </div>
        )}

        {data && !isLoading && !error && (
          <div className="space-y-5 select-none animate-fadeIn">
            {/* Verdict Badge */}
            <div className={`p-3 rounded-lg border flex items-start gap-2 text-xs leading-relaxed ${getStatusColor(data.status)}`}>
              <div className="mt-0.5 flex-shrink-0">
                {getStatusIcon(data.status)}
              </div>
              <div className="flex-1 font-serif italic">
                "{data.line}"
                <span className="block mt-1 font-sans not-italic text-[10px] font-semibold uppercase tracking-wider opacity-90">
                  {data.message}
                </span>
              </div>
            </div>

            {/* Slider / Visual Gauge */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                <span>Density Gauge</span>
                <span>{data.density.toFixed(2)}</span>
              </div>
              
              <div className="h-3 w-full bg-paper border border-paper-darker rounded-full relative overflow-hidden">
                {/* Under-rhymed zone (0 to 0.22) */}
                <div className="absolute left-0 top-0 bottom-0 w-[22%] bg-amber-500/10 border-r border-paper-darker" />
                {/* Sweet spot zone (0.22 to 0.44) */}
                <div className="absolute left-[22%] top-0 bottom-0 w-[22%] bg-emerald-500/20 border-r border-paper-darker" />
                {/* Over-rhymed zone (0.44 to 1.0) */}
                <div className="absolute left-[44%] top-0 bottom-0 right-0 bg-rose-500/10" />

                {/* Score Marker */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-terracotta transition-all duration-500 shadow-sm"
                  style={{ left: `${Math.min(100, data.density * 100)}%` }}
                >
                  <div className="w-2.5 h-2.5 bg-terracotta border border-white rounded-full -ml-[3px] absolute -top-[0.5px]" />
                </div>
              </div>

              <div className="flex justify-between text-[9px] text-ink-light pt-0.5">
                <span>0.0 (Flat)</span>
                <span className="text-emerald-600 font-semibold">0.22 - 0.44 (Sweet Spot)</span>
                <span>1.0 (Exhausting)</span>
              </div>
            </div>

            {/* Syllable Breakdown Card */}
            <div className="bg-paper border border-paper-darker rounded-lg p-3 space-y-2">
              <span className="text-[10px] uppercase font-bold text-ink-muted tracking-wider block">Phonetic Math</span>
              
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-paper-dark/30 rounded p-2">
                  <span className="text-lg font-serif font-bold text-ink block">
                    {data.rhyming_syllables}
                  </span>
                  <span className="text-[9px] uppercase font-semibold text-ink-light">
                    Rhyming Syllables
                  </span>
                </div>

                <div className="bg-paper-dark/30 rounded p-2">
                  <span className="text-lg font-serif font-bold text-ink block">
                    {data.total_syllables}
                  </span>
                  <span className="text-[9px] uppercase font-semibold text-ink-light">
                    Total Syllables
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-ink-muted leading-relaxed flex items-start gap-1 pt-1">
                <Info className="w-3.5 h-3.5 text-ink-light mt-0.5 flex-shrink-0" />
                <span>
                  Exact repetition of identical words and unstressed particles (e.g. "the", "a") are ignored to calculate clean rhyme density.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
