import React, { useRef, useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { ComplexityMatch } from '../utils/simplifier';

interface HighlightingTextareaProps {
  value: string;
  onChange: (value: string) => void;
  highlights: ComplexityMatch[];
  onReplace: (index: number, word: string, replacement: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  subconsciousActive?: boolean;
  isMobile?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelect?: () => void;
  onMouseUp?: () => void;
  onScroll?: (e: React.UIEvent<HTMLTextAreaElement>) => void;
}

interface ActiveTooltip {
  match: ComplexityMatch;
  x: number;
  y: number;
}

export const HighlightingTextarea = React.forwardRef<HTMLTextAreaElement, HighlightingTextareaProps>(({
  value,
  onChange,
  highlights,
  onReplace,
  placeholder,
  className,
  style,
  subconsciousActive,
  isMobile,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  onSelect,
  onMouseUp,
  onScroll,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => textareaRef.current!);

  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);

  // Synchronize scroll position of overlay with textarea
  const syncScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Close tooltip when value changes or user scrolls or clicking outside
  useEffect(() => {
    setActiveTooltip(null);
  }, [value]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    syncScroll();
    if (activeTooltip) {
      setActiveTooltip(null);
    }
    if (onScroll) {
      onScroll(e);
    }
  };

  // Focus textarea when container is clicked
  const focusTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Close tooltip helper
  const closeTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTooltip(null);
  };

  const handleHighlightClick = (match: ComplexityMatch, element: HTMLElement) => {
    if (subconsciousActive) return;
    
    const container = containerRef.current;
    if (!container) return;

    const rect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Position tooltip below the highlighted word, accounting for scroll position
    const y = rect.bottom - containerRect.top + container.scrollTop;
    const x = rect.left - containerRect.left + container.scrollLeft;

    setActiveTooltip({
      match,
      x,
      y,
    });
  };

  // Render the highlighted text overlay
  const renderOverlayContent = () => {
    if (highlights.length === 0 || subconsciousActive) {
      // Add a trailing space/newline to prevent alignment issues
      return value + (value.endsWith('\n') ? ' ' : '');
    }

    const sortedHighlights = [...highlights].sort((a, b) => a.index - b.index);
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedHighlights.forEach((match, idx) => {
      if (match.index < lastIndex) return; // Skip overlapping highlights

      // Plain text before highlight
      if (match.index > lastIndex) {
        nodes.push(value.substring(lastIndex, match.index));
      }

      // Highlighted word
      const wordText = value.substring(match.index, match.index + match.word.length);
      const isDictMatch = match.reason === 'dictionary';
      
      nodes.push(
        <span
          key={`hl-${idx}-${match.index}`}
          className={`inline-block border-b border-dashed font-serif cursor-pointer pointer-events-auto transition-colors duration-150 py-0.5 rounded-sm ${
            isDictMatch
              ? 'border-terracotta bg-terracotta/5 hover:bg-terracotta/10 text-ink'
              : 'border-amber-DEFAULT bg-amber-light/10 hover:bg-amber-light/20 text-ink'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            handleHighlightClick(match, e.currentTarget);
          }}
        >
          {wordText}
        </span>
      );

      lastIndex = match.index + match.word.length;
    });

    if (lastIndex < value.length) {
      nodes.push(value.substring(lastIndex));
    }

    // Append extra space if it ends with newline to sync scroll height perfectly
    if (value.endsWith('\n')) {
      nodes.push(' ');
    }

    return nodes;
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full cursor-text overflow-hidden"
      onClick={focusTextarea}
    >
      {/* 1. Synced Highlight Overlay (behind or in front with pointer-events-none) */}
      <div
        ref={overlayRef}
        className={`absolute inset-0 w-full h-full select-none pointer-events-none whitespace-pre-wrap break-words overflow-x-hidden overflow-y-auto block border-0 leading-[32px] ${isMobile ? 'py-4 px-4 text-[15px]' : 'py-6 px-8 text-[17px]'} font-serif ${
          subconsciousActive ? 'subconscious-blind-mode text-transparent' : 'text-transparent'
        }`}
        style={{
          lineHeight: '32px',
          fontFeatureSettings: '"kern" 1, "liga" 1',
          maxWidth: '100%',
          ...style,
        }}
      >
        {renderOverlayContent()}
      </div>

      {/* 2. Actual Interactive Transparent Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onScroll={handleScroll}
        onMouseUp={onMouseUp}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onSelect={onSelect}
        placeholder={placeholder}
        className={`w-full h-full bg-transparent text-ink placeholder-ink-light/50 font-serif leading-[32px] resize-none focus:outline-none whitespace-pre-wrap break-words overflow-x-hidden overflow-y-auto block border-0 relative z-10 ${
          isMobile ? 'py-4 px-4 text-[15px]' : 'py-6 px-8 text-[17px]'
        } ${
          subconsciousActive ? 'subconscious-blind-mode caret-transparent' : 'caret-terracotta'
        } ${className || ''}`}
        style={{
          lineHeight: '32px',
          fontFeatureSettings: '"kern" 1, "liga" 1',
          maxWidth: '100%',
          background: 'transparent',
          color: subconsciousActive ? 'transparent' : 'currentColor',
          WebkitTextFillColor: subconsciousActive ? 'transparent' : 'currentColor',
          ...style,
        }}
      />

      {/* 3. Floating Interactive Suggestion Tooltip */}
      {activeTooltip && !subconsciousActive && (
        <div
          className="absolute z-50 bg-white border border-paper-darker rounded-lg shadow-paper-md p-3 w-56 flex flex-col gap-2 pointer-events-auto"
          style={{
            top: `${activeTooltip.y + 4}px`,
            left: `${Math.max(16, Math.min(activeTooltip.x - 100, (containerRef.current?.clientWidth || 400) - 240))}px`,
            animation: 'fadeIn 0.15s ease-out',
          }}
          onClick={(e) => e.stopPropagation()} // Prevent focus trigger
        >
          <div className="flex items-center justify-between border-b border-paper-darker pb-1.5">
            <span className="text-[10px] font-semibold tracking-wider text-ink-muted uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-terracotta" /> Simplifier Suggestion
            </span>
            <button
              onClick={closeTooltip}
              className="text-ink-light hover:text-ink hover:bg-paper-darker p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-xs">
            <span className="text-ink-light">Replace </span>
            <span className="font-bold font-serif text-terracotta">"{activeTooltip.match.word}"</span>
            <span className="text-ink-light"> with:</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-1">
            {activeTooltip.match.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  onReplace(activeTooltip.match.index, activeTooltip.match.word, suggestion);
                  setActiveTooltip(null);
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                  }
                }}
                className="bg-paper hover:bg-terracotta hover:text-white border border-paper-darker hover:border-terracotta px-2.5 py-1 rounded text-xs font-semibold text-terracotta transition duration-150 cursor-pointer shadow-paper-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
