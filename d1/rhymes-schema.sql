
CREATE TABLE IF NOT EXISTS words (
    word TEXT PRIMARY KEY,
    phonemes TEXT,
    rhyme_ending TEXT,
    frequency INTEGER
);

CREATE TABLE IF NOT EXISTS bigrams (
    bigram TEXT PRIMARY KEY,
    phonemes TEXT,
    rhyme_ending TEXT,
    frequency INTEGER
);

CREATE INDEX IF NOT EXISTS idx_words_rhyme_ending ON words(rhyme_ending);
CREATE INDEX IF NOT EXISTS idx_bigrams_rhyme_ending ON bigrams(rhyme_ending);
