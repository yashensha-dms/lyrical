import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://m3db.com';
const DATA_DIR = path.resolve('data/malayalam');
const LYRICS_DIR = path.join(DATA_DIR, 'lyrics');
const INDEX_FILE = path.join(DATA_DIR, 'songs_index.json');
const SKIPPED_FILE = path.join(DATA_DIR, 'skipped_slugs.json');

const MISSING_INDICATORS = [
  'ഈ പാട്ടിന്റെ വരികൾ ലഭ്യമല്ല',
  'വരികൾ ചേർക്കാൻ സഹായിക്കാമോ',
  'വരികൾ ചേർക്കണം',
  'lyrics not available',
  'lyrics to be added'
];

// Ensure data directories exist
fs.mkdirSync(LYRICS_DIR, { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (response.status === 429 || response.status >= 500) {
        console.warn(`[HTTP ${response.status}] Retrying ${url} in ${delay}ms (Attempt ${attempt}/${retries})`);
        await sleep(delay);
        delay *= 2;
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[Error] ${err.message}. Retrying ${url} in ${delay}ms...`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

/**
 * Discovers all song listings for a given year from m3db.com
 */
async function getSongsForYear(year) {
  const url = year === 2016 ? `${BASE_URL}/lyrics` : `${BASE_URL}/archive/lyrics/year/${year}`;
  console.log(`[Discover] Fetching index for year ${year}: ${url}`);
  const html = await fetchWithRetry(url);

  const songs = [];
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    console.warn(`[Discover] No table found for year ${year}`);
    return songs;
  }

  const rows = [...tableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const row of rows) {
    const rowHtml = row[1];
    if (rowHtml.includes('<th')) continue; // skip header

    const titleMatch = rowHtml.match(/views-field-title[^>]*>[\s\S]*?<a\s+href="\/lyric\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;

    const slug = titleMatch[1].trim();
    const title = cleanHtml(titleMatch[2]);

    const filmMatch = rowHtml.match(/views-field-field-film[^>]*>([\s\S]*?)<\/td>/i);
    const film = filmMatch ? cleanHtml(filmMatch[1]) : '';

    const lyricistMatch = rowHtml.match(/views-field-field-lyricist[^>]*>([\s\S]*?)<\/td>/i);
    const lyricist = lyricistMatch ? cleanHtml(lyricistMatch[1]) : '';

    const musicMatch = rowHtml.match(/views-field-field-music[^>]*>([\s\S]*?)<\/td>/i);
    const music = musicMatch ? cleanHtml(musicMatch[1]) : '';

    const singerMatch = rowHtml.match(/views-field-field-singer[^>]*>([\s\S]*?)<\/td>/i);
    const singer = singerMatch ? cleanHtml(singerMatch[1]) : '';

    songs.push({
      slug,
      title,
      film,
      lyricist,
      music,
      singer,
      year,
      url: `${BASE_URL}/lyric/${slug}`
    });
  }

  console.log(`[Discover] Year ${year}: found ${songs.length} songs.`);
  return songs;
}

/**
 * Fetches and parses a single song's lyrics.
 * Returns null if the song has missing/placeholder lyrics.
 */
async function fetchSongLyrics(song) {
  const html = await fetchWithRetry(song.url);

  // Look for body container
  const bodyMatch = html.match(/<div[^>]*class="[^"]*field-name-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (!bodyMatch) {
    return null;
  }

  const rawBody = bodyMatch[1];

  // Check for any missing lyric indicator
  for (const indicator of MISSING_INDICATORS) {
    if (rawBody.includes(indicator)) {
      return null;
    }
  }

  const lyricsText = cleanHtml(rawBody);
  if (!lyricsText || lyricsText.length < 30) {
    return null;
  }

  return {
    ...song,
    lyrics: lyricsText,
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Main Runner
 */
async function main() {
  const args = process.argv.slice(2);
  const isDiscoverOnly = args.includes('--discover');
  const yearArgIdx = args.indexOf('--year');
  const limitArgIdx = args.indexOf('--limit');

  const targetYear = yearArgIdx !== -1 ? parseInt(args[yearArgIdx + 1], 10) : null;
  const limit = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : null;

  let songsIndex = [];
  if (fs.existsSync(INDEX_FILE)) {
    try {
      songsIndex = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    } catch {
      songsIndex = [];
    }
  }

  // 1. Discovery Phase
  if (targetYear) {
    const yearSongs = await getSongsForYear(targetYear);
    // Merge or replace
    const otherSongs = songsIndex.filter(s => s.year !== targetYear);
    songsIndex = [...otherSongs, ...yearSongs];
    fs.writeFileSync(INDEX_FILE, JSON.stringify(songsIndex, null, 2), 'utf8');
  } else if (songsIndex.length === 0 || isDiscoverOnly) {
    console.log('[Discover] Scanning years 2000 to 2026...');
    const allSongs = [];
    for (let yr = 2026; yr >= 2000; yr--) {
      try {
        const yrSongs = await getSongsForYear(yr);
        allSongs.push(...yrSongs);
        await sleep(300); // polite pause
      } catch (err) {
        console.error(`[Discover Error] Failed for year ${yr}: ${err.message}`);
      }
    }
    songsIndex = allSongs;
    fs.writeFileSync(INDEX_FILE, JSON.stringify(songsIndex, null, 2), 'utf8');
    console.log(`[Discover] Total songs indexed: ${songsIndex.length}. Saved to ${INDEX_FILE}`);
  }

  if (isDiscoverOnly) {
    console.log('[Done] Discovery complete.');
    return;
  }

  // 2. Fetch Lyrics Phase
  let skippedSlugs = new Set();
  if (fs.existsSync(SKIPPED_FILE)) {
    try {
      const skippedArr = JSON.parse(fs.readFileSync(SKIPPED_FILE, 'utf8'));
      skippedSlugs = new Set(skippedArr);
    } catch {}
  }

  let candidates = songsIndex;
  if (targetYear) {
    candidates = candidates.filter(s => s.year === targetYear);
  }

  // Filter out already downloaded or skipped
  const pending = candidates.filter(s => {
    const filePath = path.join(LYRICS_DIR, `${s.slug}.json`);
    return !fs.existsSync(filePath) && !skippedSlugs.has(s.slug);
  });

  const totalToFetch = limit ? Math.min(limit, pending.length) : pending.length;
  console.log(`[Lyrics Fetcher] Total candidates: ${candidates.length}, Pending: ${pending.length}, To fetch: ${totalToFetch}`);

  const toProcess = pending.slice(0, totalToFetch);
  let savedCount = 0;
  let skippedCount = 0;

  // Process with concurrency limit of 5
  const CONCURRENCY = 5;
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const chunk = toProcess.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (song) => {
        try {
          const result = await fetchSongLyrics(song);
          if (result && result.lyrics) {
            const outPath = path.join(LYRICS_DIR, `${song.slug}.json`);
            fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
            savedCount++;
          } else {
            skippedSlugs.add(song.slug);
            skippedCount++;
          }
        } catch (err) {
          console.error(`[Error] Failed fetching ${song.slug}: ${err.message}`);
        }
      })
    );

    // Persist skipped slugs periodically
    fs.writeFileSync(SKIPPED_FILE, JSON.stringify([...skippedSlugs], null, 2), 'utf8');

    const progress = Math.min(i + CONCURRENCY, toProcess.length);
    if (progress % 20 === 0 || progress === toProcess.length) {
      console.log(`[Progress] ${progress}/${toProcess.length} processed (${savedCount} saved with lyrics, ${skippedCount} skipped/missing).`);
    }

    await sleep(250); // polite pause between batches
  }

  console.log(`[Done] Batch completed. Saved: ${savedCount}, Skipped/Missing: ${skippedCount}.`);
}

main().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
