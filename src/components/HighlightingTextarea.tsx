import React, { useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import { EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor, placeholder as cmPlaceholder, gutter, GutterMarker, Decoration } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { EditorState, Compartment, StateField } from '@codemirror/state';
import { history, historyKeymap, defaultKeymap, moveLineUp, moveLineDown } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { yCollab } from 'y-codemirror.next';
import { countLineSyllables } from '../utils/syllables';
import { supabase } from '../utils/supabaseClient';

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
    const count = countLineSyllables(this.text);
    
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

      if (targets.length > 0) {
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

  // Custom context menu state
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const [contextCoords, setContextCoords] = React.useState({ top: 0, left: 0 });

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const pName = latestRef.current.title || "Untitled Song";

      const { error } = await supabase
        .from('graveyard')
        .insert({
          content: trimmed,
          project_name: pName,
          user_id: user.id
        });

      if (error) {
        console.error("Failed to save to graveyard:", error.message);
        alert("Failed to save to Graveyard: " + error.message);
        return;
      }

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
      autocompletion(),
      keymap.of([
        { key: "Alt-ArrowUp", run: moveLineUp },
        { key: "Alt-ArrowDown", run: moveLineDown },
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
          
          let word = "";
          const { from, to } = view.state.selection.main;
          if (from !== to) {
            word = view.state.sliceDoc(from, to).trim();
          } else {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos !== null) {
              const wordRange = view.state.wordAt(pos);
              if (wordRange) {
                word = view.state.sliceDoc(wordRange.from, wordRange.to).trim();
              }
            }
          }
          const cleanWord = word.replace(/^[^\w']+|[^\w']+$/g, '');
          if (cleanWord && latestRef.current.onWordDoubleClicked) {
            latestRef.current.onWordDoubleClicked(cleanWord);
          }
          
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
            const wordRange = view.state.wordAt(pos);
            if (wordRange) {
              const word = view.state.sliceDoc(wordRange.from, wordRange.to).trim();
              const cleanWord = word.replace(/^[^\w']+|[^\w']+$/g, '');
              if (cleanWord && latestRef.current.onWordDoubleClicked) {
                latestRef.current.onWordDoubleClicked(cleanWord);
              }
            }
          }
          return true;
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
        let word = "";
        if (from !== to) {
          word = view.state.sliceDoc(from, to).trim();
        } else {
          const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
          if (pos !== null) {
            const wordRange = view.state.wordAt(pos);
            if (wordRange) {
              word = view.state.sliceDoc(wordRange.from, wordRange.to).trim();
            }
          }
        }
        const cleanWord = word.replace(/^[^\w']+|[^\w']+$/g, '');
        if (cleanWord && latestRef.current.onWordDoubleClicked) {
          latestRef.current.onWordDoubleClicked(cleanWord);
        }
      }, 10);
    }
  };

  const handleFindRhymesFromMenu = () => {
    if (viewRef.current) {
      const view = viewRef.current;
      const { from, to } = view.state.selection.main;
      let word = "";
      if (from !== to) {
        word = view.state.sliceDoc(from, to).trim();
      } else {
        const pos = view.state.selection.main.head;
        const wordRange = view.state.wordAt(pos);
        if (wordRange) {
          word = view.state.sliceDoc(wordRange.from, wordRange.to).trim();
        }
      }
      const cleanWord = word.replace(/^[^\w']+|[^\w']+$/g, '');
      if (cleanWord && latestRef.current.onWordDoubleClicked) {
        latestRef.current.onWordDoubleClicked(cleanWord);
      }
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
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-terracotta hover:bg-paper-active transition cursor-pointer flex items-center justify-between font-bold"
            onClick={handleFindRhymesFromMenu}
          >
            <span>Find Rhymes</span>
            <span className="text-[10px] text-ink-light font-mono">Lookup</span>
          </button>
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
