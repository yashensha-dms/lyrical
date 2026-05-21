# MXM Songwriter's Notepad: Action Plan

This plan maps implemented features from **v1.0** and **v2.0** alongside future features and improvements suggested directly by the songwriter personas.

---

## Implemented Workspace Features

### v1.0 (Core Songwriting Notepad)
#### Major Features
* **The Syllable Grid & Target Template:** Interactive right panel ([RightPanel.tsx](file:///d:/Projects/Songwriting/src/components/RightPanel.tsx)) for setting line-by-line syllable targets with strictness tolerances (Strict, Flexible, Relaxed).
* **The Central Writing Canvas:** High-focus, serif-styled typewriter area with auto-scrolling synchronization.

#### Improvements
* **The "Google Maps" Title Vault:** Pinned header input in [Notepad.tsx](file:///d:/Projects/Songwriting/src/components/Notepad.tsx) to anchor the conceptual song destination.
* **"Method Songwriting" Scrapbook:** Sidebar panel ([Sidebar.tsx](file:///d:/Projects/Songwriting/src/components/Sidebar.tsx)) for collecting quotes, chick-flick dialogue, and prompt ideas.
* **"Pop Math" Density Visualizer:** Color-coded gutter badges (green, amber, grey) comparing actual syllables line-by-line against target metrics.

### v2.0 (Audio & Storage Expansion)
#### Major Features
* **Left Sidebar Voice Memos:** Re-engineered dictaphone system in the left sidebar for instant access.
* **Local-First Sync Engine:** Hybrid MongoDB cloud sync and IndexedDB client-side database with status banners for offline resilience.

#### Improvements
* **Symmetrical Waveform Visualizer:** Real-time canvas waveform graph drawing voice volume fluctuations during active recording.
* **Custom Playback Slider:** Precise scrubbing, mm:ss progress timer, local `.webm` downloads, and quick delete controls.

### v2.1.0 (Vocal Indicator Badges & Persistence Fix)
#### Major Features & Improvements
* **Vocal Indicator Badges:** Small terracotta microphone icon listed next to drafts in the Songs explorer to highlight drafts with audio memos.
* **Auto-save Persistence Fix:** Ensures vocal memo presence status (`hasAudio`) is saved to IndexedDB / local database immediately after updates.

### v2.2.0 (Subconscious Blind Timer)
#### Major Features
* **Subconscious Blind Timer (Chris Stapleton):** A timer-driven stream-of-consciousness writing mode that masks typed characters in real-time, blocks deletion, and locks cursor focus to prevent editing. On completion, plays a synthesizer chime and reveals the lyrics.

### v2.3.0 (Shared Co-Writing Link Sharing)
#### Major Features
* **Shared co-writing link sharing (Jack Antonoff):** Collaborative online workspace sharing. Generates unique share links (?share=ID) allowing co-writers to edit/view same lyrics sheet. Background polling every 4 seconds auto-merges remote updates on editor blur, or prompts manual sync conflict resolution when focused.

### v2.4.0 (Anti-Thesaurus Phrasing Simplifier)
#### Improvements
* **"Anti-Thesaurus" Phrasing Simplifier (Emily Warren / Cara DioGuardi):** Scans lyrics in real-time. Highlights formal, complex, or multi-syllable (4+) words in the Right Panel and suggests simpler pop-friendly replacements. Click to instantly replace inside the notepad.

### v2.5.0 (Conversational Phrase Catcher)
#### Improvements
* **Conversational Phrase Catcher (Justin Tranter / Cara DioGuardi):** Collapsible panel at the bottom of the Songs explorer list to log overheard phrases, ideas, and casual dialogue. Persistent in `localStorage`. Offers quick actions to start new songs, append to active scrapbook, copy to clipboard, or delete.
