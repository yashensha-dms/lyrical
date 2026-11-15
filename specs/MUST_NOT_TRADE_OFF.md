# MUST NOT TRADE OFF

## 1. Security & Privacy
- Zero leakage of user lyrics or personal drafts.
- Server-side validation on all API endpoints.
- Secure environment configuration without committed keys or credentials.

## 2. Data Integrity
- Atomic, resumable storage for ingested corpora and user lyrics.
- No data loss during scraper interruptions or network drops.
- Clean Unicode normalization for Malayalam characters (NFC / standard Chillu characters).

## 3. Availability & Reliability
- Polite scraping with rate-limiting and exponential backoff (no IP bans, graceful handling of 429/500).
- Offline-first resilience: local storage / cache for dictionary and lyrics index.

## 4. User Experience (Core Creative Flow)
- Zero AI-generated lyric slop: tools assist discovery, never overwrite or ghostwrite human creative flow.
- Fast, instant feedback: meter calculation (Akshara & Matra) must be synchronous and sub-10ms.
- Sub-60s primary flow to find a meter-fitting replacement word.
- Input preservation: Manglish-to-Malayalam transliteration must not lose keystrokes or cursor position.

## 5. Accessibility
- WCAG 2.2 AA compliance.
- High contrast, readable Malayalam typography (Gayathri/Manjari fonts).
