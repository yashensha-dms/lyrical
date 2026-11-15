import {
  cleanPhoneme,
  phonemeDistance,
  extractRhymeEnding,
  parseQueryPhonemes,
  countSyllablesInPhonemes,
  VOWELS,
  STOPWORDS
} from './phonetics';

export interface Env {
  songwriting_rhymes_db: D1Database;
  AI?: any;
}

// Module-level in-memory cache for edge performance
let cachedWordEndings: { raw: string; tokens: string[] }[] | null = null;
let cachedProfiles: { word: string; phonemes: string[]; vowels: string[]; syllables: number; frequency: number }[] | null = null;

async function getCachedWordEndings(db: D1Database) {
  if (cachedWordEndings) return cachedWordEndings;
  const { results } = await db.prepare("SELECT DISTINCT rhyme_ending FROM words WHERE rhyme_ending != ''").all();
  cachedWordEndings = (results as any[]).map(r => ({
    raw: r.rhyme_ending,
    tokens: r.rhyme_ending.split(' ')
  }));
  return cachedWordEndings;
}

async function getCachedProfiles(db: D1Database) {
  if (cachedProfiles) return cachedProfiles;
  // Load top words by frequency for fast phonetic swap
  const { results } = await db.prepare("SELECT word, phonemes, frequency FROM words ORDER BY frequency DESC LIMIT 10000").all();
  cachedProfiles = (results as any[]).map(r => {
    const phones = (r.phonemes || '').split(' ');
    const vowels = phones.map(cleanPhoneme).filter(p => VOWELS.has(p));
    return {
      word: r.word,
      phonemes: phones,
      vowels,
      syllables: vowels.length,
      frequency: r.frequency || 0
    };
  });
  return cachedProfiles;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const db = env.songwriting_rhymes_db;

    try {
      // ── GET /rhyme ──────────────────────────────────────────────────────────
      if (url.pathname === '/rhyme') {
        const wordParam = (url.searchParams.get('word') || '').toLowerCase().trim();
        if (!wordParam) {
          return new Response(JSON.stringify({ word: '', perfect: [], slant: [], perfect_bigrams: [], slant_bigrams: [] }), { headers: corsHeaders });
        }

        // 1. Look up word phonemes and rhyme ending
        let wordRecord: any = await db.prepare("SELECT phonemes, rhyme_ending FROM words WHERE word = ?").bind(wordParam).first();
        let phonemes = wordRecord?.phonemes || '';
        let rhymeEnding = wordRecord?.rhyme_ending || '';

        if (!rhymeEnding) {
          phonemes = parseQueryPhonemes(wordParam);
          rhymeEnding = extractRhymeEnding(phonemes);
        }

        if (!rhymeEnding) {
          return new Response(JSON.stringify({ word: wordParam, perfect: [], slant: [], perfect_bigrams: [], slant_bigrams: [] }), { headers: corsHeaders });
        }

        // 2. Perfect word rhymes
        const { results: perfectWordRows } = await db.prepare(
          "SELECT word FROM words WHERE rhyme_ending = ? AND word != ? ORDER BY frequency DESC LIMIT 30"
        ).bind(rhymeEnding, wordParam).all();
        const perfectWords = (perfectWordRows as any[]).map(r => r.word);

        // 3. Perfect bigram rhymes
        const { results: perfectBigramRows } = await db.prepare(
          "SELECT bigram FROM bigrams WHERE rhyme_ending = ? ORDER BY frequency DESC LIMIT 60"
        ).bind(rhymeEnding).all();
        const perfectBigrams: string[] = [];
        for (const r of perfectBigramRows as any[]) {
          const parts = r.bigram.split(' ');
          if (!parts.includes(wordParam)) {
            perfectBigrams.push(r.bigram);
          }
          if (perfectBigrams.length >= 30) break;
        }

        // 4. Slant word rhymes using phonetic distance
        const sourceTokens = rhymeEnding.split(' ');
        const lenSource = sourceTokens.length;
        const allEndings = await getCachedWordEndings(db);

        const slantEndings = allEndings
          .filter(e => Math.abs(lenSource - e.tokens.length) < 1.3 && phonemeDistance(sourceTokens, e.tokens) < 1.3 && e.raw !== rhymeEnding)
          .slice(0, 15)
          .map(e => e.raw);

        let slantWords: string[] = [];
        if (slantEndings.length > 0) {
          const placeholders = slantEndings.map(() => '?').join(',');
          const query = `SELECT word FROM words WHERE rhyme_ending IN (${placeholders}) AND word != ? ORDER BY frequency DESC LIMIT 100`;
          const { results: slantRows } = await db.prepare(query).bind(...slantEndings, wordParam).all();
          slantWords = (slantRows as any[])
            .map(r => r.word)
            .filter(w => w.length >= 3 && !STOPWORDS.has(w))
            .slice(0, 30);
        }

        // 5. Slant bigram rhymes
        let slantBigrams: string[] = [];
        if (slantEndings.length > 0) {
          const placeholders = slantEndings.slice(0, 8).map(() => '?').join(',');
          const query = `SELECT bigram FROM bigrams WHERE rhyme_ending IN (${placeholders}) ORDER BY frequency DESC LIMIT 100`;
          const { results: slantBgRows } = await db.prepare(query).bind(...slantEndings.slice(0, 8)).all();
          for (const r of slantBgRows as any[]) {
            const parts = r.bigram.split(' ');
            if (parts.length === 2 && !parts.includes(wordParam)) {
              if (parts[0].length >= 3 && !STOPWORDS.has(parts[0]) && parts[1].length >= 3 && !STOPWORDS.has(parts[1])) {
                slantBigrams.push(r.bigram);
              }
            }
            if (slantBigrams.length >= 30) break;
          }
        }

        return new Response(JSON.stringify({
          word: wordParam,
          perfect: perfectWords,
          slant: slantWords,
          perfect_bigrams: perfectBigrams,
          slant_bigrams: slantBigrams
        }), { headers: corsHeaders });
      }

      // ── GET /rhyme-density ──────────────────────────────────────────────────
      if (url.pathname === '/rhyme-density') {
        const line = url.searchParams.get('line') || '';
        const rawWords = (line.toLowerCase().match(/[a-zA-Z']+/g) || []).map(w => w.replace(/^'+|'+$/g, '')).filter(Boolean);

        if (rawWords.length === 0) {
          return new Response(JSON.stringify({
            line,
            density: 0.0,
            rhyming_syllables: 0,
            total_syllables: 0,
            status: 'under-rhymed',
            message: 'your line sits at 0.0 — under-rhymed (0.22–0.44)'
          }), { headers: corsHeaders });
        }

        // Look up all words in batch
        const placeholders = rawWords.map(() => '?').join(',');
        const { results: wordData } = await db.prepare(`SELECT word, phonemes, rhyme_ending FROM words WHERE word IN (${placeholders})`).bind(...rawWords).all();
        const wordMap = new Map((wordData as any[]).map(r => [r.word, r]));

        const wordsInfo: { word: string; syllables: number; rhymeEnding: string | null }[] = [];
        for (const w of rawWords) {
          const row = wordMap.get(w);
          if (row && row.phonemes) {
            const syl = Math.max(1, countSyllablesInPhonemes(row.phonemes));
            wordsInfo.push({ word: w, syllables: syl, rhymeEnding: row.rhyme_ending || null });
          } else {
            // Heuristic syllable fallback
            const count = Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length - (w.endsWith('e') && !w.endsWith('le') ? 1 : 0));
            wordsInfo.push({ word: w, syllables: count, rhymeEnding: null });
          }
        }

        const totalSyllables = wordsInfo.reduce((acc, curr) => acc + curr.syllables, 0);
        const rhymeGroups: Record<string, typeof wordsInfo> = {};
        for (const w of wordsInfo) {
          if (w.rhymeEnding && /[12]/.test(w.rhymeEnding)) {
            if (!rhymeGroups[w.rhymeEnding]) rhymeGroups[w.rhymeEnding] = [];
            rhymeGroups[w.rhymeEnding].push(w);
          }
        }

        const rhymingWords = new Set<typeof wordsInfo[0]>();
        for (const group of Object.values(rhymeGroups)) {
          if (group.length >= 2) {
            group.forEach(w => rhymingWords.add(w));
          }
        }

        const rhymingSyllables = Array.from(rhymingWords).reduce((acc, curr) => acc + curr.syllables, 0);
        const density = totalSyllables > 0 ? rhymingSyllables / totalSyllables : 0.0;
        const rounded = Math.round(density * 100) / 100;

        let status = 'within the sweet spot';
        if (rounded < 0.22) status = 'under-rhymed';
        else if (rounded > 0.44) status = 'over-rhymed';

        return new Response(JSON.stringify({
          line,
          density: rounded,
          rhyming_syllables: rhymingSyllables,
          total_syllables: totalSyllables,
          status,
          message: `your line sits at ${rounded.toFixed(2)} — ${status} (0.22–0.44)`
        }), { headers: corsHeaders });
      }

      // ── GET /phonetic-swap & /synonyms ──────────────────────────────────────
      if (url.pathname === '/phonetic-swap' || url.pathname === '/synonyms') {
        const wordParam = (url.searchParams.get('word') || '').trim();
        if (!wordParam) {
          return new Response(JSON.stringify({ word: '', phonemes: '', results: [] }), { headers: corsHeaders });
        }

        const queryPhonesStr = parseQueryPhonemes(wordParam);
        const queryPhones = queryPhonesStr.split(' ').filter(Boolean);
        const queryVowels = queryPhones.map(cleanPhoneme).filter(p => VOWELS.has(p));
        const querySyllables = queryVowels.length;

        const profiles = await getCachedProfiles(db);
        const scoredCandidates: { word: string; score: number }[] = [];

        for (const p of profiles) {
          if (Math.abs(p.syllables - querySyllables) > 1) continue;
          const dist = phonemeDistance(queryPhones, p.phonemes);
          const vowelBoost = p.vowels.join(' ') === queryVowels.join(' ') ? 1.5 : 0.0;
          const freqFactor = Math.log10(p.frequency + 1) * 0.2;
          const score = dist - vowelBoost - freqFactor;
          scoredCandidates.push({ word: p.word, score });
        }

        scoredCandidates.sort((a, b) => a.score - b.score);
        const topResults = scoredCandidates.slice(0, 30).map(s => s.word);

        return new Response(JSON.stringify({
          word: wordParam,
          phonemes: queryPhonesStr,
          results: topResults
        }), { headers: corsHeaders });
      }

      // ── POST /semantic-search ───────────────────────────────────────────────
      if (url.pathname === '/semantic-search' && request.method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const query = body.query;
        const documents: string[] = body.documents || [];

        if (!query || documents.length === 0 || !env.AI) {
          return new Response(JSON.stringify({ query, results: documents.map(d => ({ document: d, score: 0.0 })) }), { headers: corsHeaders });
        }

        // Run embeddings through Cloudflare Workers AI
        const allTexts = [query, ...documents];
        const embeddingsResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: allTexts });
        const embeddings = embeddingsResponse.data;
        const queryVec: number[] = embeddings[0];

        function cosineSim(a: number[], b: number[]): number {
          let dot = 0;
          let normA = 0;
          let normB = 0;
          for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
          }
          return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
        }

        const scored = documents.map((doc, idx) => ({
          document: doc,
          score: cosineSim(queryVec, embeddings[idx + 1])
        }));
        scored.sort((a, b) => b.score - a.score);

        return new Response(JSON.stringify({ query, results: scored }), { headers: corsHeaders });
      }

      // Default health check for recommender
      return new Response(JSON.stringify({ status: 'ok', service: 'songwriting-recommender' }), { headers: corsHeaders });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
