export interface RhymeResult {
  word: string;
  syllables: number;
  frequency: number; // occurrences per million words
  type: 'perfect' | 'near';
}

/**
 * Extracts the word frequency value from Datamuse tag metadata.
 * Datamuse returns frequency in format "f:12.34" (occurrences per million words).
 */
function getFrequencyFromTags(tags?: string[]): number {
  if (!tags) return 0;
  for (const tag of tags) {
    if (tag.startsWith('f:')) {
      const freq = parseFloat(tag.substring(2));
      return isNaN(freq) ? 0 : freq;
    }
  }
  return 0;
}

/**
 * Searches the Datamuse API for rhymes of a specific word.
 * Fetches perfect rhymes and falls back or supplements with near rhymes.
 * Results are cleaned and filtered to match "songwriting English".
 */
export async function fetchRhymes(searchWord: string): Promise<RhymeResult[]> {
  const cleanWord = searchWord.toLowerCase().trim().replace(/[^a-z]/g, '');
  if (!cleanWord) return [];

  try {
    // We query both perfect rhymes (rel_rhy) and near rhymes (rel_nry)
    const perfectUrl = `https://api.datamuse.com/words?rel_rhy=${cleanWord}&md=f&max=60`;
    const nearUrl = `https://api.datamuse.com/words?rel_nry=${cleanWord}&md=f&max=60`;

    const [perfectRes, nearRes] = await Promise.all([
      fetch(perfectUrl).then(r => r.json()).catch(() => []),
      fetch(nearUrl).then(r => r.json()).catch(() => [])
    ]);

    const resultsMap = new Map<string, RhymeResult>();

    // Process perfect rhymes
    if (Array.isArray(perfectRes)) {
      perfectRes.forEach((item: any) => {
        const word = item.word.toLowerCase();
        // Filter out multi-word phrases and the original word itself
        if (word === cleanWord || word.includes(' ') || word.replace(/[^a-z]/g, '') !== word) {
          return;
        }

        const frequency = getFrequencyFromTags(item.tags);
        
        resultsMap.set(word, {
          word,
          syllables: item.numSyllables || 1,
          frequency,
          type: 'perfect'
        });
      });
    }

    // Process near rhymes
    if (Array.isArray(nearRes)) {
      nearRes.forEach((item: any) => {
        const word = item.word.toLowerCase();
        if (word === cleanWord || word.includes(' ') || word.replace(/[^a-z]/g, '') !== word) {
          return;
        }

        // If it's already in as a perfect rhyme, don't overwrite it
        if (resultsMap.has(word)) {
          return;
        }

        const frequency = getFrequencyFromTags(item.tags);

        resultsMap.set(word, {
          word,
          syllables: item.numSyllables || 1,
          frequency,
          type: 'near'
        });
      });
    }

    // Convert map to array
    const combined = Array.from(resultsMap.values());

    // Filter out extremely obscure words (frequency < 0.2 per million)
    // to enforce the "songwriting English" constraint.
    const songwritingFiltered = combined.filter(item => {
      // Keep very strong perfect rhymes even if slightly lower frequency, 
      // but filter out ultra-rare jargon words.
      if (item.type === 'perfect') {
        return item.frequency > 0.05;
      }
      return item.frequency > 0.3; // stricter filter for near-rhymes
    });

    // Sort by frequency (primary) so common, writeable words appear first
    songwritingFiltered.sort((a, b) => {
      // Prioritize perfect rhymes slightly, but let high frequency near rhymes bubble up
      const aWeight = a.type === 'perfect' ? a.frequency * 2 : a.frequency;
      const bWeight = b.type === 'perfect' ? b.frequency * 2 : b.frequency;
      return bWeight - aWeight;
    });

    return songwritingFiltered;
  } catch (error) {
    console.error('Error fetching rhymes from Datamuse:', error);
    return [];
  }
}
