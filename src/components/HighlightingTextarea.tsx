import React, { useRef, useEffect } from 'react';

interface HighlightingTextareaProps {
  value: string;
  onChange: (value: string) => void;
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
  simplicityAlerts?: { word: string; index: number }[];
}

export const HighlightingTextarea = React.forwardRef<HTMLTextAreaElement, HighlightingTextareaProps>(({
  value,
  onChange,
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
  simplicityAlerts = [],
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => textareaRef.current!);

  // Synchronize scroll position of overlay with textarea
  const syncScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    syncScroll();
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

  // Sync scroll height on render
  useEffect(() => {
    syncScroll();
  }, [value]);

  const renderHighlightedText = () => {
    if (subconsciousActive) {
      return value + (value.endsWith('\n') ? ' ' : '');
    }
    if (!simplicityAlerts || simplicityAlerts.length === 0) {
      return value + (value.endsWith('\n') ? ' ' : '');
    }

    const sortedAlerts = [...simplicityAlerts].sort((a, b) => a.index - b.index);
    const elements: React.ReactNode[] = [];
    let lastIdx = 0;

    for (let i = 0; i < sortedAlerts.length; i++) {
      const alert = sortedAlerts[i];
      const start = alert.index;
      const end = start + alert.word.length;

      if (start < lastIdx || start >= value.length) continue;

      if (start > lastIdx) {
        elements.push(value.substring(lastIdx, start));
      }

      elements.push(
        <span
          key={`highlight-${start}-${i}`}
          className="bg-orange-500/10 border-b border-orange-500 rounded-sm"
        >
          {value.substring(start, end)}
        </span>
      );

      lastIdx = end;
    }

    if (lastIdx < value.length) {
      elements.push(value.substring(lastIdx));
    }

    return (
      <>
        {elements}
        {value.endsWith('\n') ? ' ' : ''}
      </>
    );
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full cursor-text overflow-hidden"
      onClick={focusTextarea}
    >
      {/* 1. Synced Highlight Overlay (behind the textarea to handle blind mask mode and highlights) */}
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
        {renderHighlightedText()}
      </div>

      {/* 2. Actual Interactive Textarea */}
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
    </div>
  );
});
