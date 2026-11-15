# Project Plan: Malayalam Songwriting Companion

## Status Key
- [ ] Not Started
- [/] In Progress
- [x] Completed

---

## Tasks

### Phase 1: Ingestion Pipeline
- [x] **Task 1**: Built and verified the m3db scraper pipeline (`scripts/fetch-malayalam-lyrics.js`); discovered all 8,869 song URLs (2000–2026) and verified placeholder filtering and metadata extraction on sample batches.
- [x] **Task 1b**: Ingested complete lyric corpus: **7,145 songs** downloaded with lyrics and metadata, 1,722 placeholder/missing songs skipped.

### Phase 2: Tokenization & Meter Indexing
- [x] **Task 2**: Built Malayalam Prosody Analyzer ([malayalamProsody.ts](file:///d:/CODE/Songwriting/src/utils/malayalamProsody.ts)) and indexed the full 7,145-song vocabulary into prosody dictionaries ([malayalam_prosody_dictionary.json](file:///d:/CODE/Songwriting/data/malayalam/malayalam_prosody_dictionary.json) - 64,415 words; [malayalam_core_dictionary.json](file:///d:/CODE/Songwriting/data/malayalam/malayalam_core_dictionary.json) - 19,685 words) with exact syllable and matra weights.

### Phase 3: Semantic Embeddings & Thesaurus Index
- [x] **Task 3**: Built song-verified Malayalam thesaurus & dictionary engine ([build-malayalam-thesaurus.js](file:///d:/CODE/Songwriting/scripts/build-malayalam-thesaurus.js)), linking Datuk definitions with 64,415 song words and generating the zero-latency bundle ([song_thesaurus.json](file:///d:/CODE/Songwriting/public/malayalam/song_thesaurus.json) and [malayalam_core_dictionary.json](file:///d:/CODE/Songwriting/public/malayalam/malayalam_core_dictionary.json)) supporting direct word search, definitions, and meter-filtered synonyms.

### Phase 4: UI & Malayalam Workspace Integration
- [x] **Task 4**: Added Malayalam workspace mode, in-editor Manglish transliteration support (`Ctrl+M` / `Cmd+M` toggle and space/enter conversion), and real-time line meter (Aksharas & Matras) display in the editor.
- [x] **Task 5**: Integrated the Malayalam Dictionary, Meter-Aware Word Finder, and Praasam panel ([MalayalamWordFinderPanel.tsx](file:///d:/CODE/Songwriting/src/components/MalayalamWordFinderPanel.tsx)) into the right sidebar with live syllable budgeting, rhyme matching, and user curation.
