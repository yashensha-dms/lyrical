# Product Requirements Document (PRD): Malayalam Songwriting Companion

## 1. Problem Statement
Malayalam songwriting requires strict adherence to rhythm, meter (Aksharas / Syllables and Matras / Laghu-Guru weights), and poetic rhyme (Dviteeyakshara Praasam, Anthyapraasam). When a lyricist writes a line, finding a replacement word that conveys the exact desired meaning while fitting an exact syllable/matra budget is time-consuming and often stalls creative momentum. Existing tools either offer generative AI slop (which lyricists reject) or academic, archaic Malayalam dictionary words that sound unnatural in contemporary songs.

## 2. Core Value Proposition ("Time to Aha" < 5s)
A songwriter highlights a word in their draft (e.g. `സൂര്യൻ` - 3 syllables, 4 matras), specifies target meter (e.g. 2 syllables), and instantly sees song-proven, lyrically musical alternatives (e.g. `രവി`, `കതിർ`) drawn strictly from Malayalam songs released after 1999.

## 3. Scope & Key Pillars

### Pillar 1: Lyric Corpus Ingestion (m3db.com 2000–Present)
- Fetch all Malayalam film songs from 2000 to 2026.
- Strictly ignore songs missing lyrics (e.g. containing `ഈ പാട്ടിന്റെ വരികൾ ലഭ്യമല്ല, ചേർക്കാൻ സഹായിക്കാമോ ?.` or empty).
- Extract clean lyrics, title, movie, year, and lyricist metadata.
- Resumable and polite fetching architecture.

### Pillar 2: Malayalam Prosody & Meter Engine
- **Akshara Counter**: Accurately counts Malayalam grapheme clusters (orthographic syllables), treating conjuncts (കൂട്ടക്ഷരങ്ങൾ), anusvara (അം), visarga (അഃ), and chillus (ൽ, ൾ, ൻ, ൺ, ർ, ൿ) correctly.
- **Matra Engine**: Evaluates Laghu (ലഘു = 1 matra) vs Guru (ഗുരു = 2 matras) based on long/short vowels, conjunct preceding weights, and halant/chillu endings.

### Pillar 3: Song-Verified Lexicon & Semantic Vector Matching
- Tokenize songs into vocabulary with song frequency rankings.
- Semantic vector embeddings mapped to song vocabulary.
- Meter-filtered similarity search: Find words with similar meaning matching exact syllable or matra constraints.

### Pillar 4: Malayalam Writing Workspace & Transliteration
- Integrated Malayalam writing mode with dedicated settings.
- Real-time Manglish transliteration toggle (phonetic English typing -> Malayalam Unicode).
- Real-time per-line syllable & matra counts.
- Praasam suggestions (Anthyapraasam & Dviteeyakshara Praasam).
