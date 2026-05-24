import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function useYjsTextarea(
  yText: Y.Text | undefined,
  provider: WebsocketProvider | null,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
) {
  const yTextRef = useRef(yText);
  const lastValueRef = useRef('');

  useEffect(() => {
    yTextRef.current = yText;
  }, [yText]);

  // Synchronize initial value when yText changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !yText) return;

    const val = yText.toString();
    textarea.value = val;
    lastValueRef.current = val;
  }, [yText, textareaRef]);

  // Sync Y.Text modifications to state & DOM value
  useEffect(() => {
    if (!yText) return;

    const handleYTextChange = (event: Y.YTextEvent) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (event.transaction.origin === 'local-keystroke') {
        // Change originated from this user's local keystrokes.
        // Caret position and DOM value are already handled by browser natively.
        return;
      }

      if (!event.changes || !event.changes.delta) return;

      // Remote change: calculate caret position shift
      const newValue = yText.toString();
      const { selectionStart, selectionEnd } = textarea;
      let newSelectionStart = selectionStart;
      let newSelectionEnd = selectionEnd;
      let index = 0;

      event.changes.delta.forEach(change => {
        if (change.retain) {
          index += change.retain;
        } else if (change.insert) {
          const len = typeof change.insert === 'string' ? change.insert.length : 1;
          if (index < newSelectionStart) {
            newSelectionStart += len;
          }
          if (index < newSelectionEnd) {
            newSelectionEnd += len;
          }
          index += len;
        } else if (change.delete) {
          const len = change.delete;
          if (index < newSelectionStart) {
            newSelectionStart -= Math.min(len, newSelectionStart - index);
          }
          if (index < newSelectionEnd) {
            newSelectionEnd -= Math.min(len, newSelectionEnd - index);
          }
        }
      });

      // Update DOM value directly to avoid visual lag, and set the new selection range
      textarea.value = newValue;
      lastValueRef.current = newValue;
      textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
    };

    yText.observe(handleYTextChange);
    return () => {
      yText.unobserve(handleYTextChange);
    };
  }, [yText, textareaRef]);

  // Compute text diffs when user types and apply them to Y.Text
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const activeYText = yTextRef.current;
    if (!activeYText) return;

    const textarea = e.target;
    const newValue = textarea.value;
    const oldValue = lastValueRef.current;

    if (newValue === oldValue) return;

    // Find first mismatch
    let start = 0;
    while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) {
      start++;
    }

    // Find last mismatch
    let oldEnd = oldValue.length;
    let newEnd = newValue.length;
    while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }

    const deleteCount = oldEnd - start;
    const insertedText = newValue.substring(start, newEnd);

    activeYText.doc?.transact(() => {
      if (deleteCount > 0) {
        activeYText.delete(start, deleteCount);
      }
      if (insertedText.length > 0) {
        activeYText.insert(start, insertedText);
      }
    }, 'local-keystroke');

    lastValueRef.current = newValue;
  };

  // Sync cursor selection position to Yjs Awareness
  useEffect(() => {
    if (!provider || !yText) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleSelectionChange = () => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      provider.awareness.setLocalStateField('cursor', {
        anchor: start,
        head: end
      });
    };

    textarea.addEventListener('keyup', handleSelectionChange);
    textarea.addEventListener('mouseup', handleSelectionChange);
    textarea.addEventListener('focus', handleSelectionChange);
    textarea.addEventListener('input', handleSelectionChange);

    return () => {
      textarea.removeEventListener('keyup', handleSelectionChange);
      textarea.removeEventListener('mouseup', handleSelectionChange);
      textarea.removeEventListener('focus', handleSelectionChange);
      textarea.removeEventListener('input', handleSelectionChange);
    };
  }, [provider, yText, textareaRef]);

  return {
    onChange: handleChange
  };
}
