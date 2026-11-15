import React, { useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import { EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor, placeholder as cmPlaceholder, gutter, GutterMarker, Decoration } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { EditorState, Compartment, StateField } from '@codemirror/state';
import { history, historyKeymap, defaultKeymap, moveLineUp, moveLineDown } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, startCompletion, completionStatus, currentCompletions, closeCompletion } from '@codemirror/autocomplete';
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { yCollab } from 'y-codemirror.next';
import { countLineSyllables } from '../utils/syllables';
import { isMalayalam, countLineMalayalamMeter, loadMalayalamDictionaryData, getMalayalamWordSuggestions } from '../utils/malayalamProsody';
import { transliterateWord, fetchGoogleTransliteration, getTransliterationSync } from '../utils/manglishTransliterate';
import { api } from '../utils/apiClient';

interface HighlightingTextareaProps {
  value: string;
  onChange: (value: string) => void;
  yText?: Y.Text;
  provider?: WebsocketProvider | null;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  subconsciousActive?: boolean;
  manglishActive?: boolean;
  onToggleManglish?: () => void;
  isMobile?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelect?: () => void;
  onMouseUp?: () => void;
  onScroll?: (e: React.UIEvent<HTMLTextAreaElement>) => void;
  targetTemplate?: string;
  syllableTolerance?: number;
  title?: string;
  hideGutters?: boolean;
  onMoveToGraveyard?: () => void;
  onWordDoubleClicked?: (word: string) => void;
}

const subconsciousCompartment = new Compartment();
const placeholderCompartment = new Compartment();
const collabCompartment = new Compartment();
const gutterCompartment = new Compartment();

// Terracotta themed styling for blind writing mode
const subconsciousTheme = EditorView.theme({
  ".cm-content": {
    color: "transparent !important",
    textShadow: "0 0 12px rgba(192, 105, 78, 0.45) !important",
    caretColor: "transparent !important",
    userSelect: "none !important",
  },
  ".cm-cursor": {
    borderLeftColor: "transparent !important",
  }
});

// Custom Gutter Marker to compute syllable counts and match against active templates
class SyllableMarker extends GutterMarker {
  text: string;
  lineNum: number;
  options: { targetTemplate: string, tolerance: number };

  constructor(
    text: string,
    lineNum: number,
    options: { targetTemplate: string, tolerance: number }
  ) {
    super();
    this.text = text;
    this.lineNum = lineNum;
    this.options = options;
  }

  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cm-syllable-gutter-line flex items-center justify-between px-2 w-full";
    dom.style.height = "32px";
    dom.style.display = "flex";
    dom.style.alignItems = "center";
    dom.style.justifyContent = "space-between";
    dom.style.boxSizing = "border-box";
    dom.style.width = "64px";
    
    // 1. Line Number
    const lineNumSpan = document.createElement("span");
    lineNumSpan.className = "text-[9px] text-ink-light/50";
    lineNumSpan.style.fontSize = "9px";
    lineNumSpan.style.color = "rgba(176, 168, 158, 0.5)";
    lineNumSpan.innerText = String(this.lineNum);
    dom.appendChild(lineNumSpan);

    // 2. Syllable Badge
    const isHeader = this.text.startsWith('[');
    const isMl = isMalayalam(this.text);
    const mlMeter = isMl ? countLineMalayalamMeter(this.text) : null;
    const count = mlMeter ? mlMeter.aksharas : countLineSyllables(this.text);
    
    if (!isHeader && count > 0) {
      const badgeSpan = document.createElement("span");
      
      // Scan previous lines to find the lyric index
      let lyricLineIndex = 0;
      for (let idx = 1; idx < this.lineNum; idx++) {
        const prevLineText = view.state.doc.line(idx).text.trim();
        const prevIsBackup = /^>\s?/.test(prevLineText);
        const prevIsHeader = prevLineText.startsWith('[');
        const prevIsEmpty = !prevLineText;
        if (!prevIsBackup && !prevIsHeader && !prevIsEmpty) {
          lyricLineIndex++;
        }
      }

      // Match against target template
      const targets = this.options.targetTemplate
        .replace(/[-\s,]+/g, '\n')
        .split('\n')
        .map(x => parseInt(x.trim()))
        .filter(x => !isNaN(x));

      let isMismatch = false;
      let isNearMatch = false;
      let targetCount = 0;

      if (targets.length > 0) {
        targetCount = targets[lyricLineIndex % targets.length];
        const difference = Math.abs(count - targetCount);
        if (difference > 0) {
          if (difference <= this.options.tolerance) {
            isNearMatch = true;
          } else {
            isMismatch = true;
          }
        }
      }

      badgeSpan.className = `px-1 rounded font-semibold text-[10px] flex items-center gap-0.5 transition-colors duration-150`;
      badgeSpan.style.fontSize = "10px";
      badgeSpan.style.fontWeight = "600";
      badgeSpan.style.padding = "0 4px";
      badgeSpan.style.borderRadius = "3px";

      if (isMismatch) {
        badgeSpan.className += " bg-amber-light text-amber-DEFAULT font-bold";
        badgeSpan.style.backgroundColor = "#FEF6E4"; // amber-light
        badgeSpan.style.color = "#C97A1A"; // amber-DEFAULT
        badgeSpan.innerText = String(count) + " ⚠";
      } else if (isNearMatch) {
        badgeSpan.className += " bg-paper-darker border border-terracotta/20 text-ink font-medium";
        badgeSpan.style.backgroundColor = "#E4DDD4";
        badgeSpan.style.border = "1px solid rgba(192, 105, 78, 0.2)";
        badgeSpan.style.color = "#2C2A29";
        badgeSpan.innerText = String(count);
      } else {
        badgeSpan.className += " bg-paper-darker text-ink-muted";
        badgeSpan.style.backgroundColor = "#E4DDD4";
        badgeSpan.style.color = "#7A736A";
        badgeSpan.innerText = String(count);
      }

      if (isMl && mlMeter) {
        badgeSpan.title = `${mlMeter.aksharas} അക്ഷരം | ${mlMeter.matras} മാത്ര (${mlMeter.wordCount} വാക്കുകൾ)`;
      } else if (targets.length > 0) {
        badgeSpan.title = isMismatch
          ? `Mismatch! Target: ${targetCount}, Actual: ${count}`
          : isNearMatch
          ? `Near Match (±${this.options.tolerance}). Target: ${targetCount}, Actual: ${count}`
          : `Matches target of ${targetCount} syllables`;
      }

      dom.appendChild(badgeSpan);
    } else {
      const emptySpan = document.createElement("span");
      dom.appendChild(emptySpan);
    }

    return dom;
  }
}

const syllableGutter = (options: { targetTemplate: string, tolerance: number }) => {
  return gutter({
    class: "cm-syllable-gutter",
    lineMarker(view, line) {
      const lineObj = view.state.doc.lineAt(line.from);
      return new SyllableMarker(lineObj.text.trim(), lineObj.number, options);
    }
  });
};

// Line decorations state field
function buildDecorations(state: EditorState): DecorationSet {
  const decorations = [];
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const text = line.text.trim();
    if (text.startsWith('[')) {
      decorations.push(
        Decoration.line({
          attributes: { class: "cm-section-tag-line" }
        }).range(line.from)
      );
    } else if (text.startsWith('>')) {
      decorations.push(
        Decoration.line({
          attributes: { class: "cm-backup-line" }
        }).range(line.from)
      );
    }
  }
  return Decoration.set(decorations);
}

const lyricDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(decorations, transaction) {
    if (transaction.docChanged) {
      return buildDecorations(transaction.state);
    }
    return decorations.map(transaction.changes);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  }
});

/**
 * Extracts a complete word around the given document position.
 * Handles Unicode Malayalam characters, conjuncts, chillus, and English letters.
 */
function getWordAtDocPos(view: EditorView, pos: number): { word: string; from: number; to: number } | null {
  const doc = view.state.doc;
  if (pos < 0 || pos > doc.length) return null;
  const line = doc.lineAt(pos);
  const offset = pos - line.from;
  const lineText = line.text;

  const WORD_REGEX = /[\w\u0D00-\u0D7F']+/g;
  let match: RegExpExecArray | null;
  while ((match = WORD_REGEX.exec(lineText)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (offset >= start && offset <= end) {
      const rawWord = match[0];
      const clean = rawWord.replace(/^[^\w\u0D00-\u0D7F']+|[^\w\u0D00-\u0D7F']+$/g, '').trim();
      if (clean) {
        return {
          word: clean,
          from: line.from + start,
          to: line.from + end
        };
      }
    }
  }

  const cmWord = view.state.wordAt(pos);
  if (cmWord) {
    const raw = view.state.sliceDoc(cmWord.from, cmWord.to);
    const clean = raw.replace(/^[^\w\u0D00-\u0D7F']+|[^\w\u0D00-\u0D7F']+$/g, '').trim();
    if (clean) {
      return {
        word: clean,
        from: cmWord.from,
        to: cmWord.to
      };
    }
  }

  return null;
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
  manglishActive,
  onToggleManglish,
  isMobile,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  onSelect,
  onMouseUp,
  onScroll,
  targetTemplate,
  syllableTolerance,
  title,
  hideGutters,
  onMoveToGraveyard,
  onWordDoubleClicked,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isLineCopyRef = useRef(false);
  const lastCopiedLineTextRef = useRef("");
  const lastTransliterationRef = useRef<{
    fromPos: number;
    toPos: number;
    mlWord: string;
    latinWord: string;
    timestamp: number;
  } | null>(null);

  // Preload Malayalam dictionary datasets for Ctrl+Space suggestions
  useEffect(() => {
    loadMalayalamDictionaryData();
  }, []);

  // Custom context menu state
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const [contextCoords, setContextCoords] = React.useState({ top: 0, left: 0 });
  const [contextWord, setContextWord] = React.useState('');

  // Export popup state
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [exportFilename, setExportFilename] = React.useState(title || 'lyrics');

  useEffect(() => {
    if (title) {
      setExportFilename(title);
    }
  }, [title]);

  // A ref to keep track of the latest props and state values, preventing CodeMirror recreation
  const latestRef = React.useRef({
    exportFilename,
    title,
    manglishActive,
    onToggleManglish,
    showContextMenu,
    contextCoords,
    onChange,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    onScroll,
    onSelect,
    onMouseUp,
    onMoveToGraveyard,
    onWordDoubleClicked
  });

  React.useEffect(() => {
    latestRef.current = {
      exportFilename,
      title,
      manglishActive,
      onToggleManglish,
      showContextMenu,
      contextCoords,
      onChange,
      onFocus,
      onBlur,
      onKeyDown,
      onKeyUp,
      onScroll,
      onSelect,
      onMouseUp,
      onMoveToGraveyard,
      onWordDoubleClicked
    };
  });

  // Implement textarea facade for compatibility with surrounding components
  React.useImperativeHandle(ref, () => ({
    focus: () => {
      viewRef.current?.focus();
    },
    get value() {
      return viewRef.current?.state.doc.toString() || '';
    },
    get selectionStart() {
      if (!viewRef.current) return 0;
      return viewRef.current.state.selection.main.from;
    },
    get selectionEnd() {
      if (!viewRef.current) return 0;
      return viewRef.current.state.selection.main.to;
    },
    setSelectionRange: (start: number, end: number) => {
      if (!viewRef.current) return;
      viewRef.current.dispatch({
        selection: { anchor: start, head: end },
        scrollIntoView: true
      });
    },
    get scrollTop() {
      return viewRef.current?.scrollDOM.scrollTop || 0;
    },
    set scrollTop(val: number) {
      if (viewRef.current) {
        viewRef.current.scrollDOM.scrollTop = val;
      }
    },
    insertText: (text: string) => {
      if (!viewRef.current) return;
      const view = viewRef.current;
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        scrollIntoView: true
      });
      view.focus();
    }
  } as unknown as HTMLTextAreaElement));

  // Define light mode layout-matching styles
  const editorTheme = EditorView.theme({
    "&": {
      height: "100%",
      width: "100%",
      backgroundColor: "transparent",
    },
    ".cm-scroller": {
      fontFamily: "'EB Garamond', Lora, Merriweather, Georgia, serif",
      fontSize: hideGutters ? "12px" : (isMobile ? "15px" : "17px"),
      lineHeight: hideGutters ? "20px" : "32px",
      fontFeatureSettings: '"kern" 1, "liga" 1',
      overflowX: "hidden",
      overflowY: "auto",
    },
    ".cm-content": {
      padding: hideGutters ? "12px" : (isMobile ? "16px" : "24px 32px"),
      caretColor: "var(--color-terracotta, #C0694E)",
      fontFamily: "inherit",
    },
    "&.cm-focused": {
      outline: "none"
    },
    ".cm-cursor": {
      borderLeftColor: "var(--color-terracotta, #C0694E)",
      borderLeftWidth: "2px"
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(192, 105, 78, 0.25) !important",
    },
    ".cm-nativeSelection": {
      backgroundColor: "rgba(192, 105, 78, 0.25) !important",
    },
    // Gutter styling
    ".cm-gutters": {
      backgroundColor: "var(--color-paper-dark, #F2EFE9)",
      borderRight: "1px solid var(--color-paper-darker, #E4DDD4)",
    },
    ".cm-syllable-gutter": {
      width: "64px",
      backgroundColor: "var(--color-paper-dark, #F2EFE9)",
      flexShrink: 0,
      userSelect: "none",
    },
    "@keyframes cm-yBlink": {
      "0%, 100%": {},
      "50%": { borderLeftColor: "transparent !important" }
    },
    ".cm-ySelectionCaret": {
      animation: "cm-yBlink 1.2s steps(1) infinite"
    },
    // Autocomplete dropdown styling
    ".cm-tooltip-autocomplete": {
      backgroundColor: "var(--color-paper-dark, #F2EFE9) !important",
      border: "1px solid var(--color-paper-darker, #E4DDD4) !important",
      borderRadius: "10px !important",
      boxShadow: "0 4px 16px rgba(44, 42, 41, 0.12) !important",
      padding: "4px !important",
    },
    ".cm-tooltip-autocomplete ul": {
      fontFamily: "'EB Garamond', Lora, Merriweather, Georgia, serif !important",
      fontSize: "15px !important",
    },
    ".cm-tooltip-autocomplete ul li": {
      padding: "4px 10px !important",
      borderRadius: "6px !important",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "rgba(192, 105, 78, 0.15) !important",
      color: "var(--color-terracotta, #C0694E) !important",
      fontWeight: "bold !important",
    }
  });

  const moveToGraveyard = async () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from, to } = view.state.selection.main;
    let textToGrave = "";
    let fromDel = from;
    let toDel = to;

    if (from === to) {
      const line = view.state.doc.lineAt(from);
      textToGrave = line.text;
      fromDel = line.from;
      toDel = line.to;
      if (line.number < view.state.doc.lines) {
        toDel = view.state.doc.line(line.number + 1).from;
      } else if (line.number > 1) {
        fromDel = view.state.doc.line(line.number - 1).to;
      }
    } else {
      textToGrave = view.state.sliceDoc(from, to);
    }

    const trimmed = textToGrave.trim();
    if (!trimmed) return;

    try {
      const pName = latestRef.current.title || "Untitled Song";
      await api.graveyard.create(trimmed, pName);

      view.dispatch({
        changes: { from: fromDel, to: toDel, insert: "" }
      });

      if (latestRef.current.onMoveToGraveyard) {
        latestRef.current.onMoveToGraveyard();
      }
    } catch (e) {
      console.error("Exception moving to graveyard:", e);
    }
  };

  const handleMoveToGraveyard = () => {
    moveToGraveyard();
    setShowContextMenu(false);
    viewRef.current?.focus();
  };

  const handleTriggerExport = () => {
    setShowExportModal(true);
  };

  const handleConfirmExport = () => {
    if (!viewRef.current) return;
    const text = viewRef.current.state.doc.toString();
    
    // Download TXT
    const element = document.createElement("a");
    const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = exportFilename.endsWith('.txt') ? exportFilename : `${exportFilename}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    setShowExportModal(false);
  };

  // Custom command to duplicate the current line
  const duplicateLineCommand = (view: EditorView) => {
    const { state } = view;
    const line = state.doc.lineAt(state.selection.main.head);
    const insertText = "\n" + line.text;
    view.dispatch({
      changes: { from: line.to, insert: insertText },
      selection: { anchor: state.selection.main.head + insertText.length }
    });
    return true;
  };

  // Prepend backup indicator character '> '
  const prependBackupChar = (view: EditorView) => {
    const { state } = view;
    const line = state.doc.lineAt(state.selection.main.head);
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: "> " }
    });
  };

  // Trigger Context Menu
  const triggerContextMenu = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const top = clientY - rect.top;
    const left = clientX - rect.left;
    setContextCoords({ top, left });
    setShowContextMenu(true);
  };

  // Custom Context Menu actions
  const handleCut = async () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from, to } = view.state.selection.main;
    if (from !== to) {
      const text = view.state.sliceDoc(from, to);
      await navigator.clipboard.writeText(text);
      view.dispatch({
        changes: { from, to, insert: "" }
      });
      isLineCopyRef.current = false;
    } else {
      const line = view.state.doc.lineAt(view.state.selection.main.head);
      const text = line.text + "\n";
      await navigator.clipboard.writeText(text);
      isLineCopyRef.current = true;
      lastCopiedLineTextRef.current = line.text;

      let fromDel = line.from;
      let toDel = line.to;
      if (line.number < view.state.doc.lines) {
        toDel = view.state.doc.line(line.number + 1).from;
      } else if (line.number > 1) {
        fromDel = view.state.doc.line(line.number - 1).to;
      }

      view.dispatch({
        changes: { from: fromDel, to: toDel, insert: "" }
      });
    }
    setShowContextMenu(false);
    view.focus();
  };

  const handleCopy = async () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from, to } = view.state.selection.main;
    let text: string;
    if (from !== to) {
      text = view.state.sliceDoc(from, to);
      isLineCopyRef.current = false;
    } else {
      const line = view.state.doc.lineAt(view.state.selection.main.head);
      text = line.text + "\n";
      isLineCopyRef.current = true;
      lastCopiedLineTextRef.current = line.text;
    }
    await navigator.clipboard.writeText(text);
    setShowContextMenu(false);
    view.focus();
  };

  const handlePaste = async () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    try {
      const text = await navigator.clipboard.readText();
      const { from, to, empty } = view.state.selection.main;
      
      const isLineCopy = isLineCopyRef.current || text.endsWith('\n');
      if (empty && isLineCopy) {
        const line = view.state.doc.lineAt(from);
        const insertText = text.endsWith('\n') ? text : text + '\n';
        view.dispatch({
          changes: { from: line.from, insert: insertText },
          scrollIntoView: true
        });
      } else {
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length }
        });
      }
    } catch (e) {
      console.error("Paste blocked by browser permissions", e);
    }
    setShowContextMenu(false);
    view.focus();
  };



  // Re-sync subconscious writing mode state dynamically
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: subconsciousCompartment.reconfigure(subconsciousActive ? subconsciousTheme : [])
    });
  }, [subconsciousActive]);

  // Re-sync placeholder state dynamically
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: placeholderCompartment.reconfigure(cmPlaceholder(placeholder || ""))
    });
  }, [placeholder]);

  // Re-sync Yjs collaboration bindings dynamically
  useEffect(() => {
    if (!viewRef.current) return;
    const extensions = [];
    if (yText && provider) {
      extensions.push(yCollab(yText, provider.awareness));
    }
    viewRef.current.dispatch({
      effects: collabCompartment.reconfigure(extensions)
    });
  }, [yText, provider]);

  // Re-sync gutter settings dynamically
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: gutterCompartment.reconfigure(
        (isMobile || hideGutters) ? [] : syllableGutter({
          targetTemplate: targetTemplate || "",
          tolerance: syllableTolerance ?? 1
        })
      )
    });
  }, [targetTemplate, syllableTolerance, isMobile, hideGutters]);

  // Sync document value from parent (only when NOT in Yjs collaboration mode)
  useEffect(() => {
    if (!viewRef.current || (yText && provider)) return;
    const currentVal = viewRef.current.state.doc.toString();
    if (value !== currentVal) {
      viewRef.current.dispatch({
        changes: { from: 0, to: currentVal.length, insert: value }
      });
    }
  }, [value, yText, provider]);

  // Autocompletion source powered by Google Input Tools (ml-t-i0-und) & Malayalam Song Thesaurus
  const malayalamCompletionSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
    // A. Check for Latin / Manglish word before cursor
    const latinWord = context.matchBefore(/[a-zA-Z]+/);
    if (latinWord && (latinWord.from < latinWord.to || context.explicit)) {
      try {
        const candidates = await fetchGoogleTransliteration(latinWord.text, 5);
        const options: any[] = candidates.map((c, index) => ({
          label: c,
          displayLabel: `${index + 1}. ${c}`,
          detail: index === 0 ? 'Google' : undefined,
          type: 'text',
          boost: 100 - index,
          apply: (view: EditorView, _completion: any, from: number, to: number) => {
            view.dispatch({
              changes: { from, to, insert: c + " " },
              selection: { anchor: from + c.length + 1 }
            });
            lastTransliterationRef.current = {
              fromPos: from,
              toPos: from + c.length + 1,
              mlWord: c,
              latinWord: latinWord.text,
              timestamp: Date.now()
            };
          }
        }));

        // English option so user can always retain the exact Latin letters
        if (!candidates.includes(latinWord.text)) {
          options.push({
            label: latinWord.text,
            displayLabel: `${options.length + 1}. ${latinWord.text} (English)`,
            type: 'text',
            boost: 10,
            apply: (view: EditorView, _completion: any, from: number, to: number) => {
              view.dispatch({
                changes: { from, to, insert: latinWord.text + " " },
                selection: { anchor: from + latinWord.text.length + 1 }
              });
            }
          });
        }

        return {
          from: latinWord.from,
          to: latinWord.to,
          options,
          filter: false // CRITICAL: Disable CM's label filtering so Malayalam characters aren't filtered out by Latin input!
        };
      } catch {
        return null;
      }
    }

    // B. Check for Malayalam word before cursor (for Ctrl+Space synonym and poetic word discovery)
    const mlWord = context.matchBefore(/[\u0D00-\u0D7F]+/);
    if (mlWord && (mlWord.from < mlWord.to || context.explicit)) {
      const query = mlWord.text.trim();
      if (!query) return null;

      const suggestions = getMalayalamWordSuggestions(query);
      if (suggestions.length === 0) return null;

      return {
        from: mlWord.from,
        to: mlWord.to,
        options: suggestions.map((s, index) => ({
          label: s.word,
          displayLabel: `${index + 1}. ${s.word}`,
          detail: s.detail,
          type: 'text',
          boost: 100 - index,
          apply: (view: EditorView, _completion: any, from: number, to: number) => {
            view.dispatch({
              changes: { from, to, insert: s.word + " " },
              selection: { anchor: from + s.word.length + 1 }
            });
          }
        })),
        filter: false // Allow diverse synonyms without strict prefix match
      };
    }

    return null;
  };

  // Initialize CodeMirror editor instance
  useEffect(() => {
    if (!containerRef.current) return;

    const initialExtensions = [
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion({ override: [malayalamCompletionSource] }),
      keymap.of([
        {
          key: "Ctrl-Space",
          run: (view) => {
            return startCompletion(view);
          }
        },
        {
          key: "Mod-Space",
          run: (view) => {
            return startCompletion(view);
          }
        },
        // Number keys 1-9 to select candidates directly when completion popup is active (Kuttipencil / Google IME style)
        ...(['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((numStr, idx) => ({
          key: numStr,
          run: (view: EditorView) => {
            if (completionStatus(view.state) === "active") {
              const completions = currentCompletions(view.state);
              if (completions && completions[idx]) {
                const comp = completions[idx];
                const active = view.state.selection.main;
                if (typeof comp.apply === "function") {
                  comp.apply(view, comp, active.from, active.to);
                } else {
                  const insertText = (comp.apply || comp.label) + " ";
                  view.dispatch({
                    changes: { from: active.from, to: active.to, insert: insertText },
                    selection: { anchor: active.from + insertText.length }
                  });
                }
                closeCompletion(view);
                return true;
              }
            }
            return false;
          }
        }))),
        { key: "Alt-ArrowUp", run: moveLineUp },
        { key: "Alt-ArrowDown", run: moveLineDown },
        {
          key: "Backspace",
          run: (view) => {
            if (latestRef.current.manglishActive && lastTransliterationRef.current) {
              const { fromPos, toPos, latinWord } = lastTransliterationRef.current;
              const head = view.state.selection.main.head;
              const empty = view.state.selection.main.empty;

              // If cursor is directly at the space/newline after the freshly converted word:
              if (empty && head === toPos) {
                lastTransliterationRef.current = null;
                // Revert Malayalam word + trailing char back to original Latin spelling
                view.dispatch({
                  changes: { from: fromPos, to: toPos, insert: latinWord },
                  selection: { anchor: fromPos + latinWord.length }
                });
                // Immediately open candidate selection dropdown (Kuttipencil behavior)
                setTimeout(() => {
                  startCompletion(view);
                }, 10);
                return true;
              }
            }
            lastTransliterationRef.current = null;
            return false;
          }
        },
        {
          key: "Ctrl-c",
          run: (view) => {
            if (view.state.selection.main.empty) {
              const line = view.state.doc.lineAt(view.state.selection.main.head);
              navigator.clipboard.writeText(line.text + "\n");
              isLineCopyRef.current = true;
              lastCopiedLineTextRef.current = line.text;
              return true;
            }
            isLineCopyRef.current = false;
            return false;
          }
        },
        {
          key: "Ctrl-x",
          run: (view) => {
            if (view.state.selection.main.empty) {
              const line = view.state.doc.lineAt(view.state.selection.main.head);
              navigator.clipboard.writeText(line.text + "\n");
              isLineCopyRef.current = true;
              lastCopiedLineTextRef.current = line.text;
              
              let fromDel = line.from;
              let toDel = line.to;
              if (line.number < view.state.doc.lines) {
                toDel = view.state.doc.line(line.number + 1).from;
              } else if (line.number > 1) {
                fromDel = view.state.doc.line(line.number - 1).to;
              }
              
              view.dispatch({
                changes: { from: fromDel, to: toDel, insert: "" }
              });
              return true;
            }
            isLineCopyRef.current = false;
            return false;
          }
        },
        { key: "Ctrl-d", run: duplicateLineCommand },
        {
          key: "Ctrl-b",
          run: () => {
            moveToGraveyard();
            return true;
          }
        },
        {
          key: "Ctrl-s",
          run: () => {
            handleTriggerExport();
            return true;
          }
        },
        {
          key: "Mod-m",
          run: () => {
            if (latestRef.current.onToggleManglish) {
              latestRef.current.onToggleManglish();
              return true;
            }
            return false;
          }
        },
        {
          key: "Space",
          run: (view) => {
            if (latestRef.current.manglishActive) {
              const pos = view.state.selection.main.head;
              const line = view.state.doc.lineAt(pos);
              const textBefore = line.text.slice(0, pos - line.from);
              const match = textBefore.match(/([a-zA-Z]+)$/);
              if (match) {
                const latinWord = match[1];
                const fromPos = pos - latinWord.length;
                const cached = getTransliterationSync(latinWord);
                const mlWord = cached || transliterateWord(latinWord);

                view.dispatch({
                  changes: { from: fromPos, to: pos, insert: mlWord + " " },
                  selection: { anchor: fromPos + mlWord.length + 1 }
                });

                lastTransliterationRef.current = {
                  fromPos,
                  toPos: fromPos + mlWord.length + 1,
                  mlWord,
                  latinWord,
                  timestamp: Date.now()
                };

                if (!cached) {
                  fetchGoogleTransliteration(latinWord).then(candidates => {
                    const top = candidates[0];
                    if (top && top !== mlWord) {
                      const curDoc = view.state.doc.toString();
                      const expected = mlWord + " ";
                      if (curDoc.slice(fromPos, fromPos + expected.length) === expected) {
                        view.dispatch({
                          changes: { from: fromPos, to: fromPos + mlWord.length, insert: top }
                        });
                        if (lastTransliterationRef.current?.fromPos === fromPos) {
                          lastTransliterationRef.current.mlWord = top;
                          lastTransliterationRef.current.toPos = fromPos + top.length + 1;
                        }
                      }
                    }
                  });
                }
                return true;
              }
            }
            lastTransliterationRef.current = null;
            return false;
          }
        },
        {
          key: "Enter",
          run: (view) => {
            if (latestRef.current.manglishActive) {
              const pos = view.state.selection.main.head;
              const line = view.state.doc.lineAt(pos);
              const textBefore = line.text.slice(0, pos - line.from);
              const match = textBefore.match(/([a-zA-Z]+)$/);
              if (match) {
                const latinWord = match[1];
                const fromPos = pos - latinWord.length;
                const cached = getTransliterationSync(latinWord);
                const mlWord = cached || transliterateWord(latinWord);

                view.dispatch({
                  changes: { from: fromPos, to: pos, insert: mlWord + "\n" },
                  selection: { anchor: fromPos + mlWord.length + 1 }
                });

                lastTransliterationRef.current = {
                  fromPos,
                  toPos: fromPos + mlWord.length + 1,
                  mlWord,
                  latinWord,
                  timestamp: Date.now()
                };

                if (!cached) {
                  fetchGoogleTransliteration(latinWord).then(candidates => {
                    const top = candidates[0];
                    if (top && top !== mlWord) {
                      const curDoc = view.state.doc.toString();
                      const expected = mlWord + "\n";
                      if (curDoc.slice(fromPos, fromPos + expected.length) === expected) {
                        view.dispatch({
                          changes: { from: fromPos, to: fromPos + mlWord.length, insert: top }
                        });
                        if (lastTransliterationRef.current?.fromPos === fromPos) {
                          lastTransliterationRef.current.mlWord = top;
                          lastTransliterationRef.current.toPos = fromPos + top.length + 1;
                        }
                      }
                    }
                  });
                }
                return true;
              }
            }
            lastTransliterationRef.current = null;
            return false;
          }
        },
        ...historyKeymap,
        ...defaultKeymap,
        ...closeBracketsKeymap,
        ...completionKeymap
      ]),
      editorTheme,
      hideGutters ? [] : lyricDecorationsField,
      subconsciousCompartment.of(subconsciousActive ? subconsciousTheme : []),
      placeholderCompartment.of(cmPlaceholder(placeholder || "")),
      collabCompartment.of(yText && provider ? yCollab(yText, provider.awareness) : []),
      gutterCompartment.of(
        (isMobile || hideGutters) ? [] : syllableGutter({
          targetTemplate: targetTemplate || "",
          tolerance: syllableTolerance ?? 1
        })
      ),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet) {
          if (!update.state.selection.main.empty) {
            isLineCopyRef.current = false;
          }
        }
        if (update.docChanged) {
          latestRef.current.onChange(update.state.doc.toString());
          if (latestRef.current.manglishActive) {
            const pos = update.state.selection.main.head;
            const line = update.state.doc.lineAt(pos);
            const textBefore = line.text.slice(0, pos - line.from);
            const match = textBefore.match(/([a-zA-Z]+)$/);
            if (match && match[1].length >= 2) {
              fetchGoogleTransliteration(match[1]);
            }
          }
        }
        if (latestRef.current.onScroll && update.geometryChanged) {
          const mockEvent = {
            target: {
              scrollTop: update.view.scrollDOM.scrollTop,
              scrollLeft: update.view.scrollDOM.scrollLeft
            }
          } as unknown as React.UIEvent<HTMLTextAreaElement>;
          latestRef.current.onScroll(mockEvent);
        }
      }),
      EditorView.domEventHandlers({
        focus: () => {
          if (latestRef.current.onFocus) latestRef.current.onFocus();
        },
        blur: () => {
          if (latestRef.current.onBlur) latestRef.current.onBlur();
        },
        contextmenu: (event, view) => {
          if (hideGutters) return;
          event.preventDefault();
          
          let selectedWord = "";
          const { from, to } = view.state.selection.main;
          if (from !== to) {
            const raw = view.state.sliceDoc(from, to).trim();
            selectedWord = raw.replace(/^[^\w\u0D00-\u0D7F']+|[^\w\u0D00-\u0D7F']+$/g, '').trim();
          } else {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos !== null) {
              const wordInfo = getWordAtDocPos(view, pos);
              if (wordInfo) {
                selectedWord = wordInfo.word;
              }
            }
          }
          setContextWord(selectedWord);
          triggerContextMenu(event.clientX, event.clientY);
          return true;
        },
        paste: (event, view) => {
          const clipboardData = event.clipboardData;
          if (!clipboardData) return;
          const text = clipboardData.getData("text");
          if (!text) return;

          if (view.state.selection.main.empty) {
            const isLineCopy = isLineCopyRef.current || text.endsWith('\n');
            if (isLineCopy) {
              event.preventDefault();
              const line = view.state.doc.lineAt(view.state.selection.main.head);
              const insertText = text.endsWith('\n') ? text : text + '\n';
              view.dispatch({
                changes: { from: line.from, insert: insertText },
                scrollIntoView: true
              });
              return true;
            }
          }
        },
        keydown: (event) => {
          // Trigger Ctrl+S export dialog from keydown fallback if CM keymap did not catch it
          if (event.ctrlKey && event.key.toLowerCase() === 's') {
            event.preventDefault();
            handleTriggerExport();
            return true;
          }

          // Trigger Ctrl+G graveyard command from keydown fallback
          if (event.ctrlKey && event.key.toLowerCase() === 'b') {
            event.preventDefault();
            moveToGraveyard();
            return true;
          }

          if (latestRef.current.onKeyDown) {
            latestRef.current.onKeyDown(event as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
          }
        },
        keyup: (event) => {
          if (latestRef.current.onKeyUp) {
            latestRef.current.onKeyUp(event as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
          }
        },
        mousedown: () => {
          setShowContextMenu(false);
          if (latestRef.current.onMouseUp) latestRef.current.onMouseUp();
          if (latestRef.current.onSelect) latestRef.current.onSelect();
        },
        dblclick: (event, view) => {
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos !== null) {
            const wordInfo = getWordAtDocPos(view, pos);
            if (wordInfo) {
              view.dispatch({
                selection: { anchor: wordInfo.from, head: wordInfo.to }
              });
              if (latestRef.current.onWordDoubleClicked) {
                latestRef.current.onWordDoubleClicked(wordInfo.word);
              }
              return true;
            }
          }
          return false;
        }
      })
    ];

    const state = EditorState.create({
      doc: yText ? yText.toString() : value,
      extensions: initialExtensions
    });

    const view = new EditorView({
      state,
      parent: containerRef.current
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yText, provider]);

  const handleContainerClick = () => {
    if (viewRef.current) {
      viewRef.current.focus();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (viewRef.current) {
      const view = viewRef.current;
      setTimeout(() => {
        const { from, to } = view.state.selection.main;
        if (from !== to) {
          const word = view.state.sliceDoc(from, to).trim();
          const cleanWord = word.replace(/^[^\w\u0D00-\u0D7F']+|[^\w\u0D00-\u0D7F']+$/g, '').trim();
          if (cleanWord && latestRef.current.onWordDoubleClicked) {
            latestRef.current.onWordDoubleClicked(cleanWord);
            return;
          }
        }
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos !== null) {
          const wordInfo = getWordAtDocPos(view, pos);
          if (wordInfo && latestRef.current.onWordDoubleClicked) {
            latestRef.current.onWordDoubleClicked(wordInfo.word);
          }
        }
      }, 10);
    }
  };

  const handleFindRhymesFromMenu = () => {
    let wordToLookup = contextWord;
    if (!wordToLookup && viewRef.current) {
      const view = viewRef.current;
      const { from, to } = view.state.selection.main;
      if (from !== to) {
        wordToLookup = view.state.sliceDoc(from, to).replace(/^[^\w\u0D00-\u0D7F']+|[^\w\u0D00-\u0D7F']+$/g, '').trim();
      } else {
        const wordInfo = getWordAtDocPos(view, view.state.selection.main.head);
        if (wordInfo) wordToLookup = wordInfo.word;
      }
    }
    if (wordToLookup && latestRef.current.onWordDoubleClicked) {
      latestRef.current.onWordDoubleClicked(wordToLookup);
    }
    setShowContextMenu(false);
  };

  const containerClass = `w-full h-full cursor-text overflow-hidden relative ${className || ''} ${
    hideGutters ? 'hide-gutters' : (isMobile ? 'is-mobile' : 'is-desktop')
  }`;

  return (
    <div
      ref={containerRef}
      className={containerClass}
      style={style}
      onClick={handleContainerClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Custom Context Menu Overlay */}
      {showContextMenu && (
        <div
          className="absolute bg-paper border border-paper-darker rounded-lg shadow-paper-md py-1 z-[60] w-48 card-warm-md"
          style={{
            top: `${contextCoords.top + 200 > window.innerHeight ? contextCoords.top - 200 : contextCoords.top}px`,
            left: `${contextCoords.left}px`,
            backgroundColor: 'var(--color-paper, #FAF8F5)',
            borderColor: 'var(--color-paper-darker, #E4DDD4)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const isMalayalamContext = isMalayalam(contextWord) || !!latestRef.current.manglishActive;
            return (
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-terracotta hover:bg-paper-active transition cursor-pointer flex items-center justify-between font-bold"
                onClick={handleFindRhymesFromMenu}
              >
                <span>{isMalayalamContext ? 'Find Malayalam Synonyms' : 'Find Rhymes'}</span>
                <span className="text-[10px] text-ink-light font-mono">{isMalayalamContext ? 'നിഘണ്ടു' : 'Lookup'}</span>
              </button>
            );
          })()}
          <div className="border-t border-paper-darker my-1" style={{ borderColor: 'var(--color-paper-darker, #E4DDD4)' }} />
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-paper-active transition cursor-pointer flex items-center justify-between"
            onClick={handleCut}
          >
            <span>Cut</span>
            <span className="text-[10px] text-ink-light font-mono">Ctrl+X</span>
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-paper-active transition cursor-pointer flex items-center justify-between"
            onClick={handleCopy}
          >
            <span>Copy</span>
            <span className="text-[10px] text-ink-light font-mono">Ctrl+C</span>
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-paper-active transition cursor-pointer flex items-center justify-between"
            onClick={handlePaste}
          >
            <span>Paste</span>
            <span className="text-[10px] text-ink-light font-mono">Ctrl+V</span>
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-paper-active transition cursor-pointer flex items-center justify-between"
            onClick={handleMoveToGraveyard}
          >
            <span>Move to Graveyard</span>
            <span className="text-[10px] text-ink-light font-mono">Ctrl+B</span>
          </button>
          <div className="border-t border-paper-darker my-1" style={{ borderColor: 'var(--color-paper-darker, #E4DDD4)' }} />
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-paper-active transition cursor-pointer flex items-center justify-between"
            onClick={() => {
              if (viewRef.current) duplicateLineCommand(viewRef.current);
              setShowContextMenu(false);
              viewRef.current?.focus();
            }}
          >
            <span>Duplicate Line</span>
            <span className="text-[10px] text-ink-light font-mono">Ctrl+D</span>
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-paper-active transition cursor-pointer flex items-center justify-between"
            onClick={() => {
              if (viewRef.current) prependBackupChar(viewRef.current);
              setShowContextMenu(false);
              viewRef.current?.focus();
            }}
          >
            <span>Add Backup Line</span>
            <span className="text-[10px] text-ink-light font-mono">&gt;</span>
          </button>
        </div>
      )}

      {/* Ctrl+S Export TXT Modal Popup */}
      {showExportModal && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-xs z-[9999] flex items-center justify-center"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="bg-paper border border-paper-darker rounded-xl p-6 w-80 flex flex-col gap-4 shadow-paper-md"
            style={{
              backgroundColor: 'var(--color-paper, #FAF8F5)',
              borderColor: 'var(--color-paper-darker, #E4DDD4)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold text-ink text-sm">Export Lyrics</h3>
            <p className="text-xs text-ink-muted leading-relaxed">Save your current lyric sheet to a local plain text file.</p>
            <input
              type="text"
              value={exportFilename}
              onChange={(e) => setExportFilename(e.target.value)}
              placeholder="Filename"
              className="w-full bg-paper-dark border border-paper-darker rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-terracotta transition"
              style={{
                backgroundColor: 'var(--color-paper-dark, #F2EFE9)',
                borderColor: 'var(--color-paper-darker, #E4DDD4)'
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                className="px-3 py-1.5 rounded border border-paper-darker text-ink-muted hover:bg-paper-active transition cursor-pointer font-medium"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded bg-terracotta hover:bg-terracotta-hover text-white transition cursor-pointer font-bold"
                onClick={handleConfirmExport}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
