import React, { useRef, useState, useEffect, useCallback } from 'react';
import { AlertCircle, Brain, Timer, ChevronDown, X, Share2, Check } from 'lucide-react';
import { countLineSyllables } from '../utils/syllables';
import type { Draft } from '../hooks/useDrafts';
import { HighlightingTextarea } from './HighlightingTextarea';
import { scanComplexity } from '../utils/simplifier';

interface NotepadProps {
  draftId: string;
  title: string;
  content: string;
  targetTemplate: string;
  syllableTolerance: number;
  updateActiveDraft: (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => void;
  setSelectedWord: (word: string) => void;
  remoteDraft: Draft | null;
  setIsEditorFocused: (focused: boolean) => void;
  syncActiveDraftWithRemote: () => void;
  isCloudMode: boolean;
  onSubconsciousActiveChange?: (active: boolean) => void;
  isMobile?: boolean;
}

export const Notepad: React.FC<NotepadProps> = ({
  draftId,
  title,
  content,
  targetTemplate,
  syllableTolerance,
  updateActiveDraft,
  setSelectedWord,
  remoteDraft,
  setIsEditorFocused,
  syncActiveDraftWithRemote,
  isCloudMode,
  onSubconsciousActiveChange,
  isMobile = false,
}) => {
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compute conversational complexity highlights
  const highlights = React.useMemo(() => scanComplexity(content), [content]);

  // Subconscious Blind Timer States
  const [subconsciousActive, setSubconsciousActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showPresets, setShowPresets] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const presets = [
    { label: '1 Min', value: 60 },
    { label: '2 Min', value: 120 },
    { label: '5 Min', value: 300 },
    { label: '10 Min', value: 600 },
  ];

  const [copied, setCopied] = useState(false);

  // Play synthetic terracotta chime sound using Web Audio API
  const playChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      // Tone 1: Fundamental C5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // Tone 2: Harmonious fifth G5
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.15);
      gain2.gain.setValueAtTime(0.1, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      // Tone 3: Octave C6
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1046.50, now + 0.3);
      gain3.gain.setValueAtTime(0.08, now + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.7);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      
      osc1.start(now);
      osc1.stop(now + 1.5);
      osc2.start(now + 0.15);
      osc2.stop(now + 1.6);
      osc3.start(now + 0.3);
      osc3.stop(now + 1.8);
    } catch (e) {
      console.error("Failed to play chime", e);
    }
  }, []);

  const handleTimerComplete = useCallback(() => {
    setSubconsciousActive(false);
    setShowSuccessBanner(true);
    playChime();
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }, 50);
  }, [playChime]);

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/?share=${draftId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy share link:', err);
    });
  };

  // Adjust state during render if draftId changes (avoids useEffect cascading renders)
  const [prevDraftId, setPrevDraftId] = useState(draftId);
  if (draftId !== prevDraftId) {
    setPrevDraftId(draftId);
    setSubconsciousActive(false);
    setTimeLeft(0);
    setShowPresets(false);
    setShowSuccessBanner(false);
  }

  // Sync subconscious active state to parent layout
  useEffect(() => {
    if (onSubconsciousActiveChange) {
      onSubconsciousActiveChange(subconsciousActive);
    }
  }, [subconsciousActive, onSubconsciousActiveChange]);

  // Countdown timer effect
  useEffect(() => {
    if (subconsciousActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [subconsciousActive, timeLeft, handleTimerComplete, draftId]);

  const handleStartSession = (seconds: number) => {
    setTimeLeft(seconds);
    setSubconsciousActive(true);
    setShowPresets(false);
    setShowSuccessBanner(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }, 50);
  };

  const handleRevealEarly = () => {
    if (window.confirm("Reveal early? Timer will stop.")) {
      setSubconsciousActive(false);
      setTimeLeft(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (subconsciousActive) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        if (textareaRef.current) {
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }
    }
  };

  const handleSelect = () => {
    if (subconsciousActive && textareaRef.current) {
      const len = textareaRef.current.value.length;
      if (textareaRef.current.selectionStart !== len || textareaRef.current.selectionEnd !== len) {
        textareaRef.current.setSelectionRange(len, len);
      }
    }
  };

  const handleMouseUp = () => {
    if (subconsciousActive && textareaRef.current) {
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    } else {
      handleTextSelection();
    }
  };

  // Sync scroll positions between textarea and gutter
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Parse lines to display syllable count in gutter
  const lines = content.split('\n');

  // Parse targets from targetTemplate
  const targets = React.useMemo(() => {
    return targetTemplate
      .replace(/[-\s,]+/g, '\n')
      .split('\n')
      .map(x => parseInt(x.trim()))
      .filter(x => !isNaN(x));
  }, [targetTemplate]);

  // Capture selected word on mouse-up or double-click
  const handleTextSelection = () => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    
    if (start === end) return; // no selection

    const selectedText = content.substring(start, end).trim();
    
    // Only trigger rhyme search if it's a single word without spaces/numbers
    if (selectedText && !/\s/.test(selectedText) && /^[a-zA-Z']+$/.test(selectedText)) {
      setSelectedWord(selectedText);
    }
  };

  // Keep focus on editor when clicking surrounding canvas areas
  const focusEditor = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleReplace = (index: number, word: string, replacement: string) => {
    const before = content.substring(0, index);
    const after = content.substring(index + word.length);
    updateActiveDraft({ content: before + replacement + after });
  };

  return (
    <div className="flex-1 h-full bg-paper flex flex-col min-w-0" onClick={focusEditor}>
      {/* Subconscious & Share Mode Control */}
      <div
        className={`${isMobile ? 'px-4 py-2' : 'px-8 py-3'} bg-paper border-b border-paper-darker flex items-center justify-end gap-4 select-none flex-shrink-0 relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {!isMobile && (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => updateActiveDraft({ title: e.target.value })}
              onFocus={() => setIsEditorFocused(true)}
              onBlur={() => setIsEditorFocused(false)}
              placeholder="Enter Destination Title (e.g., ...Baby One More Time)"
              className="flex-1 bg-transparent text-sm font-bold text-ink placeholder-ink-light/70 focus:outline-none py-0.5 border-b border-transparent focus:border-terracotta transition"
              disabled={subconsciousActive}
            />
          </div>
        )}

        {/* Subconscious & Share Mode Control */}
        <div className="flex items-center gap-2 relative w-full justify-end">
          {/* Share Button (Only in Cloud Mode) */}
          {isCloudMode && (
            <button
              onClick={handleShare}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border transition cursor-pointer select-none ${
                copied
                  ? 'bg-[#10B981] border-[#10B981] text-white hover:bg-[#059669]'
                  : 'border-paper-darker text-ink-muted hover:border-terracotta/40 hover:text-terracotta bg-white'
              }`}
              title="Copy shareable link to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              {/* <span>{copied ? 'Copied Link!' : 'Share'}</span> */}
            </button>
          )}

          {subconsciousActive ? (
            <div className="flex items-center gap-3 bg-terracotta/10 border border-terracotta/20 rounded-md px-3 py-1 text-xs">
              <span className="flex items-center gap-1.5 text-terracotta font-medium font-mono">
                <Timer className="w-3.5 h-3.5 animate-pulse" />
                {formatTime(timeLeft)}
              </span>
              <span className="text-[10px] text-ink-muted hidden sm:inline">Subconscious Mode Active</span>
              <button
                onClick={handleRevealEarly}
                className="text-[10px] uppercase font-bold text-terracotta hover:text-terracotta/80 transition border-l border-terracotta/20 pl-3 cursor-pointer"
              >
                Reveal Early
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowPresets(!showPresets)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border transition cursor-pointer select-none ${
                  showPresets 
                    ? 'bg-terracotta border-terracotta text-white' 
                    : 'border-paper-darker text-ink-muted hover:border-terracotta/40 hover:text-terracotta'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                {!isMobile && <span>Subconscious</span>}
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showPresets ? 'rotate-180' : ''}`} />
              </button>

              {/* Preset Selector Dropdown */}
              {showPresets && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-paper-darker rounded-lg shadow-lg py-1.5 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-ink-muted uppercase tracking-wider border-b border-paper-darker mb-1">
                    Select writing time
                  </div>
                  {presets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleStartSession(preset.value)}
                      className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-paper-dark transition flex items-center justify-between cursor-pointer"
                    >
                      <span>{preset.label}</span>
                      <span className="text-[10px] text-ink-muted font-mono">{formatTime(preset.value)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Completion Success Banner */}
      {showSuccessBanner && (
        <div className="bg-[#ECFDF5] text-emerald-800 border-b border-[#A7F3D0] px-8 py-2.5 flex items-center justify-between text-xs font-medium flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>Subconscious session complete! Your raw lyrics are revealed.</span>
          </div>
          <button
            onClick={() => setShowSuccessBanner(false)}
            className="text-emerald-500 hover:text-emerald-700 transition p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Co-writer Sync Banner */}
      {remoteDraft && (
        <div className="bg-terracotta-light text-ink border-b border-terracotta/20 px-8 py-2.5 flex items-center justify-between text-xs font-medium flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-terracotta" />
            <span>New changes from co-writer.</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              syncActiveDraftWithRemote();
            }}
            className="bg-terracotta hover:bg-terracotta-hover text-white px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition cursor-pointer"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* Editor Main Section */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Scrollable Gutter (Line Numbers + Syllable Counts) — hidden on mobile */}
        {!isMobile && (
          <div
            ref={gutterRef}
            className="w-16 bg-paper-dark/30 border-r border-paper-darker/60 flex flex-col overflow-hidden select-none pointer-events-none text-[11px] font-mono text-ink-light flex-shrink-0 py-6"
          >
            {(() => {
              let lyricLineCount = 0;
              return lines.map((lineText, idx) => {
                const cleanLine = lineText.trim();
                const syllableCount = cleanLine ? countLineSyllables(cleanLine) : 0;
                const isHeader = cleanLine.startsWith('[');
                const isEmpty = !cleanLine;
                
                // Check target matches
                let isMismatch = false;
                let isNearMatch = false;
                let targetCount = 0;

                if (targets.length > 0 && !isHeader && !isEmpty) {
                  targetCount = targets[lyricLineCount % targets.length];
                  const difference = Math.abs(syllableCount - targetCount);
                  
                  if (difference > 0) {
                    if (difference <= syllableTolerance) {
                      isNearMatch = true;
                    } else {
                      isMismatch = true;
                    }
                  }
                  lyricLineCount++;
                }

                return (
                  <div
                    key={idx}
                    className="h-8 flex items-center justify-between px-2 w-full leading-8 flex-shrink-0"
                    style={{ height: '32px' }}
                  >
                    {/* Line Number */}
                    <span className="text-[9px] text-ink-light/50">{idx + 1}</span>
                    
                    {/* Syllable Count Badge */}
                    {cleanLine ? (
                      isHeader ? (
                        // Section header (e.g. [Chorus], [Verse]) - don't show syllable count
                        <span className="text-[9px] uppercase font-semibold text-terracotta/40 px-1">sec</span>
                      ) : (
                        <span
                          className={`px-1 rounded font-semibold text-[10px] flex items-center gap-0.5 transition-colors duration-150 ${
                            isMismatch
                              ? 'bg-amber-light text-amber-DEFAULT font-bold'
                              : isNearMatch
                              ? 'bg-paper-darker border border-terracotta/20 text-ink font-medium'
                              : 'bg-paper-darker text-ink-muted'
                          }`}
                          title={
                            targets.length > 0
                              ? isMismatch
                                ? `Mismatch! Target: ${targetCount}, Actual: ${syllableCount}`
                                : isNearMatch
                                ? `Near Match (±${syllableTolerance}). Target: ${targetCount}, Actual: ${syllableCount}`
                                : `Matches target of ${targetCount} syllables`
                              : ''
                          }
                        >
                          {syllableCount}
                          {isMismatch && <AlertCircle className="w-2.5 h-2.5 text-amber stroke-[2.5]" />}
                        </span>
                      )
                    ) : (
                      <span></span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Text Area Canvas */}
        <div className="flex-1 h-full min-w-0" onClick={(e) => e.stopPropagation()}>
          <HighlightingTextarea
            ref={textareaRef}
            value={content}
            onChange={(val) => updateActiveDraft({ content: val })}
            highlights={highlights}
            onReplace={handleReplace}
            onFocus={() => setIsEditorFocused(true)}
            onBlur={() => setIsEditorFocused(false)}
            onScroll={handleScroll}
            onMouseUp={handleMouseUp}
            onKeyUp={subconsciousActive ? undefined : handleTextSelection}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            placeholder={subconsciousActive ? "Keep typing, don't stop, don't look back..." : "Write your lyrics here..."}
            subconsciousActive={subconsciousActive}
            isMobile={isMobile}
          />
        </div>
      </div>
    </div>
  );
};
