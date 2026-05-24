import React, { useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useYjsTextarea } from '../hooks/useYjsTextarea';

interface HighlightingTextareaProps {
  value: string;
  onChange: (value: string) => void;
  yText?: Y.Text;
  provider?: WebsocketProvider | null;
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

/**
 * Returns true if a line is a "backup idea" line (starts with > or > followed by space).
 */
function isBackupLine(line: string): boolean {
  return /^>\s?/.test(line);
}

export const HighlightingTextarea = React.forwardRef<HTMLTextAreaElement, HighlightingTextareaProps>(({
  value,
  onChange,
  yText,
  provider,
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

  const yjsBinding = useYjsTextarea(yText, provider || null, textareaRef);
  const textareaOnChange = yText ? yjsBinding.onChange : (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value);

  const syncScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    syncScroll();
    if (onScroll) onScroll(e);
  };

  const focusTextarea = () => {
    if (textareaRef.current) textareaRef.current.focus();
  };

  useEffect(() => { syncScroll(); }, [value]);

  /**
   * Renders the overlay content.
   * - In subconscious mode: invisible blur mask
   * - Otherwise: lines starting with `>` get backup-idea styling (visible tinted text)
   *   and normal lines are colored in var(--color-ink, #2C2A29)
   */
  const renderOverlay = () => {
    if (subconsciousActive) {
      // In blind mode the overlay handles the blur glow
      return value + (value.endsWith('\n') ? ' ' : '');
    }

    // Split into lines preserving newlines
    const lines = value.split('\n');
    const nodes: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      const backup = isBackupLine(line);
      if (backup) {
        // Render backup lines with muted italic style + left accent
        nodes.push(
          <span
            key={idx}
            style={{
              display: 'block',
              borderLeft: '2px solid rgba(192, 105, 78, 0.35)',
              paddingLeft: '8px',
              marginLeft: '-10px',
              color: 'var(--color-ink-muted, #7A736A)',
              fontStyle: 'italic',
            }}
          >
            {line || ' '}
          </span>
        );
      } else {
        // Normal lines: visible ink color
        nodes.push(
          <span key={idx} style={{ display: 'block', color: 'var(--color-ink, #2C2A29)' }}>
            {line || ' '}
          </span>
        );
      }
    });

    // Trailing space to keep scrollHeight correct when last char is newline
    if (value.endsWith('\n')) {
      nodes.push(
        <span key="trailing" style={{ display: 'block', color: 'transparent' }}>
          {' '}
        </span>
      );
    }

    return <>{nodes}</>;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-text overflow-hidden"
      onClick={focusTextarea}
    >
      {/* Highlight overlay — sits behind the textarea */}
      <div
        ref={overlayRef}
        className={`absolute inset-0 w-full h-full select-none pointer-events-none whitespace-pre-wrap break-words overflow-x-hidden overflow-y-auto block border-0 leading-[32px] ${isMobile ? 'py-4 px-4 text-[15px]' : 'py-6 px-8 text-[17px]'} font-serif ${
          subconsciousActive ? 'subconscious-blind-mode' : ''
        }`}
        style={{
          lineHeight: '32px',
          fontFeatureSettings: '"kern" 1, "liga" 1',
          maxWidth: '100%',
          ...style,
        }}
        aria-hidden
      >
        {renderOverlay()}
      </div>

      {/* Actual textarea — sits on top, with transparent color so overlay shows through */}
      <textarea
        ref={textareaRef}
        value={yText ? undefined : value}
        defaultValue={yText ? yText.toString() : undefined}
        onChange={textareaOnChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onScroll={handleScroll}
        onMouseUp={onMouseUp}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onSelect={onSelect}
        placeholder={placeholder}
        spellCheck="false"
        className={`w-full h-full bg-transparent font-serif leading-[32px] resize-none focus:outline-none whitespace-pre-wrap break-words overflow-x-hidden overflow-y-auto block border-0 relative z-10 ${
          isMobile ? 'py-4 px-4 text-[15px]' : 'py-6 px-8 text-[17px]'
        } ${
          subconsciousActive ? 'subconscious-blind-mode caret-transparent' : 'caret-terracotta'
        } ${className || ''}`}
        style={{
          lineHeight: '32px',
          fontFeatureSettings: '"kern" 1, "liga" 1',
          maxWidth: '100%',
          background: 'transparent',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
          ...style,
        }}
      />
    </div>
  );
});
