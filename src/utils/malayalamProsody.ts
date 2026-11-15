/**
 * Malayalam Prosody & Meter Engine
 * Implements classical and contemporary Malayalam metric analysis (വൃത്തശാസ്ത്രം):
 * - Akshara counting (അക്ഷരങ്ങൾ / Orthographic syllables)
 * - Matra weighting (മാത്രകൾ / Laghu = 1 vs Guru = 2)
 * - Rhyme extraction (ദ്വിതീയാക്ഷരപ്രാസം & അന്ത്യപ്രാസം)
 */

export const SHORT_VOWELS = new Set(['അ', 'ഇ', 'ഉ', 'ഋ', 'എ', 'ഒ']);
export const LONG_VOWELS = new Set(['ആ', 'ഈ', 'ഊ', 'ഏ', 'ഐ', 'ഓ', 'ഔ']);

export const SHORT_VOWEL_SIGNS = new Set(['\u0D3F', '\u0D41', '\u0D43', '\u0D46', '\u0D4A']); // ി, ു, ൃ, െ, ൊ
export const LONG_VOWEL_SIGNS = new Set(['\u0D3E', '\u0D40', '\u0D42', '\u0D47', '\u0D48', '\u0D4B', '\u0D4C', '\u0D57']); // ാ, ീ, ൂ, േ, ൈ, ോ, ൌ, ൗ

export const CHILLU_CHARS = new Set(['\u0D7A', '\u0D7B', '\u0D7C', '\u0D7D', '\u0D7E', '\u0D7F']); // ൺ, ൻ, ർ, ൽ, ൾ, ൿ
export const ANUSVARA_VISARGA = new Set(['\u0D02', '\u0D03']); // ം, ഃ
export const VIRAMA = '\u0D4D'; // ്

export interface WordMeterProfile {
  word: string;
  syllables: string[];
  aksharaCount: number;
  matraList: number[];
  totalMatras: number;
  pattern: string; // e.g. "ഗു-ല-ഗു"
  dviteeyaksharam: string | null;
  rhymeEnding: string | null;
}

export interface LineMeterProfile {
  line: string;
  aksharas: number;
  matras: number;
  wordCount: number;
}

/**
 * Checks if a string contains any Malayalam Unicode characters
 */
export function isMalayalam(text: string): boolean {
  return /[\u0D00-\u0D7F]/.test(text);
}

/**
 * Checks if a grapheme cluster represents a pure chillu letter
 */
export function isChillu(cluster: string): boolean {
  return cluster.length === 1 && CHILLU_CHARS.has(cluster);
}

/**
 * Checks if a grapheme cluster represents a consonant conjunct (കൂട്ടക്ഷരം)
 */
export function isConjunct(cluster: string): boolean {
  return cluster.includes(VIRAMA) && !cluster.endsWith(VIRAMA);
}

/**
 * Analyzes a single Malayalam word's prosody (syllables, matras, and rhyme keys)
 */
export function analyzeMalayalamWord(rawWord: string): WordMeterProfile {
  const word = rawWord.normalize('NFC').trim();
  if (!word) {
    return {
      word: '',
      syllables: [],
      aksharaCount: 0,
      matraList: [],
      totalMatras: 0,
      pattern: '',
      dviteeyaksharam: null,
      rhymeEnding: null
    };
  }

  const segmenter = new Intl.Segmenter('ml', { granularity: 'grapheme' });
  const rawClusters = [...segmenter.segment(word)].map(s => s.segment);

  // Group raw grapheme clusters into prosodic syllables (Aksharas)
  // Isolated chillus attach to the preceding syllable
  const syllables: string[] = [];
  for (let i = 0; i < rawClusters.length; i++) {
    const cluster = rawClusters[i];
    if (isChillu(cluster) && syllables.length > 0) {
      syllables[syllables.length - 1] += cluster;
    } else {
      syllables.push(cluster);
    }
  }

  // Calculate Laghu (1) vs Guru (2) for each syllable
  const matraList: number[] = [];
  for (let i = 0; i < syllables.length; i++) {
    const syl = syllables[i];
    let isGuru = false;

    // 1. Long vowel, long vowel sign, anusvara, visarga, or chillu
    for (const char of syl) {
      if (
        LONG_VOWELS.has(char) ||
        LONG_VOWEL_SIGNS.has(char) ||
        ANUSVARA_VISARGA.has(char) ||
        CHILLU_CHARS.has(char)
      ) {
        isGuru = true;
        break;
      }
    }

    // 2. A short syllable becomes Guru when followed by a conjunct or virama in the next syllable
    if (!isGuru && i + 1 < syllables.length) {
      const nextSyl = syllables[i + 1];
      if (isConjunct(nextSyl) || nextSyl.startsWith(VIRAMA)) {
        isGuru = true;
      }
    }

    // 3. Word-ending geminate or virama (e.g. half-u in മനസ്സ്, പാട്ട്)
    if (!isGuru && syl.endsWith(VIRAMA)) {
      isGuru = true;
    }

    matraList.push(isGuru ? 2 : 1);
  }

  const totalAksharas = syllables.length;
  const totalMatras = matraList.reduce((a, b) => a + b, 0);
  const pattern = matraList.map(m => (m === 2 ? 'ഗു' : 'ല')).join('-');

  const dviteeyaksharam = syllables.length >= 2 ? syllables[1] : null;
  const rhymeEnding = syllables.length > 0 ? syllables[syllables.length - 1] : null;

  return {
    word,
    syllables,
    aksharaCount: totalAksharas,
    matraList,
    totalMatras,
    pattern,
    dviteeyaksharam,
    rhymeEnding
  };
}

/**
 * Calculates total aksharas and matras for an entire line of Malayalam lyrics.
 * Strips section tags ([...]) -> returns 0
 * Strips backup prefix (>) -> counts remainder
 * Strips non-Malayalam punctuation
 */
export function countLineMalayalamMeter(line: string): LineMeterProfile {
  let cleanLine = line.trim();
  if (!cleanLine) {
    return { line, aksharas: 0, matras: 0, wordCount: 0 };
  }

  // Skip section tags (e.g. [പല്ലവി], [ചരണം], [Chorus])
  if (cleanLine.startsWith('[')) {
    return { line, aksharas: 0, matras: 0, wordCount: 0 };
  }

  // Strip backup line prefix
  if (cleanLine.startsWith('>')) {
    cleanLine = cleanLine.substring(1).trim();
  }

  // Extract Malayalam words
  const words = cleanLine
    .replace(/[-–—/\\_]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^[^\u0D00-\u0D7F]+|[^\u0D00-\u0D7F]+$/g, ''))
    .filter(w => isMalayalam(w));

  let totalAksharas = 0;
  let totalMatras = 0;

  for (const word of words) {
    const profile = analyzeMalayalamWord(word);
    totalAksharas += profile.aksharaCount;
    totalMatras += profile.totalMatras;
  }

  return {
    line,
    aksharas: totalAksharas,
    matras: totalMatras,
    wordCount: words.length
  };
}

let cachedThesaurus: Record<string, any> | null = null;
let cachedCoreDict: any[] | null = null;

export async function loadMalayalamDictionaryData() {
  if (cachedThesaurus && cachedCoreDict) return { thesaurus: cachedThesaurus, coreDict: cachedCoreDict };
  try {
    const [tRes, dRes] = await Promise.all([
      fetch('/malayalam/song_thesaurus.json'),
      fetch('/malayalam/malayalam_core_dictionary.json')
    ]);
    if (tRes.ok) cachedThesaurus = await tRes.json();
    if (dRes.ok) cachedCoreDict = await dRes.json();
  } catch (err) {
    console.warn('Failed to load Malayalam dictionary data:', err);
  }
  return { thesaurus: cachedThesaurus || {}, coreDict: cachedCoreDict || [] };
}

export function getMalayalamWordSuggestions(query: string): { word: string; detail: string }[] {
  const list: { word: string; detail: string }[] = [];
  const q = query.trim();
  if (!q) return list;

  if (cachedThesaurus && cachedThesaurus[q]) {
    for (const s of cachedThesaurus[q].syns.slice(0, 5)) {
      list.push({ word: s.w, detail: `${s.a} അക്ഷരം | ${s.m} മാത്ര (${s.f} songs)` });
    }
  }

  if (cachedCoreDict) {
    const prefix = cachedCoreDict.filter((d: any) => d.w.startsWith(q) && d.w !== q).slice(0, 6);
    for (const p of prefix) {
      if (!list.some(x => x.word === p.w)) {
        list.push({ word: p.w, detail: `${p.a} അക്ഷരം | ${p.f} songs` });
      }
    }
  }

  return list.slice(0, 8);
}
