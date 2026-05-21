# Songwriter Feature Status: Applied vs. Unapplied

This document maps the proposed MXM Songwriter's Notepad UX suggestions against the implemented features in Lyrical Core Workspace.

---

## Applied Features

| Feature Name | Origin / Inspiration | Version | Implementation Details |
| :--- | :--- | :--- | :--- |
| **The "Google Maps" Title Vault** | Savan Kotecha | **v1.0** | Pinned header input in [Notepad.tsx](file:///d:/Projects/Songwriting/src/components/Notepad.tsx#L72-L87) keeping the song's conceptual destination constantly visible. |
| **"Method Songwriting" Scrapbook** | Savan Kotecha | **v1.0** | Dedicated sidebar tab in [Sidebar.tsx](file:///d:/Projects/Songwriting/src/components/Sidebar.tsx#L193-L213) to dump quotes, character notes, and references. |
| **The Syllable Grid & Target Template** | Rami Yacoub | **v1.0** | Set target syllable counts in the Right Panel [RightPanel.tsx](file:///d:/Projects/Songwriting/src/components/RightPanel.tsx#L229-L285) to map the rhythm. |
| **"Pop Math" Density Visualizer** | Max Martin | **v1.0** | Real-time syllable count badges in the gutter ([Notepad.tsx](file:///d:/Projects/Songwriting/src/components/Notepad.tsx#L91-L167)) that compare line counts with target template. |
| **Voice Memo Recorder** | Taylor Swift | **v2.0** | Relocated to the Left Sidebar in [AudioDemoArea.tsx](file:///d:/Projects/Songwriting/src/components/AudioDemoArea.tsx). Includes recording, custom audio playback, base64 IndexedDB/MongoDB storage, and a real-time wave visualizer. |
| **Vocal Indicator Badges** | Taylor Swift | **v2.1.0** | Small terracotta microphone icon listed next to drafts in the Songs explorer ([Sidebar.tsx](file:///d:/Projects/Songwriting/src/components/Sidebar.tsx#L163-L165)) to highlight drafts with audio memos. |

---

## Unapplied Features

| Feature Name | Origin / Inspiration | Reason / Current Status |
| :--- | :--- | :--- |
| **Scrollable Word & Title Bank** | Taylor Swift | **Not Implemented**. Sidebar currently only has Explorer, Scrapbook, Memos, and Settings. No dedicated vocabulary bank exists. |
| **Anti-Thesaurus Simplifier** | Emily Warren | **Not Implemented**. Does not analyze complexity of written words or highlight complex words. |
| **Conversational Phrase Catcher** | Charlie Puth | **Not Implemented**. No floating or quick-capture text box for casual overhead phrases. |
| **The "Subconscious" Switch** | Chris Stapleton | **Not Implemented**. No stream-of-consciousness timer or "blind writing" canvas mode. |
