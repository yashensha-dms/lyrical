import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data/malayalam');
const INPUT_WORDS = path.join(DATA_DIR, 'unique_words.json');
const OUTPUT_DICT = path.join(DATA_DIR, 'malayalam_prosody_dictionary.json');
const OUTPUT_COMPACT = path.join(DATA_DIR, 'malayalam_meter_lookup.json');

const SHORT_VOWELS = new Set(['അ', 'ഇ', 'ഉ', 'ഋ', 'എ', 'ഒ']);
const LONG_VOWELS = new Set(['ആ', 'ഈ', 'ഊ', 'ഏ', 'ഐ', 'ഓ', 'ഔ']);
const SHORT_VOWEL_SIGNS = new Set(['\u0D3F', '\u0D41', '\u0D43', '\u0D46', '\u0D4A']);
const LONG_VOWEL_SIGNS = new Set(['\u0D3E', '\u0D40', '\u0D42', '\u0D47', '\u0D48', '\u0D4B', '\u0D4C', '\u0D57']);
const CHILLU_CHARS = new Set(['\u0D7A', '\u0D7B', '\u0D7C', '\u0D7D', '\u0D7E', '\u0D7F']);
const ANUSVARA_VISARGA = new Set(['\u0D02', '\u0D03']);
const VIRAMA = '\u0D4D';

function isChillu(cluster) {
  return cluster.length === 1 && CHILLU_CHARS.has(cluster);
}

function isConjunct(cluster) {
  return cluster.includes(VIRAMA) && !cluster.endsWith(VIRAMA);
}

function analyzeMalayalamWord(word) {
  const segmenter = new Intl.Segmenter('ml', { granularity: 'grapheme' });
  const rawClusters = [...segmenter.segment(word)].map(s => s.segment);

  const syllables = [];
  for (let i = 0; i < rawClusters.length; i++) {
    const cluster = rawClusters[i];
    if (isChillu(cluster) && syllables.length > 0) {
      syllables[syllables.length - 1] += cluster;
    } else {
      syllables.push(cluster);
    }
  }

  const matraList = [];
  for (let i = 0; i < syllables.length; i++) {
    const syl = syllables[i];
    let isGuru = false;

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

    if (!isGuru && i + 1 < syllables.length) {
      const nextSyl = syllables[i + 1];
      if (isConjunct(nextSyl) || nextSyl.startsWith(VIRAMA)) {
        isGuru = true;
      }
    }

    if (!isGuru && syl.endsWith(VIRAMA)) {
      isGuru = true;
    }

    matraList.push(isGuru ? 2 : 1);
  }

  return {
    word,
    aksharas: syllables.length,
    matras: matraList.reduce((a, b) => a + b, 0),
    pattern: matraList.map(m => (m === 2 ? 'ഗു' : 'ല')).join('-'),
    dviteeyaksharam: syllables.length >= 2 ? syllables[1] : null,
    rhymeEnding: syllables.length > 0 ? syllables[syllables.length - 1] : null
  };
}

async function run() {
  console.log('[Prosody Indexer] Reading unique words from:', INPUT_WORDS);
  const words = JSON.parse(fs.readFileSync(INPUT_WORDS, 'utf8'));
  console.log(`[Prosody Indexer] Total words in corpus: ${words.length}`);

  // We filter words: words with totalCount >= 2 for the active songwriting dictionary
  const activeWords = words.filter(w => w.totalCount >= 2 && w.word.length >= 2);
  console.log(`[Prosody Indexer] Active lyrical vocabulary (freq >= 2): ${activeWords.length} words.`);

  const fullDictionary = [];
  const aksharaIndex = {}; // aksharaCount -> [word]
  const matraIndex = {};   // matraCount -> [word]
  const dviteeyamIndex = {}; // dviteeyaksharam -> [word]
  const rhymeIndex = {};     // rhymeEnding -> [word]

  for (let i = 0; i < activeWords.length; i++) {
    const item = activeWords[i];
    const prosody = analyzeMalayalamWord(item.word);

    const record = {
      w: item.word,
      f: item.totalCount,
      s: item.songCount,
      a: prosody.aksharas,
      m: prosody.matras,
      p: prosody.pattern,
      d: prosody.dviteeyaksharam,
      r: prosody.rhymeEnding
    };

    fullDictionary.push(record);

    // Populate indexes (keeping top 200 per category to keep index compact and high quality)
    if (!aksharaIndex[record.a]) aksharaIndex[record.a] = [];
    aksharaIndex[record.a].push(record.w);

    if (!matraIndex[record.m]) matraIndex[record.m] = [];
    matraIndex[record.m].push(record.w);

    if (record.d) {
      if (!dviteeyamIndex[record.d]) dviteeyamIndex[record.d] = [];
      dviteeyamIndex[record.d].push(record.w);
    }

    if (record.r) {
      if (!rhymeIndex[record.r]) rhymeIndex[record.r] = [];
      rhymeIndex[record.r].push(record.w);
    }
  }

  // Save full prosody dictionary
  fs.writeFileSync(OUTPUT_DICT, JSON.stringify(fullDictionary), 'utf8');

  // Save compact lookup bundle
  const lookupBundle = {
    version: '1.0.0',
    totalWords: fullDictionary.length,
    aksharaBuckets: Object.keys(aksharaIndex).map(k => ({ count: parseInt(k, 10), total: aksharaIndex[k].length })),
    matraBuckets: Object.keys(matraIndex).map(k => ({ count: parseInt(k, 10), total: matraIndex[k].length }))
  };
  fs.writeFileSync(OUTPUT_COMPACT, JSON.stringify(lookupBundle, null, 2), 'utf8');

  console.log('\n=========================================');
  console.log(`Prosody Dictionary Saved: ${OUTPUT_DICT}`);
  console.log(`Total Indexed Words:      ${fullDictionary.length}`);
  console.log('Akshara Buckets (Syllable counts):');
  for (const b of lookupBundle.aksharaBuckets.sort((a, b) => a.count - b.count)) {
    console.log(`  ${b.count} syllables: ${b.total} words`);
  }
  console.log('=========================================\n');
}

run().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
