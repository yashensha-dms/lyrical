// Phonetic and phoneme distance algorithms for Songwriting Rhyme Engine

export const VOWELS = new Set([
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW', 'AX'
]);

export const VOWEL_GROUPS: Set<string>[] = [
  new Set(['AH', 'AX', 'EH', 'IH', 'UH']),          // Short/central
  new Set(['AA', 'AO', 'ER', 'AE']),                // Open/back
  new Set(['EY', 'IY', 'AY']),                      // Long front / glide diphthongs
  new Set(['UW', 'OW', 'AW', 'OY'])                 // Long back / rounded
];

export const CONSONANT_GROUPS: Set<string>[] = [
  new Set(['M', 'N', 'NG']),                        // Nasals
  new Set(['S', 'Z', 'SH', 'ZH', 'F', 'V', 'TH', 'DH']), // Fricatives / sibilants
  new Set(['P', 'B', 'T', 'D', 'K', 'G']),          // Plosives
  new Set(['L', 'R', 'W', 'Y', 'HH', 'CH', 'JH'])   // Glides / liquids / affricates
];

export const STOPWORDS = new Set([
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", 
  "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", 
  "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which", 
  "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be", 
  "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", 
  "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", 
  "for", "with", "about", "against", "between", "into", "through", "during", "before", 
  "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", 
  "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", 
  "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", 
  "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", 
  "will", "just", "don", "should", "now", "d", "ll", "m", "o", "re", "ve", "y", "ain", 
  "aren", "couldn", "didn", "doesn", "hadn", "hasn", "haven", "isn", "ma", "mightn", 
  "mustn", "needn", "shan", "shouldn", "wasn", "weren", "won", "wouldn",
  "i'm", "you're", "he's", "she's", "it's", "we're", "they're", "i've", "you've", "we've", 
  "they've", "i'd", "you'd", "he'd", "she'd", "we'd", "they'd", "i'll", "you'll", "he'll", 
  "she'll", "we'll", "they'll", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", 
  "hadn't", "doesn't", "don't", "didn't", "won't", "wouldn't", "shan't", "shouldn't", "can't", 
  "cannot", "couldn't", "mustn't", "let's", "that's", "who's", "what's", "here's", "there's", 
  "when's", "where's", "why's", "how's", "a's", "y'all", "got", "get", "like", "tell", "come", 
  "go", "make", "take", "would", "could", "should"
]);

export function cleanPhoneme(p: string): string {
  return p.replace(/[0-9]/g, '');
}

export function getPhonemeCost(p1: string, p2: string): number {
  if (p1 === p2) return 0.0;
  
  const cp1 = cleanPhoneme(p1);
  const cp2 = cleanPhoneme(p2);
  
  if (cp1 === cp2) return 0.1; // Stress difference only
  
  const isV1 = VOWELS.has(cp1);
  const isV2 = VOWELS.has(cp2);
  
  if (isV1 !== isV2) return 1.8; // Vowel vs Consonant
  
  if (isV1) {
    for (const group of VOWEL_GROUPS) {
      if (group.has(cp1) && group.has(cp2)) return 0.3;
    }
    return 0.8;
  } else {
    for (const group of CONSONANT_GROUPS) {
      if (group.has(cp1) && group.has(cp2)) return 0.4;
    }
    return 0.9;
  }
}

export function phonemeDistance(seq1: string[], seq2: string[]): number {
  const m = seq1.length;
  const n = seq2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i * 1.0;
  for (let j = 0; j <= n; j++) dp[0][j] = j * 1.0;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const p1 = seq1[i - 1];
      const p2 = seq2[j - 1];
      const cost = getPhonemeCost(p1, p2);
      
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1.0,     // Deletion
        dp[i][j - 1] + 1.0,     // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }
  
  return dp[m][n];
}

// CMU phoneme set for gibberish parsing
export const CMU_PHONEMES = new Set([
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW', 'AX',
  'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH'
]);

export const GIBBERISH_VOWELS: Record<string, string> = {
  'a': 'AE', 'e': 'EH', 'i': 'IH', 'o': 'AA', 'u': 'AH', 'y': 'IY',
  'aa': 'AA', 'ae': 'AE', 'ai': 'AY', 'ao': 'AO', 'au': 'AW', 'aw': 'AW',
  'ay': 'AY', 'ee': 'IY', 'ei': 'EY', 'ey': 'EY', 'ie': 'IY', 'oa': 'OW',
  'oe': 'OW', 'oi': 'OY', 'oo': 'UW', 'ou': 'OW', 'ow': 'AW', 'oy': 'OY',
  'ue': 'UW', 'ui': 'UW', 'uy': 'AY'
};

export const GIBBERISH_CONSONANTS: Record<string, string> = {
  'b': 'B', 'c': 'K', 'd': 'D', 'f': 'F', 'g': 'G', 'h': 'HH',
  'j': 'JH', 'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'p': 'P',
  'q': 'K', 'r': 'R', 's': 'S', 't': 'T', 'v': 'V', 'w': 'W',
  'x': 'K S', 'z': 'Z', 'ch': 'CH', 'sh': 'SH', 'th': 'TH', 'ph': 'F',
  'ng': 'NG'
};

export function graphemeToPhoneme(text: string): string {
  const clean = text.toLowerCase().replace(/[^a-z\s-]/g, '').replace(/-/g, ' ');
  const wordsPh: string[] = [];
  
  for (const word of clean.split(/\s+/).filter(Boolean)) {
    let i = 0;
    const n = word.length;
    const phones: string[] = [];
    while (i < n) {
      if (i < n - 1 && GIBBERISH_VOWELS[word.slice(i, i + 2)]) {
        phones.push(GIBBERISH_VOWELS[word.slice(i, i + 2)] + '1');
        i += 2;
      } else if (i < n - 1 && GIBBERISH_CONSONANTS[word.slice(i, i + 2)]) {
        phones.push(GIBBERISH_CONSONANTS[word.slice(i, i + 2)]);
        i += 2;
      } else if (GIBBERISH_VOWELS[word[i]]) {
        phones.push(GIBBERISH_VOWELS[word[i]] + '1');
        i += 1;
      } else if (GIBBERISH_CONSONANTS[word[i]]) {
        phones.push(GIBBERISH_CONSONANTS[word[i]]);
        i += 1;
      } else {
        i += 1;
      }
    }
    if (phones.length > 0) {
      wordsPh.push(phones.join(' '));
    }
  }
  return wordsPh.join(' ');
}

export function parseQueryPhonemes(query: string): string {
  const trimmed = query.trim();
  const tokens = trimmed.toUpperCase().split(/\s+/);
  const isRawCmu = tokens.every(t => {
    const clean = t.replace(/[0-9]/g, '');
    return CMU_PHONEMES.has(clean);
  });
  
  if (isRawCmu) return tokens.join(' ');
  return graphemeToPhoneme(trimmed);
}

export function countSyllablesInPhonemes(phones: string): number {
  return phones.split(/\s+/).filter(p => /[0-9]$/.test(p)).length;
}

export function extractRhymeEnding(phonemes: string): string {
  const tokens = phonemes.trim().split(/\s+/);
  // Find the last stressed vowel (has 1 or 2, or last vowel)
  let lastVowelIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const cp = cleanPhoneme(tokens[i]);
    if (VOWELS.has(cp)) {
      if (/[12]/.test(tokens[i])) {
        lastVowelIdx = i;
        break;
      }
      if (lastVowelIdx === -1) {
        lastVowelIdx = i;
      }
    }
  }
  if (lastVowelIdx === -1) return '';
  return tokens.slice(lastVowelIdx).join(' ');
}
