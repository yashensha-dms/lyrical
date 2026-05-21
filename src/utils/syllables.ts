/**
 * Counts the number of syllables in a single English word.
 * Uses robust regex-based rules for real-time, zero-latency client-side counting.
 */
export function countWordSyllables(word: string): number {
  // Clean word: lowercase and strip non-alphabetic chars
  word = word.toLowerCase().trim().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;

  // Rule 1: Check if the trailing 'e' is silent.
  // Exception: words ending in a consonant + 'le' (like table, simple, bubble) where 'le' forms a syllable.
  let hasSilentE = false;
  if (word.endsWith('e')) {
    const isLeEnding = word.endsWith('le');
    const beforeLe = word.length > 2 ? word.charAt(word.length - 3) : '';
    const isConsonant = beforeLe && !'aeiouy'.includes(beforeLe);
    
    if (isLeEnding && isConsonant) {
      // Keeping the 'e' active since '-le' forms a syllable (e.g. ta-ble)
      hasSilentE = false;
    } else {
      hasSilentE = true;
    }
  }

  // Rule 2: Count vowel groups (contiguous sequences of vowels, counting 'y' as a vowel)
  const vowels = 'aeiouy';
  let vowelGroups = 0;
  let inVowelGroup = false;

  for (let i = 0; i < word.length; i++) {
    const char = word.charAt(i);
    const isVowel = vowels.includes(char);
    
    if (isVowel) {
      if (!inVowelGroup) {
        vowelGroups++;
        inVowelGroup = true;
      }
    } else {
      inVowelGroup = false;
    }
  }

  // Apply adjustments
  let adjustments = 0;

  if (hasSilentE) {
    adjustments -= 1;
  }

  // Rule 3: Check trailing '-ed'.
  // It adds a syllable only if preceded by 't' or 'd' (e.g. 'wanted', 'needed').
  // Otherwise, it is silent (e.g. 'loved', 'hoped' -> subtract 1).
  if (word.endsWith('ed') && word.length > 3) {
    const charBeforeEd = word.charAt(word.length - 3);
    if (charBeforeEd !== 't' && charBeforeEd !== 'd') {
      // Don't subtract twice if we already subtracted for silent 'e'
      if (!hasSilentE) {
        adjustments -= 1;
      }
    }
  }

  // Rule 4: Check trailing '-es'.
  // It adds a syllable only if preceded by soft/sibilant sounds: s, z, x, c, g, ch, sh
  // (e.g. 'passes', 'boxes', 'buzzes', 'changes' -> keeps syllable).
  // Otherwise, it is silent (e.g. 'lines', 'hopes' -> subtract 1).
  if (word.endsWith('es') && word.length > 3) {
    const lastBeforeEs = word.charAt(word.length - 3);
    const lastTwoBeforeEs = word.substring(word.length - 4, word.length - 2);
    
    const addsSyllable = ['s', 'z', 'x', 'c', 'g'].includes(lastBeforeEs) || 
                         lastTwoBeforeEs === 'ch' || 
                         lastTwoBeforeEs === 'sh';
                         
    if (!addsSyllable) {
      if (!hasSilentE) {
        adjustments -= 1;
      }
    }
  }

  // Rule 5: Trailing '-ism' adds a syllable (e.g., 'spasm', 'prism' -> +1)
  if (word.endsWith('ism')) {
    adjustments += 1;
  }

  // Rule 6: Handle specific vowel clusters that split into 2 syllables (e.g., 'diet', 'client', 'chaos')
  const doubleVowelSplits = [
    /ia/, // e.g. giant, dial
    /eo/, // e.g. neon
    /ua/, // e.g. visual, dual
    /uo/  // e.g. duo
  ];
  
  for (const regex of doubleVowelSplits) {
    if (regex.test(word)) {
      adjustments += 1;
    }
  }

  const result = vowelGroups + adjustments;
  
  // Guard: Every visible word must have at least 1 syllable
  return result > 0 ? result : 1;
}

/**
 * Calculates the total syllable count for an entire line of text.
 */
export function countLineSyllables(line: string): number {
  if (!line || !line.trim()) return 0;
  
  // Replace hyphens and em-dashes with spaces to count compound words separately
  const words = line
    .replace(/[—–-]/g, ' ')
    .split(/\s+/);
    
  let total = 0;
  for (const rawWord of words) {
    // Strip punctuation but retain apostrophes for contractions (e.g. don't, I've)
    const word = rawWord.replace(/[^a-zA-Z']/g, '');
    if (word) {
      total += countWordSyllables(word);
    }
  }
  
  return total;
}
