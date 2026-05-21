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

---

## Suggested Features (From Personas)

### Major Features
* **The "Dare to Suck" Lyric Graveyard (Max Martin / Ed Sheeran):**
  * *Description:* A non-destructive edit vault. Removed lines and cut text blocks are pushed into a bottom drawer or sidebar panel so writers never feel the pressure of permanent deletion.
* **"Airplane Mode" Voice Booster (Savan Kotecha):**
  * *Description:* High-sensitivity recording gain boost to capture quiet, whispered melody ideas in public spaces without speaking out loud.
* **Shared co-writing link sharing (Jack Antonoff):**
  * *Description:* Collaborative online workspace sharing so writing teams can view/edit the same lyrics sheet.

### Improvements
* **"Anti-Thesaurus" Phrasing Simplifier (Emily Warren / Cara DioGuardi):**
  * *Description:* Highlights complex, multi-syllable, or non-conversational words with dotted underlines, recommending simpler, natural words.
* **Conversational Phrase Catcher (Justin Tranter / Cara DioGuardi):**
  * *Description:* Floating prompt widget or quick input drawer in the Songs list to log overhearings, casual remarks, and song-starting title phrases.
* **2-Second Catchiness Tester (Denniz Pop):**
  * *Description:* Quick-play button on voice memos that plays only the first two seconds of a melody recording to test immediate hooks.
* **Limitation Mode Toggle (BloodPop / Denniz Pop):**
  * *Description:* Clean viewport override hiding all sidebars and panels, leaving only a blank typewriter writing sheet to force focus.
* **The "Subconscious" Blind Timer (Chris Stapleton):**
  * *Description:* A timer-driven stream-of-consciousness writing mode that masks/hides the typed characters in real-time, encouraging the writer to keep typing without editing.
