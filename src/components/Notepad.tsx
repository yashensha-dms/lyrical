import React, { useRef } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { countLineSyllables } from '../utils/syllables';
import type { Draft } from '../hooks/useDrafts';

interface NotepadProps {
  title: string;
  content: string;
  targetTemplate: string;
  syllableTolerance: number;
  updateActiveDraft: (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => void;
  setSelectedWord: (word: string) => void;
}

export const Notepad: React.FC<NotepadProps> = ({
  title,
  content,
  targetTemplate,
  syllableTolerance,
  updateActiveDraft,
  setSelectedWord,
}) => {
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="flex-1 h-full bg-paper flex flex-col min-w-0" onClick={focusEditor}>
      {/* Title Vault (Google Maps Pinned Title Anchor) */}
      <div 
        className="px-8 py-3 bg-paper border-b border-paper-darker flex items-center gap-2 select-none flex-shrink-0"
        onClick={(e) => e.stopPropagation()} // Prevent editor focus trigger
      >
        <MapPin className="w-4 h-4 text-terracotta flex-shrink-0" />
        <span className="text-[10px] font-bold text-terracotta uppercase tracking-wider select-none">
          Title Vault:
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => updateActiveDraft({ title: e.target.value })}
          placeholder="Enter Destination Title (e.g., ...Baby One More Time)"
          className="flex-1 bg-transparent text-sm font-serif font-bold text-ink placeholder-ink-light/70 focus:outline-none py-0.5 border-b border-transparent focus:border-terracotta transition"
        />
      </div>

      {/* Editor Main Section */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Scrollable Gutter (Line Numbers + Syllable Counts) */}
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

        {/* Text Area Canvas */}
        <div className="flex-1 h-full min-w-0" onClick={(e) => e.stopPropagation()}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => updateActiveDraft({ content: e.target.value })}
            onScroll={handleScroll}
            onMouseUp={handleTextSelection}
            onKeyUp={handleTextSelection}
            placeholder="Write your lyrics here..."
            className="w-full h-full bg-transparent text-ink placeholder-ink-light/50 font-serif text-[17px] leading-[32px] py-6 px-8 resize-none focus:outline-none whitespace-pre overflow-x-auto overflow-y-auto block border-0"
            style={{
              lineHeight: '32px',
              fontFeatureSettings: '"kern" 1, "liga" 1',
            }}
          />
        </div>
      </div>
    </div>
  );
};
