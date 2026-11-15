import fs from 'fs';
import readline from 'readline';
import path from 'path';

const DATA_DIR = path.resolve('data/malayalam');
const OLAM_FILE = path.join(DATA_DIR, 'olam-enml.csv');
const SONG_WORDS_FILE = path.join(DATA_DIR, 'malayalam_prosody_dictionary.json');

function normalizeWord(raw) {
  if (!raw) return '';
  return raw
    .normalize('NFC')
    .replace(/[0-9]/g, '')
    .replace(/ണ\u0D4D\u200D/g, 'ൺ')
    .replace(/ന\u0D4D\u200D/g, 'ൻ')
    .replace(/ര\u0D4D\u200D/g, 'ർ')
    .replace(/ല\u0D4D\u200D/g, 'ൽ')
    .replace(/ള\u0D4D\u200D/g, 'ൾ')
    .replace(/ണ്$/, 'ൺ')
    .replace(/ന്$/, 'ൻ')
    .replace(/ര്$/, 'ർ')
    .replace(/ല്$/, 'ൽ')
    .replace(/ള്$/, 'ൾ')
    .trim();
}

async function testOlam() {
  console.log('[Olam Synset Test] Loading song dictionary...');
  const songWordsList = JSON.parse(fs.readFileSync(SONG_WORDS_FILE, 'utf8'));
  const songWordsMap = new Map();
  for (const item of songWordsList) {
    songWordsMap.set(item.w, item);
  }

  console.log('[Olam Synset Test] Parsing Olam CSV by concept...');
  const fileStream = fs.createReadStream(OLAM_FILE);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  // Map: concept (english_word + pos) -> Set of clean Malayalam single words
  const conceptToMalayalam = new Map();
  // Map: malayalam word -> Set of concepts
  const malToConcepts = new Map();

  for await (const line of rl) {
    if (line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 4) continue;

    const enWord = parts[1].toLowerCase().trim();
    const pos = parts[2].trim();
    const malDef = parts[3].trim();

    // Skip overly long or idiomatic English phrases to avoid loose associations
    if (enWord.includes(' ') && enWord.split(' ').length > 2) continue;

    // Split Malayalam definition if it has multiple words separated by comma or semicolon
    const rawMalTokens = malDef
      .replace(/[,;]/g, ' ')
      .split(/\s+/)
      .map(w => normalizeWord(w))
      .filter(w => w.length >= 2 && /^[\u0D00-\u0D7F]+$/.test(w));

    // Only keep individual standalone words
    for (const mal of rawMalTokens) {
      const conceptKey = `${enWord}::${pos}`;
      if (!conceptToMalayalam.has(conceptKey)) {
        conceptToMalayalam.set(conceptKey, new Set());
      }
      conceptToMalayalam.get(conceptKey).add(mal);

      if (!malToConcepts.has(mal)) {
        malToConcepts.set(mal, new Set());
      }
      malToConcepts.get(mal).add(conceptKey);
    }
  }

  console.log(`[Olam Synset Test] Indexed ${conceptToMalayalam.size} concept synsets across ${malToConcepts.size} Malayalam words.`);

  // Given a Malayalam word: find all synonyms that share exact concepts
  function getSynonyms(queryWord) {
    const norm = normalizeWord(queryWord);
    const concepts = malToConcepts.get(norm);
    if (!concepts) return [];

    const candidates = new Map(); // candidate -> shared concept count
    for (const conceptKey of concepts) {
      // Don't use super-broad concepts that have > 20 words (avoids semantic drift)
      const synsInConcept = conceptToMalayalam.get(conceptKey);
      if (!synsInConcept || synsInConcept.size > 20 || synsInConcept.size < 2) continue;

      for (const candidate of synsInConcept) {
        if (candidate === norm) continue;
        candidates.set(candidate, (candidates.get(candidate) || 0) + 1);
      }
    }

    // Filter to words in song vocabulary
    const verified = [];
    for (const [cand, sharedCount] of candidates.entries()) {
      if (songWordsMap.has(cand)) {
        const item = songWordsMap.get(cand);
        verified.push({
          ...item,
          sharedCount
        });
      }
    }

    // Sort by shared concept count first (precision!), then by song frequency
    verified.sort((a, b) => b.sharedCount - a.sharedCount || b.f - a.f);
    return verified;
  }

  const testQueries = ['മഴ', 'സ്നേഹം', 'സൂര്യൻ', 'മനസ്സ്', 'കാറ്റ്', 'രാത്രി', 'കടൽ', 'കണ്ണ്'];
  for (const q of testQueries) {
    const results = getSynonyms(q);
    console.log(`\n=== QUERY: ${q} ===`);
    console.log(`Verified synonyms found: ${results.length}`);
    for (const item of results.slice(0, 8)) {
      console.log(`  - ${item.w} (shared concepts: ${item.sharedCount}, freq in songs: ${item.f}, ${item.a} syl, ${item.m} matras)`);
    }
  }
}

testOlam().catch(console.error);
