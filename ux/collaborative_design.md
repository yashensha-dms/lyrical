# Real-time Collaboration Design

This document details the architecture and implementation plan for upgrading the Lyrical draft editor to a real-time collaborative system using Yjs (Conflict-free Replicated Data Types) and y-websocket.

## 1. Overview & Goals

- **Conflict-free Editing**: Allow multiple songwriters to edit the same lyrics sheet simultaneously without overwriting each other's typing.
- **Caret Preservation**: Ensure that remote updates do not cause a user's local text selection or cursor to jump.
- **Multi-field Sync**: Sync the lyric content, title, scrapbook notes, target template, and syllable tolerance under a single collaborative document state.
- **Collaborator Presence**: Render other active writers' cursors and selections inside the notepad with randomized colors and tags (e.g., "Writer 1").
- **Server-driven Persistence**: The backend server acts as the sync host and holds active Yjs documents in memory, persisting changes to MongoDB on a debounced timer.

---

## 2. Technical Stack & Dependencies

We will add the following npm packages:
1. `yjs` - Core CRDT library.
2. `y-websocket` - Websocket provider for Yjs (handles sync and presence).

---

## 3. Server Architecture (`server/index.ts`)

Instead of standard JSON-based websocket broadcast, we will integrate `y-websocket/bin/utils` into our existing Express Node server:
1. **Initialize Yjs Doc Room**:
   * For each active draft ID, the server manages a Yjs Document.
   * On connection, if the document doesn't exist in memory, the server loads it from MongoDB, sets the initial field values (lyrics, scrapbook, etc.), and registers a change callback.
2. **Websocket Handler**:
   * Map `/ws` connection requests to `y-websocket`'s `setupWSConnection` handler.
   * Join connections to a room named after the `draftId`.
3. **Database Auto-save**:
   * Set up a debounced listener (e.g., 2 seconds of silence) on each document's updates.
   * When updates occur, read values from the Y.Doc and save them to MongoDB.
   * If all clients disconnect, perform a final save and clean the memory.

---

## 4. Client Hook Architecture (`src/hooks/useDrafts.ts`)

We will rewrite the cloud connection logic:
1. **Y.Doc & Provider Lifecycle**:
   * When a draft is activated and we are in cloud mode, instantiate `new Y.Doc()` and `new WebsocketProvider(...)`.
   * Save instances to refs so they persist across React re-renders.
2. **Awareness Configuration**:
   * Set up local user name (`Writer X`) and a stable color based on client ID.
3. **Document Binding**:
   * Provide accessors to the shared types:
     * `content` -> `yDoc.getText('content')`
     * `scrapbook` -> `yDoc.getText('scrapbook')`
     * `title` -> `yDoc.getText('title')`
     * `targetTemplate` -> `yDoc.getText('targetTemplate')`
     * `syllableTolerance` -> `yDoc.getMap('settings').get('syllableTolerance')`
   * Listen to remote changes on these types and update the local React state.

---

## 5. UI Caret & Cursor Mirroring (`src/components/HighlightingTextarea.tsx` & `src/components/Notepad.tsx`)

1. **Textarea Caret Preservation**:
   * When remote edits arrive, adjust the client's current cursor offset using the delta list (shifting forward for insertions before the cursor, backward for deletions).
   * Update the textarea value in the DOM and call `setSelectionRange()` to restore the calculated positions.
2. **Caret Coordinates Mirror**:
   * Calculate coordinates using a canvas mirroring helper (or virtual div matching all CSS styling of the textarea).
   * For each active collaborator from `provider.awareness.getStates()`, compute their cursor position in pixels and draw a colored caret line and tooltip name flag over the editor canvas.

---

## 6. Offline / Reconnection Strategy

- **Automatic Sync**: Yjs natively tracks updates locally when offline. When the WebSocket connection is restored, Yjs will exchange missing update fragments and merge the edits character-by-character.
