/**
 * Manglish (Latin) to Malayalam Transliteration Engine
 * Implements the standard Mozhi transliteration rules with smart phonetic heuristics
 * and lyrical vocabulary overrides.
 */

// Direct high-frequency overrides for instantaneous accuracy
const VOCAB_OVERRIDES: Record<string, string> = {
  'njan': 'ഞാൻ',
  'njn': 'ഞാൻ',
  'nee': 'നീ',
  'ni': 'നീ',
  'nin': 'നിൻ',
  'en': 'എൻ',
  'ennum': 'എന്നും',
  'nammal': 'നമ്മൾ',
  'nam': 'നാം',
  'oru': 'ഒരു',
  'mazha': 'മഴ',
  'sooryan': 'സൂര്യൻ',
  'suryan': 'സൂര്യൻ',
  'sneham': 'സ്നേഹം',
  'premam': 'പ്രേമം',
  'pranayam': 'പ്രണയം',
  'anuragam': 'അനുരാഗം',
  'ishttam': 'ഇഷ്ടം',
  'ishtam': 'ഇഷ്ടം',
  'kaathal': 'കാതൽ',
  'kannu': 'കണ്ണ്',
  'kannukal': 'കണ്ണുകൾ',
  'kannil': 'കണ്ണിൽ',
  'mizhi': 'മിഴി',
  'mizhikal': 'മിഴികൾ',
  'manassu': 'മനസ്സ്',
  'manam': 'മനം',
  'hridayam': 'ഹൃദയം',
  'ullam': 'ഉള്ളം',
  'kaattu': 'കാറ്റ്',
  'paattu': 'പാട്ട്',
  'paattuval': 'പാട്ടുകൾ',
  'kadal': 'കടൽ',
  'raavu': 'രാവ്',
  'raathri': 'രാത്രി',
  'nilaavu': 'നിലാവ്',
  'chandran': 'ചന്ദ്രൻ',
  'ambili': 'അമ്പിളി',
  'puzha': 'പുഴ',
  'velli': 'വെള്ളി',
  'vellam': 'വെള്ളം',
  'thee': 'തീ',
  'kaadu': 'കാട്',
  'kaanam': 'കാനം',
  'pennu': 'പെണ്ണ്',
  'penne': 'പെണ്ണേ',
  'kili': 'കിളി',
  'parava': 'പറവ',
  'shabdam': 'ശബ്ദം',
  'swaram': 'സ്വരം',
  'raagam': 'രാഗം',
  'ragam': 'രാഗം',
  'eenam': 'ഈണം',
  'thaalam': 'താളം',
  'thalam': 'താളം',
  'geetham': 'ഗീതം',
  'kaalam': 'കാലം',
  'neram': 'നേരം',
  'samayam': 'സമയം',
  'swapnam': 'സ്വപ്നം',
  'kinaavu': 'കിനാവ്',
  'ormma': 'ഓർമ്മ',
  'orma': 'ഓർമ്മ',
  'ormmakal': 'ഓർമ്മകൾ',
  'chiri': 'ചിരി',
  'punchiri': 'പുഞ്ചിരി',
  'aakaasham': 'ആകാശം',
  'vaanam': 'വാനം',
  'jeevan': 'ജീവൻ',
  'praanan': 'പ്രാണൻ',
  'aathmaavu': 'ആത്മാവ്',
  'pular': 'പുലർ',
  'pulari': 'പുലരി',
  'anthi': 'അന്തി',
  'sandhya': 'സന്ധ്യ',
  'koottu': 'കൂട്ട്',
  'changatham': 'ചങ്ങാത്തം',
  'souhridam': 'സൗഹൃദം',
  'viraham': 'വിരഹം',
  'vedana': 'വേദന',
  'shokam': 'ശോകം',
  'sankadam': 'സങ്കടം',
  'nombaram': 'നൊമ്പരം',
  'aanandam': 'ആനന്ദം',
  'santhosham': 'സന്തോഷം'
};

const VOWEL_INITIAL: Record<string, string> = {
  'aa': 'ആ', 'a': 'അ',
  'ee': 'ഈ', 'ea': 'ഏ', 'ei': 'ഐ',
  'ii': 'ഈ', 'i': 'ഇ',
  'oo': 'ഊ', 'ou': 'ഔ',
  'uu': 'ഊ', 'u': 'ഉ',
  'ai': 'ഐ', 'au': 'ഔ',
  'e': 'എ', 'o': 'ഒ'
};

const VOWEL_SIGNS: Record<string, string> = {
  'aa': '\u0D3E', 'a': '',
  'ee': '\u0D40', 'ea': '\u0D47', 'ei': '\u0D48',
  'ii': '\u0D40', 'i': '\u0D3F',
  'oo': '\u0D42', 'ou': '\u0D4C',
  'uu': '\u0D42', 'u': '\u0D41',
  'ai': '\u0D48', 'au': '\u0D4C',
  'e': '\u0D46', 'o': '\u0D4A'
};

const CONSONANTS: { m: string; res: string }[] = [
  // 3-char matches
  { m: 'shh', res: 'ഷ' },
  { m: 'chh', res: 'ഛ' },
  { m: 'thh', res: 'ഥ' },
  // 2-char matches
  { m: 'nj', res: 'ഞ' },
  { m: 'ng', res: 'ങ' },
  { m: 'zh', res: 'ഴ' },
  { m: 'ch', res: 'ച' },
  { m: 'sh', res: 'ശ' },
  { m: 'th', res: 'ത' },
  { m: 'dh', res: 'ദ' },
  { m: 'ph', res: 'ഫ' },
  { m: 'bh', res: 'ഭ' },
  { m: 'kh', res: 'ഖ' },
  { m: 'gh', res: 'ഘ' },
  { m: 'jh', res: 'ഝ' },
  // Common geminates
  { m: 'kk', res: 'ക്ക' },
  { m: 'tt', res: 'ട്ട' },
  { m: 'pp', res: 'പ്പ' },
  { m: 'mm', res: 'മ്മ' },
  { m: 'nn', res: 'ന്ന' },
  { m: 'ss', res: 'സ്സ' },
  // Single char matches
  { m: 'k', res: 'ക' },
  { m: 'g', res: 'ഗ' },
  { m: 'j', res: 'ജ' },
  { m: 't', res: 'ട' },
  { m: 'd', res: 'ഡ' },
  { m: 'n', res: 'ന' },
  { m: 'p', res: 'പ' },
  { m: 'b', res: 'ബ' },
  { m: 'm', res: 'മ' },
  { m: 'y', res: 'യ' },
  { m: 'r', res: 'ര' },
  { m: 'l', res: 'ല' },
  { m: 'v', res: 'വ' },
  { m: 'w', res: 'വ' },
  { m: 's', res: 'സ' },
  { m: 'h', res: 'ഹ' },
  { m: 'f', res: 'ഫ' }
];

const CHILLU_MAP: Record<string, string> = {
  'n': 'ൻ',
  'l': 'ൽ',
  'r': 'ർ'
};

/**
 * In-memory cache for ultra-fast, 0ms synchronous lookups
 */
const transliterationCache = new Map<string, string[]>();

// Seed cache with verified overrides
for (const [k, v] of Object.entries(VOCAB_OVERRIDES)) {
  transliterationCache.set(k.toLowerCase(), [v]);
}

/**
 * Synchronous transliteration lookup:
 * Returns the cached top candidate, verified override, or deterministic fallback.
 */
export function getTransliterationSync(input: string): string | null {
  const clean = input.trim().toLowerCase();
  if (!clean) return null;
  if (transliterationCache.has(clean)) {
    const list = transliterationCache.get(clean);
    if (list && list.length > 0) return list[0];
  }
  if (VOCAB_OVERRIDES[clean]) {
    return VOCAB_OVERRIDES[clean];
  }
  return transliterateWord(clean);
}

/**
 * Fetch candidate transliterations using Google Input Tools API (ml-t-i0-und)
 * As used in Kuttipencil. Free, low-latency, and highly accurate for colloquial Manglish.
 */
export async function fetchGoogleTransliteration(input: string, num: number = 5): Promise<string[]> {
  const clean = input.trim().toLowerCase();
  if (!clean) return [];

  // Check in-memory cache
  if (transliterationCache.has(clean)) {
    return transliterationCache.get(clean)!;
  }

  // Network request to Google Input Tools
  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(clean)}&itc=ml-t-i0-und&num=${num}&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0] === 'SUCCESS' && data[1]?.[0]?.[1]?.length > 0) {
        const candidates: string[] = data[1][0][1];
        transliterationCache.set(clean, candidates);
        return candidates;
      }
    }
  } catch (err) {
    console.warn('[GoogleInputTools] Network unavailable, using offline fallback:', err);
  }

  // Offline fallback
  const fallback = transliterateWord(clean);
  const result = [fallback];
  transliterationCache.set(clean, result);
  return result;
}

/**
 * Transliterates an entire string line by line using Google Input Tools where possible
 */
export async function transliterateTextAsync(text: string): Promise<string> {
  const words = text.match(/[a-zA-Z]+/g) || [];
  const uniqueWords = Array.from(new Set(words));
  
  await Promise.all(uniqueWords.map(w => fetchGoogleTransliteration(w, 1)));

  return text.replace(/[a-zA-Z]+/g, (match) => {
    return getTransliterationSync(match) || transliterateWord(match);
  });
}

/**
 * Transliterates a single Manglish word into Malayalam Unicode
 */
export function transliterateWord(input: string): string {
  const clean = input.trim();
  if (!clean) return '';

  const lower = clean.toLowerCase();
  if (VOCAB_OVERRIDES[lower]) {
    return VOCAB_OVERRIDES[lower];
  }

  // Already Malayalam or contains Malayalam
  if (/[\u0D00-\u0D7F]/.test(clean)) {
    return clean;
  }

  let str = lower;
  let result = '';
  let i = 0;

  while (i < str.length) {
    // 1. Initial vowel at start of word or after non-letter
    if (i === 0 || !/[a-z]/i.test(str[i - 1])) {
      let matchedVowel = false;
      for (const [latin, ml] of Object.entries(VOWEL_INITIAL)) {
        if (str.startsWith(latin, i)) {
          result += ml;
          i += latin.length;
          matchedVowel = true;
          break;
        }
      }
      if (matchedVowel) continue;
    }

    // 2. Check for consonant
    let matchedConsonant: { m: string; res: string } | null = null;
    for (const c of CONSONANTS) {
      if (str.startsWith(c.m, i)) {
        matchedConsonant = c;
        break;
      }
    }

    if (matchedConsonant) {
      i += matchedConsonant.m.length;

      // Check if followed by vowel sign
      let matchedSign: string | null = null;
      let matchedSignLen = 0;
      for (const [latin, sign] of Object.entries(VOWEL_SIGNS)) {
        if (str.startsWith(latin, i)) {
          matchedSign = sign;
          matchedSignLen = latin.length;
          break;
        }
      }

      if (matchedSign !== null) {
        // Consonant + Vowel sign
        result += matchedConsonant.res + matchedSign;
        i += matchedSignLen;
      } else {
        // Consonant at end of word -> check for Chillu
        if (i === str.length && CHILLU_MAP[matchedConsonant.m]) {
          result += CHILLU_MAP[matchedConsonant.m];
        } else {
          // Virama / Halant
          result += matchedConsonant.res + '\u0D4D';
        }
      }
    } else {
      // Non-phonetic or punctuation
      result += str[i];
      i++;
    }
  }

  return result.replace(/\u0D4D{2,}/g, '\u0D4D');
}

/**
 * Transliterates an entire string line by line, preserving whitespace and section headers
 */
export function transliterateText(text: string): string {
  return text.replace(/[a-zA-Z]+/g, (match) => {
    return transliterateWord(match);
  });
}
