import { syllable } from 'syllable';

/**
 * Calculates the total syllable count for an entire line of text.
 * Strips section tags ([...]) -> returns 0
 * Strips backup prefix (>) -> counts remainder
 * Strips punctuation except apostrophes (keeping contractions intact like I'll, don't)
 * Returns 0 if line is empty or has no alphabetic characters
 */
export function countLineSyllables(line: string): number {
  let cleanLine = line.trim();
  if (!cleanLine) return 0;

  // Skip section tags
  if (cleanLine.startsWith('[')) {
    return 0;
  }

  // Strip backup line prefix
  if (cleanLine.startsWith('>')) {
    cleanLine = cleanLine.substring(1).trim();
  }

  // Handle lines with no letters (e.g. only punctuation)
  if (!/[a-zA-Z]/.test(cleanLine)) {
    return 0;
  }

  // Split compound words
  const words = cleanLine
    .replace(/[—–-]/g, ' ')
    .split(/\s+/);

  let total = 0;
  for (const rawWord of words) {
    const word = rawWord.replace(/[^a-zA-Z']/g, '');
    if (word) {
      total += syllable(word);
    }
  }

  return total;
}
