import fs from 'fs';
import readline from 'readline';
import path from 'path';

const DATA_DIR = path.resolve('data/malayalam');
const DATUK_FILE = path.join(DATA_DIR, 'datuk.yaml');
const SONG_WORDS_FILE = path.join(DATA_DIR, 'malayalam_prosody_dictionary.json');
const OUTPUT_THESAURUS = path.join(DATA_DIR, 'song_thesaurus.json');
const OUTPUT_DEFINITIONS = path.join(DATA_DIR, 'malayalam_definitions.json');

const SUFFIXES = [
  'ത്തിൽ', 'ത്തിന്റെ', 'ത്താൽ', 'ത്തിന്', 'ത്തെ',
  'യിലെ', 'യിൽ', 'യുടെ', 'യാൽ', 'യ്ക്ക്',
  'ിലെ', 'ിൽ', 'ിന്റെ', 'ിനാൽ',
  'കൾക്ക്', 'കളുടെ', 'കളാൽ', 'കളെ', 'കൾ',
  'ഓടെ', 'ആയി', 'മായി'
];

function stemMalayalam(word) {
  let w = word.normalize('NFC').trim();
  for (const s of SUFFIXES) {
    if (w.length > s.length + 2 && w.endsWith(s)) {
      let stem = w.slice(0, -s.length);
      // If ends with virama-consonant stem, restore common vowel ending
      if (stem.endsWith('യ')) stem = stem.slice(0, -1);
      return stem;
    }
  }
  return w;
}

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

async function buildThesaurus() {
  console.log('[Thesaurus] Reading song prosody dictionary...');
  const songWordsList = JSON.parse(fs.readFileSync(SONG_WORDS_FILE, 'utf8'));
  const songWordsMap = new Map();
  for (const item of songWordsList) {
    songWordsMap.set(item.w, item);
  }
  console.log(`[Thesaurus] Loaded ${songWordsMap.size} song words.`);

  console.log('[Thesaurus] Parsing Datuk dictionary stream...');
  const fileStream = fs.createReadStream(DATUK_FILE);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const wordDefinitions = new Map(); // word -> string[]
  const synonymMap = new Map(); // word -> Set<synonym>

  let currentEntry = null;
  let currentDefs = [];

  for await (const line of rl) {
    if (line.startsWith('- id:')) {
      if (currentEntry && currentDefs.length > 0) {
        const normEntry = normalizeWord(currentEntry);
        if (normEntry) {
          if (!wordDefinitions.has(normEntry)) wordDefinitions.set(normEntry, []);
          wordDefinitions.get(normEntry).push(...currentDefs);

          // Extract synonyms and related concepts
          for (const def of currentDefs) {
            const parts = def
              .replace(/['"().;:]/g, ',')
              .split(',')
              .map(p => normalizeWord(p.trim()))
              .filter(p => p.length >= 2 && /[\u0D00-\u0D7F]/.test(p));

            for (const p of parts) {
              if (p !== normEntry) {
                if (!synonymMap.has(normEntry)) synonymMap.set(normEntry, new Set());
                synonymMap.get(normEntry).add(p);

                if (!synonymMap.has(p)) synonymMap.set(p, new Set());
                synonymMap.get(p).add(normEntry);
              }
            }
          }
        }
      }
      currentEntry = null;
      currentDefs = [];
    } else {
      const entryMatch = line.match(/^\s{2}entry:\s*(.*)/);
      const defMatch = line.match(/^\s*-\s*entry:\s*(.*)/);
      if (entryMatch) {
        currentEntry = entryMatch[1].replace(/^['"]|['"]$/g, '').trim();
      } else if (defMatch) {
        const defText = defMatch[1].replace(/^['"]|['"]$/g, '').trim();
        if (defText) currentDefs.push(defText);
      }
    }
  }

  console.log(`[Thesaurus] Extracted definitions for ${wordDefinitions.size} headwords.`);
  console.log(`[Thesaurus] Built connections for ${synonymMap.size} terms.`);

  // Build the song thesaurus bundle
  // For all song words (focused on core words with frequency >= 3):
  const songThesaurus = {};
  const activeSongWords = songWordsList.filter(item => item.f >= 3);
  console.log(`[Thesaurus] Linking thesaurus for ${activeSongWords.length} active song words (freq >= 3)...`);

  for (const item of activeSongWords) {
    const word = item.w;
    const stem = stemMalayalam(word);

    // Collect synonyms from exact word and stem
    const synSet = new Set(synonymMap.get(word) || []);
    if (stem !== word && synonymMap.has(stem)) {
      for (const s of synonymMap.get(stem)) {
        synSet.add(s);
      }
    }

    // Filter to words that appear in songs, exclude self
    const songSynonyms = [];
    for (const s of synSet) {
      if (s !== word && songWordsMap.has(s)) {
        const synItem = songWordsMap.get(s);
        songSynonyms.push({
          w: synItem.w,
          f: synItem.f,
          a: synItem.a,
          m: synItem.m,
          p: synItem.p
        });
      }
    }

    // Sort by song frequency descending
    songSynonyms.sort((a, b) => b.f - a.f);

    // Definitions
    const defs = wordDefinitions.get(word) || wordDefinitions.get(stem) || [];

    if (songSynonyms.length > 0 || defs.length > 0) {
      songThesaurus[word] = {
        defs: defs.slice(0, 3),
        syns: songSynonyms.slice(0, 40) // top 40 song-proven alternatives
      };
    }
  }

  console.log(`[Thesaurus] Linked ${Object.keys(songThesaurus).length} song words with verified alternatives.`);

  // Save compact thesaurus
  fs.writeFileSync(OUTPUT_THESAURUS, JSON.stringify(songThesaurus), 'utf8');
  console.log(`[Thesaurus] Saved to ${OUTPUT_THESAURUS}`);

  // Also save a small lookup sample
  console.log('\n--- Sample Lookups from song_thesaurus.json ---');
  for (const sample of ['സൂര്യൻ', 'മഴ', 'മനസ്സ്', 'രാവ്', 'കാറ്റ്', 'സ്നേഹം']) {
    const entry = songThesaurus[sample];
    if (entry) {
      console.log(`Word: ${sample} | Defs: ${entry.defs.length} | Song Synonyms: ${entry.syns.length}`);
      console.log('  Top 5:', entry.syns.slice(0, 5).map(s => `${s.w} (${s.a} syl, ${s.m} matras)`).join(', '));
    }
  }
}

buildThesaurus().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
