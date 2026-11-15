import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data/malayalam');
const LYRICS_DIR = path.join(DATA_DIR, 'lyrics');
const OUTPUT_FILE = path.join(DATA_DIR, 'unique_words.json');
const OUTPUT_SUMMARY_FILE = path.join(DATA_DIR, 'word_frequencies.json');

// Malayalam Unicode Range: \u0D00-\u0D7F, plus ZWJ (\u200D) and ZWNJ (\u200C)
const MALAYALAM_WORD_REGEX = /[\u0D00-\u0D7F\u200C\u200D]+/g;

function cleanWord(rawWord) {
  // Normalize Unicode to NFC
  let word = rawWord.normalize('NFC').trim();

  // Normalize legacy Chillu characters typed with ZWJ
  word = word
    .replace(/ണ\u0D4D\u200D/g, 'ൺ')
    .replace(/ന\u0D4D\u200D/g, 'ൻ')
    .replace(/ര\u0D4D\u200D/g, 'ർ')
    .replace(/ല\u0D4D\u200D/g, 'ൽ')
    .replace(/ള\u0D4D\u200D/g, 'ൾ');

  // Normalize word-ending chillu equivalents (e.g. ഞാന് -> ഞാൻ, നിന് -> നിൻ)
  word = word
    .replace(/ണ്$/, 'ൺ')
    .replace(/ന്$/, 'ൻ')
    .replace(/ര്$/, 'ർ')
    .replace(/ല്$/, 'ൽ')
    .replace(/ള്$/, 'ൾ');

  // Strip leading/trailing virama or combining marks that cannot start/end a word properly
  word = word.replace(/^[\u0D3E-\u0D4D\u0D57\u0D62\u0D63\u200C\u200D]+/, '');
  word = word.replace(/[\u200C\u200D]+$/, '');

  // Remove standalone punctuation or single combining marks
  if (!word || word.length < 2) return null;

  // Filter out any purely non-Malayalam content
  if (!/[\u0D05-\u0D3A\u0D7A-\u0D7F]/.test(word)) return null;

  return word;
}

function tokenizeLyrics(text) {
  if (!text) return [];

  // Replace dashes, hyphens, and slashes with space
  const normalized = text.replace(/[-–—/\\_]/g, ' ');

  // Extract Malayalam word tokens
  const rawTokens = normalized.match(MALAYALAM_WORD_REGEX) || [];
  const validTokens = [];

  for (const token of rawTokens) {
    const cleaned = cleanWord(token);
    if (cleaned) {
      validTokens.push(cleaned);
    }
  }

  return validTokens;
}

async function run() {
  console.log('[Word Extractor] Reading lyric files from:', LYRICS_DIR);
  const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.json'));
  console.log(`[Word Extractor] Found ${files.length} song files.`);

  const wordMap = new Map(); // word -> { totalCount, songCount, songSlugs: Set }
  let totalTokens = 0;
  let processedSongs = 0;

  for (const file of files) {
    const filePath = path.join(LYRICS_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const songData = JSON.parse(content);
      const lyrics = songData.lyrics || '';
      const slug = songData.slug || file.replace('.json', '');

      const tokens = tokenizeLyrics(lyrics);
      const uniqueInSong = new Set(tokens);

      for (const token of tokens) {
        totalTokens++;
        let entry = wordMap.get(token);
        if (!entry) {
          entry = { totalCount: 0, songCount: 0, sampleSongs: [] };
          wordMap.set(token, entry);
        }
        entry.totalCount++;
      }

      for (const uniqueToken of uniqueInSong) {
        const entry = wordMap.get(uniqueToken);
        if (entry) {
          entry.songCount++;
          if (entry.sampleSongs.length < 3) {
            entry.sampleSongs.push(slug);
          }
        }
      }

      processedSongs++;
      if (processedSongs % 1000 === 0) {
        console.log(`[Word Extractor] Processed ${processedSongs}/${files.length} songs... (${wordMap.size} unique words so far)`);
      }
    } catch (err) {
      console.warn(`[Warning] Could not process ${file}: ${err.message}`);
    }
  }

  console.log(`[Word Extractor] Sorting ${wordMap.size} unique words by frequency...`);

  const sortedWords = Array.from(wordMap.entries())
    .map(([word, stats]) => ({
      word,
      totalCount: stats.totalCount,
      songCount: stats.songCount,
      sampleSongs: stats.sampleSongs
    }))
    .sort((a, b) => b.totalCount - a.totalCount);

  // Write full dictionary
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sortedWords, null, 2), 'utf8');

  // Also write a compact frequency map for ultra-fast lookup (word -> totalCount)
  const compactFreq = {};
  for (const item of sortedWords) {
    compactFreq[item.word] = item.totalCount;
  }
  fs.writeFileSync(OUTPUT_SUMMARY_FILE, JSON.stringify(compactFreq), 'utf8');

  console.log('\n=========================================');
  console.log(`Songs Processed:     ${processedSongs}`);
  console.log(`Total Word Tokens:   ${totalTokens.toLocaleString()}`);
  console.log(`Unique Malayalam Words: ${sortedWords.length.toLocaleString()}`);
  console.log(`Output Saved:        ${OUTPUT_FILE}`);
  console.log('=========================================\n');

  console.log('--- Top 30 Most Frequent Words in Modern Malayalam Songs (2000-2026) ---');
  for (let i = 0; i < Math.min(30, sortedWords.length); i++) {
    const item = sortedWords[i];
    console.log(`${(i + 1).toString().padStart(2)}. ${item.word.padEnd(16)} (used ${item.totalCount.toString().padStart(5)} times across ${item.songCount} songs)`);
  }
}

run().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
